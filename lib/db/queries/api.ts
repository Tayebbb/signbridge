import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {getDatabase} from "../client";
import type {StateStore} from "../session";
import {StateError,lockProject,lockJob,hasAuthority,validProof,type RunProof} from "./common";
import {hash} from "../../domain/fingerprints";
import type {Cue} from "../../domain/captions/shared";
import type {Segment} from "../../domain/segmentation";
import type {PlaybackManifest} from "../../contracts/manifest";
import {jobProgressSchema} from "../../contracts/progress";
import type {SignAsset} from "../../domain/retrieval";
export async function applicationStore(){return (await getDatabase()).state;}
export async function ownerForToken(store:StateStore,tokenHash:Buffer){return (await store.query<{id:string}>(sql`SELECT id FROM owners WHERE token_hash=${tokenHash}`))[0]?.id??null;}
export async function ensureOwner(store:StateStore,tokenHash:Buffer){return store.transaction(async q=>{await q.query(sql`INSERT INTO owners(token_hash) VALUES (${tokenHash}) ON CONFLICT DO NOTHING`);return (await q.query<{id:string}>(sql`SELECT id FROM owners WHERE token_hash=${tokenHash}`))[0].id;});}
export async function createProject(store:StateStore,ownerId:string,title:string,key:string){return store.transaction(async q=>{
  await q.query(sql`SELECT id FROM owners WHERE id=${ownerId} FOR UPDATE`);const scope=`project:${ownerId}`,requestHash=hash({title});
  const old=(await q.query<{request_hash:string;response:{projectId:string}}>(sql`SELECT * FROM api_requests WHERE scope=${scope} AND key=${key}`))[0];
  if(old){if(old.request_hash!==requestHash)throw new StateError("idempotency_conflict");return old.response;}
  const projectId=randomUUID();await q.query(sql`INSERT INTO projects(id,owner_id,title,rights_attested_at) VALUES (${projectId},${ownerId},${title},now())`);
  const response={projectId};await q.query(sql`INSERT INTO api_requests(scope,key,request_hash,response) VALUES (${scope},${key},${requestHash},${JSON.stringify(response)}::jsonb)`);return response;
});}
export async function consumeRate(store:StateStore,scopes:string[],limit=120,now=new Date()){
  return store.transaction(async q=>{const start=new Date(Math.floor(now.getTime()/3_600_000)*3_600_000);
    for(const scope of [...new Set(scopes)].sort()){const rows=await q.query(sql`INSERT INTO rate_windows(scope,window_start,count) VALUES (${scope},${start},1) ON CONFLICT(scope,window_start) DO UPDATE SET count=rate_windows.count+1 WHERE rate_windows.count<${limit} RETURNING count`);if(!rows.length)throw new StateError("rate_limited");}
  });
}
export interface AccessProject {id:string;owner_id:string;title:string;visibility:string;status:string;current_transcript_version_id:string|null;current_track_version_id:string|null;active_job_id:string|null;processing_epoch:string;lock_version:number}
export async function ownedProject(store:StateStore,id:string,ownerId:string|null){
  if(!ownerId)throw new StateError("not_found");const p=(await store.query<AccessProject>(sql`SELECT * FROM projects WHERE id=${id} AND owner_id=${ownerId} AND status='active'`))[0];if(!p)throw new StateError("not_found");return p;
}
export interface TranscriptRow {id:string;project_id:string;version_no:number;text_hash:string;cues:Cue[]}
export async function transcript(store:StateStore,id:string){return (await store.query<TranscriptRow>(sql`SELECT * FROM transcript_versions WHERE id=${id}`))[0]??null;}
export async function transcriptRequestExists(store:StateStore,projectId:string,key:string){return (await store.query(sql`SELECT id FROM transcript_versions WHERE project_id=${projectId} AND request_key=${key}`)).length>0;}
export async function jobRequestExists(store:StateStore,projectId:string,key:string){return (await store.query(sql`SELECT id FROM jobs WHERE project_id=${projectId} AND idempotency_key=${key}`)).length>0;}
export async function transcriptSegments(store:StateStore,id:string){return store.query<Segment&{segmentKey:string;sourceCheck:string;sourceConfirmedAt:string|null}>(sql`SELECT s.idx,s.start_ms AS "startMs",s.end_ms AS "endMs",s.cue_from AS "cueFrom",s.cue_to AS "cueTo",s.source_text AS "sourceText",s.segment_key AS "segmentKey",s.source_check AS "sourceCheck",t.edit_summary->'sourceChecks'->>s.idx::text AS "sourceConfirmedAt" FROM segments s JOIN transcript_versions t ON t.id=s.transcript_version_id WHERE s.transcript_version_id=${id} ORDER BY s.idx`);}
export async function projectDetails(store:StateStore,p:AccessProject,includeJob=true){
  const currentTranscript=p.current_transcript_version_id?await transcript(store,p.current_transcript_version_id):null;
  const saved=p.current_track_version_id?await trackRow(store,p.current_track_version_id):null;
  return {project:{id:p.id,title:p.title,visibility:p.visibility,status:p.status,processingEpoch:String(p.processing_epoch),lockVersion:p.lock_version},currentTranscript:currentTranscript?{id:currentTranscript.id,cues:currentTranscript.cues,versionNo:currentTranscript.version_no,textHash:currentTranscript.text_hash}:null,segments:currentTranscript?await transcriptSegments(store,currentTranscript.id):[],job:includeJob&&p.active_job_id?await jobProgress(store,p.active_job_id):null,trackSummary:saved?{id:saved.id,manifestHash:saved.manifest_hash,technicalStatus:saved.technical_status}:null};
}
export async function jobProjectId(store:StateStore,id:string){return (await store.query<{project_id:string}>(sql`SELECT project_id FROM jobs WHERE id=${id}`))[0]?.project_id??null;}
export async function jobProgress(store:StateStore,id:string){
  const j=(await store.query<{id:string;status:string;transcript_version_id:string;result_track_version_id:string|null;progress:{segments?:unknown[]};last_error:{code?:string}|null}>(sql`SELECT * FROM jobs WHERE id=${id}`))[0];if(!j)throw new StateError("not_found");
  return jobProgressSchema.parse({jobId:id,status:j.status,transcriptVersionId:j.transcript_version_id,segments:j.progress.segments??[],trackVersionId:j.result_track_version_id,retryable:["failed","partial","cancelled"].includes(j.status),message:j.last_error?.code??null});
}
export async function trackRow(store:StateStore,id:string){return (await store.query<{id:string;project_id:string;transcript_version_id:string;manifest:PlaybackManifest;manifest_hash:string;technical_status:string}>(sql`SELECT * FROM track_versions WHERE id=${id}`))[0]??null;}
export interface MediaRecord {id:string;project_id:string;blob_pathname:string;content_type:string;client_sha256:string;size_bytes:number;client_duration_ms:number;status:string;expires_at:Date|string;pinned:boolean;declared_bytes:number;reservation_expires_at:Date|string}
export async function mediaRow(store:StateStore,id:string,projectId:string){return (await store.query<MediaRecord>(sql`SELECT * FROM media WHERE id=${id} AND project_id=${projectId}`))[0]??null;}
export async function readyMedia(store:StateStore,projectId:string,sha?:string){return (await store.query<MediaRecord>(sql`SELECT * FROM media WHERE project_id=${projectId} AND status='ready' ${sha?sql`AND client_sha256=${sha}`:sql``} ORDER BY created_at DESC,id DESC LIMIT 1`))[0]??null;}
export async function expiredMediaExists(store:StateStore,projectId:string,sha?:string){return (await store.query(sql`SELECT id FROM media WHERE project_id=${projectId} AND status='expired' ${sha?sql`AND client_sha256=${sha}`:sql``} LIMIT 1`)).length>0;}
export async function setSourceCheck(store:StateStore,projectId:string,tv:string,idx:number,state:string){return store.transaction(async q=>{
  const p=(await lockProject(q,projectId,true))!;if(p.current_transcript_version_id!==tv)throw new StateError("version_conflict");
  const rows=await q.query(sql`UPDATE segments SET source_check=${state}::source_check WHERE transcript_version_id=${tv} AND idx=${idx} RETURNING id`);if(!rows.length)throw new StateError("not_found");
  await q.query(sql`UPDATE transcript_versions SET edit_summary=jsonb_set(coalesce(edit_summary,'{}'::jsonb),'{sourceChecks}',coalesce(edit_summary->'sourceChecks','{}'::jsonb)||jsonb_build_object(${String(idx)}::text,CASE WHEN ${state}='creator_confirmed' THEN coalesce(edit_summary->'sourceChecks'->>${String(idx)}::text,${new Date().toISOString()}) ELSE NULL END)) WHERE id=${tv}`);
});}
export async function trackOverlays(store:StateStore,tv:string){return {sourceChecks:await store.query<{idx:number;state:"unconfirmed"|"creator_confirmed";confirmedAt:string|null}>(sql`SELECT s.idx,s.source_check AS state,t.edit_summary->'sourceChecks'->>s.idx::text AS "confirmedAt" FROM segments s JOIN transcript_versions t ON t.id=s.transcript_version_id WHERE s.transcript_version_id=${tv} ORDER BY s.idx`),review:{status:"unreviewed" as const,validFor:null}};}
export async function processingAllowed(store:StateStore,envEnabled:boolean){if(!envEnabled)return false;const [r]=await store.query<{value:boolean}>(sql`SELECT value FROM ops_settings WHERE key='processing'`);return r?.value!==false;}
export async function setProcessing(store:StateStore,value:boolean){await store.transaction(async q=>{await q.query(sql`INSERT INTO ops_settings(key,value) VALUES ('processing',${JSON.stringify(value)}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);if(value)await q.query(sql`INSERT INTO ops_settings(key,value) VALUES ('error_acknowledged_at',${JSON.stringify(new Date().toISOString())}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);});}
export async function noteSolUnavailable(store:StateStore){await store.transaction(q=>q.query(sql`INSERT INTO ops_settings(key,value) VALUES ('sol_unavailable','true') ON CONFLICT(key) DO UPDATE SET value='true'`));}
export async function adminStatus(store:StateStore){return {budgets:await store.query(sql`SELECT * FROM spend_budgets ORDER BY scope`),storage:(await store.query(sql`SELECT * FROM storage_ledger WHERE id=1`))[0]??null,jobs:await store.query(sql`SELECT status,count(*)::int AS count FROM jobs GROUP BY status`),renderEvents:await store.query(sql`SELECT kind,count(*)::int AS count FROM render_events GROUP BY kind`)};}
export async function recordRenderEvent(store:StateStore,input:{trackVersionId:string;segmentIdx:number;kind:string;detail:unknown;uaClass:string}){await store.transaction(q=>q.query(sql`INSERT INTO render_events(track_version_id,segment_idx,kind,detail,ua_class) VALUES (${input.trackVersionId},${input.segmentIdx},${input.kind},${JSON.stringify(input.detail)}::jsonb,${input.uaClass})`));}
export async function loadJob(store:StateStore,jobId:string){
  const [j]=await store.query<{id:string;project_id:string;transcript_version_id:string;model_profile:string;status:string}>(sql`SELECT * FROM jobs WHERE id=${jobId}`);if(!j)throw new StateError("not_found");
  const [p]=await store.query<AccessProject>(sql`SELECT * FROM projects WHERE id=${j.project_id}`),tv=await transcript(store,j.transcript_version_id);
  if(!p||!tv)throw new StateError("not_found");return {job:j,project:p,transcript:tv,segments:await transcriptSegments(store,tv.id)};
}
export async function stageRecord(store:StateStore,key:string){return (await store.query<{output:unknown;output_hash:string}>(sql`SELECT output,output_hash FROM stage_results WHERE cache_key=${key}`))[0]??null;}
export async function stageAttemptsFor(store:StateStore,jobId:string,idx:number,stage:string){return store.query<{attempt_no:number;outcome:string;reservation_id:string|null}>(sql`SELECT * FROM stage_attempts WHERE job_id=${jobId} AND segment_idx=${idx} AND stage=${stage} ORDER BY attempt_no`);}
export async function updateProgress(store:StateStore,jobId:string,proof:RunProof,idx:number,stage:string,state:string,errorCode:string|null=null){await store.transaction(async q=>{
  const locked=await lockJob(q,jobId);if(!locked||!hasAuthority(locked.project,locked.job)||!validProof(locked.job,proof,new Date()))return;
  const segments=Array.isArray(locked.job.progress.segments)?locked.job.progress.segments as {idx:number;stage:string;state:string;errorCode:string|null}[]:[],next=segments.filter(s=>s.idx!==idx);next.push({idx,stage,state,errorCode});next.sort((a,b)=>a.idx-b.idx);
  await q.query(sql`UPDATE jobs SET progress=${JSON.stringify({...locked.job.progress,segments:next})}::jsonb,heartbeat_at=now(),updated_at=now() WHERE id=${jobId}`);
});}
export async function eligibleAssets(store:StateStore):Promise<SignAsset[]>{return store.query<SignAsset>(sql`SELECT a.id,a.kind,a.label_bn AS "labelBn",a.label_phrase_form AS "labelPhraseForm",a.derived_sigml AS "derivedSigml",a.derived_sha256 AS "derivedSha256",a.unit_count AS "unitCount",a.eligible,coalesce((a.render_evidence->>'frames')::float*40,a.unit_count*3000) AS "estimatedDurationMs",coalesce(array_agg(x.alias_norm) FILTER(WHERE x.alias_norm IS NOT NULL),'{}') AS aliases FROM sign_assets a LEFT JOIN asset_aliases x ON x.asset_id=a.id WHERE a.eligible=true AND a.render_state='rendered_ok' GROUP BY a.id ORDER BY a.id`);}
export async function corpusAttribution(store:StateStore){const [row]=await store.query<{attribution:string}>(sql`SELECT attribution FROM corpus_releases WHERE id='ik2-mendeley-v2'`);if(!row)throw new StateError("corpus_unavailable");return row.attribution;}
