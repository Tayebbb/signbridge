import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import type {StateStore,SqlSession} from "../session";
import {StateError,lockProject,lockJob,failLocked,type ProjectRow} from "./common";
import {dayScope} from "../../domain/limits";
import {budgetSignalLocked} from "./spend";
import {hash,segmentKey} from "../../domain/fingerprints";
import {contextWindow,segmentCues,SEGMENTER_VERSION} from "../../domain/segmentation";
import {SOURCE_FORM_VERSION,retrievalForm} from "../../domain/captions/textForms";
import {validateCues,type Cue} from "../../domain/captions/shared";

async function admit(q:SqlSession,p:ProjectRow,kind:"fresh"|"replan",count:number,now:Date) {
  if(!Number.isInteger(count)||count<0||count>20)throw new StateError("segment_limit");
  await q.query(sql`SELECT id FROM owners WHERE id=${p.owner_id} FOR UPDATE`);
  const day=dayScope(now);
  await q.query(sql`INSERT INTO owner_daily_quotas(owner_id,day_scope) VALUES (${p.owner_id},${day}) ON CONFLICT DO NOTHING`);
  const rows=await q.query(sql`UPDATE owner_daily_quotas SET fresh_clips=fresh_clips+${kind==="fresh"?1:0},replanned_segments=replanned_segments+${kind==="replan"?count:0} WHERE owner_id=${p.owner_id} AND day_scope=${day} AND fresh_clips+${kind==="fresh"?1:0}<=3 AND replanned_segments+${kind==="replan"?count:0}<=10 RETURNING owner_id`);
  if(!rows.length)throw new StateError("owner_quota");
  return {admission:{kind,segments:count}};
}
async function createJob(q:SqlSession,p:ProjectRow,tv:string,key:string,now:Date,options:{driver?:"workflows"|"lease";modelProfile?:string;replanSegments?:number}={}) {
  const transcript=(await q.query<{id:string}>(sql`SELECT id FROM transcript_versions WHERE id=${tv} AND project_id=${p.id}`))[0];if(!transcript)throw new StateError("not_found");
  const prior=await q.query(sql`SELECT id FROM jobs WHERE project_id=${p.id} LIMIT 1`);
  const [segments]=await q.query<{n:number}>(sql`SELECT count(*)::int AS n FROM segments WHERE transcript_version_id=${tv}`);
  const progress=await admit(q,p,prior.length?"replan":"fresh",options.replanSegments??segments.n,now);
  await q.query(sql`UPDATE jobs SET status='superseded',cancel_requested=true,finished_at=${now},updated_at=${now} WHERE project_id=${p.id} AND status IN ('queued','running')`);
  const id=randomUUID(),epoch=BigInt(p.processing_epoch)+1n,signal=await budgetSignalLocked(q,now);
  if(signal.closed)throw new StateError("spend_cap");
  await q.query(sql`INSERT INTO jobs(id,project_id,transcript_version_id,processing_epoch,idempotency_key,driver,model_profile,progress,created_at,updated_at) VALUES (${id},${p.id},${tv},${epoch.toString()},${key},${options.driver??"workflows"},${signal.downgrade?"gpt-6.1-terra":options.modelProfile??"gpt-6.1-sol"},${JSON.stringify(progress)}::jsonb,${now},${now})`);
  await q.query(sql`UPDATE projects SET active_job_id=${id},processing_epoch=${epoch.toString()} WHERE id=${p.id}`);
  return {id,epoch,transcriptVersionId:tv};
}
export async function startJob(store:StateStore,input:{projectId:string;transcriptVersionId:string;idempotencyKey:string;driver?:"workflows"|"lease";modelProfile?:string;replanSegments?:number},now=new Date()) {
  return store.transaction(async q=>{
    const p=(await lockProject(q,input.projectId,true))!;
    const existing=(await q.query<{id:string;processing_epoch:string;transcript_version_id:string}>(sql`SELECT id,processing_epoch,transcript_version_id FROM jobs WHERE project_id=${p.id} AND idempotency_key=${input.idempotencyKey}`))[0];
    if(existing){if(existing.transcript_version_id!==input.transcriptVersionId)throw new StateError("idempotency_conflict");return {id:existing.id,epoch:BigInt(existing.processing_epoch),transcriptVersionId:existing.transcript_version_id};}
    if(p.current_transcript_version_id!==input.transcriptVersionId)throw new StateError("version_conflict");
    return createJob(q,p,input.transcriptVersionId,input.idempotencyKey,now,input);
  });
}
export async function retryJob(store:StateStore,input:{jobId:string;idempotencyKey:string;replanSegments?:number},now=new Date()) {
  return store.transaction(async q=>{
    const locked=await lockJob(q,input.jobId);if(!locked||locked.project.status!=="active")throw new StateError("not_found");
    const {project:p,job}=locked;
    const existing=(await q.query<{id:string;processing_epoch:string;transcript_version_id:string}>(sql`SELECT id,processing_epoch,transcript_version_id FROM jobs WHERE project_id=${p.id} AND idempotency_key=${input.idempotencyKey}`))[0];
    if(existing){if(existing.transcript_version_id!==job.transcript_version_id)throw new StateError("idempotency_conflict");return {id:existing.id,epoch:BigInt(existing.processing_epoch),transcriptVersionId:existing.transcript_version_id};}
    if(["queued","running","superseded"].includes(job.status)||p.current_transcript_version_id!==job.transcript_version_id)throw new StateError("retry_conflict");
    return createJob(q,p,job.transcript_version_id,input.idempotencyKey,now,{driver:job.driver as "workflows"|"lease",replanSegments:input.replanSegments});
  });
}
export async function cancelJob(store:StateStore,jobId:string,now=new Date()) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||locked.project.status!=="active")return false;const {project:p,job}=locked;
    if(!["queued","running"].includes(job.status))return false;
    await q.query(sql`UPDATE jobs SET status='cancelled',cancel_requested=true,finished_at=${now},updated_at=${now} WHERE id=${jobId}`);
    if(p.active_job_id===jobId)await q.query(sql`UPDATE projects SET active_job_id=NULL,processing_epoch=processing_epoch+1 WHERE id=${p.id}`);return true;});
}
export async function deleteProject(store:StateStore,projectId:string,now=new Date()) {
  return store.transaction(async q=>{const p=await lockProject(q,projectId);if(!p||p.status==="deleting")return false;
    await q.query(sql`UPDATE jobs SET status='cancelled',cancel_requested=true,finished_at=${now},updated_at=${now} WHERE project_id=${p.id} AND status IN ('queued','running')`);
    await q.query(sql`UPDATE projects SET status='deleting',active_job_id=NULL,processing_epoch=processing_epoch+1,share_token_hash=NULL,share_created_at=NULL WHERE id=${p.id}`);return true;});
}
export async function stallFence(store:StateStore,jobId:string,now=new Date()) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked)return false;const {project,job}=locked;
    if(project.status!=="active"||project.active_job_id!==jobId||job.status!=="running"||!job.heartbeat_at||new Date(job.heartbeat_at).getTime()>=now.getTime()-600_000)return false;
    await failLocked(q,project,job,"stalled",now);return true;});
}
export async function failJob(store:StateStore,jobId:string,code:string,now=new Date()) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||!["queued","running"].includes(locked.job.status))return false;await failLocked(q,locked.project,locked.job,code,now);return true;});
}
export async function submitTranscriptVersion(store:StateStore,input:{projectId:string;baseVersionId:string|null;idempotencyKey:string;cues:Cue[];source?:"srt"|"vtt"|"pasted";modelProfile?:string},now=new Date()) {
  const cues=validateCues(input.cues,input.cues.map((_,i)=>i+1)),segs=segmentCues(cues);if(segs.length>20)throw new StateError("segment_limit");
  return store.transaction(async q=>{
    const p=(await lockProject(q,input.projectId,true))!;
    const existing=(await q.query<{id:string;transcript_version_id:string;processing_epoch:string}>(sql`SELECT id,transcript_version_id,processing_epoch FROM jobs WHERE project_id=${p.id} AND idempotency_key=${input.idempotencyKey}`))[0];
    if(existing){const [version]=await q.query<{text_hash:string}>(sql`SELECT text_hash FROM transcript_versions WHERE id=${existing.transcript_version_id}`);if(version.text_hash!==hash(cues))throw new StateError("idempotency_conflict");return {id:existing.id,epoch:BigInt(existing.processing_epoch),transcriptVersionId:existing.transcript_version_id};}
    if(p.current_transcript_version_id!==input.baseVersionId)throw new StateError("version_conflict");
    const id=randomUUID(),[version]=await q.query<{n:number}>(sql`SELECT coalesce(max(version_no),0)::int+1 AS n FROM transcript_versions WHERE project_id=${p.id}`);
    await q.query(sql`INSERT INTO transcript_versions(id,project_id,version_no,parent_version_id,source,cues,segmenter_version,source_form_version,text_hash,created_at) VALUES (${id},${p.id},${version.n},${input.baseVersionId},${input.source??"pasted"},${JSON.stringify(cues)}::jsonb,${SEGMENTER_VERSION},${SOURCE_FORM_VERSION},${hash(cues)},${now})`);
    const old=await q.query<{segment_key:string}>(sql`SELECT segment_key FROM segments WHERE transcript_version_id=${input.baseVersionId}`),oldKeys=new Set(old.map(s=>s.segment_key));let changed=0;
    for(let i=0;i<segs.length;i++){const s=segs[i],key=segmentKey(s,contextWindow(segs,i,p.title));if(!oldKeys.has(key))changed++;
      await q.query(sql`INSERT INTO segments(transcript_version_id,idx,start_ms,end_ms,cue_from,cue_to,source_text,retrieval_text,segment_key) VALUES (${id},${s.idx},${s.startMs},${s.endMs},${s.cueFrom},${s.cueTo},${s.sourceText},${retrievalForm(s.sourceText)},${key})`);}
    const result=await createJob(q,p,id,input.idempotencyKey,now,{modelProfile:input.modelProfile,replanSegments:changed});
    await q.query(sql`UPDATE projects SET current_transcript_version_id=${id},lock_version=lock_version+1 WHERE id=${p.id}`);return result;
  });
}
