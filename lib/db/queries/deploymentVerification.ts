import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
import {lockProject} from "./common";
export async function deploymentSnapshot(store:StateStore,projectId:string){
 return store.transaction(async q=>{
 await q.query(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
 const [project]=await q.query<{id:string;current_track_version_id:string|null;active_job_id:string|null}>(sql`SELECT id,current_track_version_id,active_job_id FROM projects WHERE id=${projectId}`);
 const jobs=await q.query<{id:string;status:string;driver:string;run_claim:string|null;workflow_run_id:string|null;result_track_version_id:string|null;created_at:Date;finished_at:Date|null}>(sql`SELECT id,status,driver,run_claim,workflow_run_id,result_track_version_id,created_at,finished_at FROM jobs WHERE project_id=${projectId} ORDER BY created_at`);
 const attempts=await q.query<{job_id:string;segment_idx:number;stage:string;attempt_no:number;outcome:string;provider:string;input_tokens:number|null;output_tokens:number|null;cost_usd_micros:string}>(sql`SELECT a.job_id,a.segment_idx,a.stage,a.attempt_no,a.outcome,a.provider,a.input_tokens,a.output_tokens,a.cost_usd_micros FROM stage_attempts a JOIN jobs j ON j.id=a.job_id WHERE j.project_id=${projectId} ORDER BY a.id`);
 const tracks=await q.query<{id:string;manifest_hash:string;technical_status:string}>(sql`SELECT id,manifest_hash,technical_status FROM track_versions WHERE project_id=${projectId} ORDER BY created_at`);
 const renders=await q.query(sql`SELECT e.segment_idx,e.kind,e.detail,e.ua_class FROM render_events e JOIN track_versions t ON t.id=e.track_version_id WHERE t.project_id=${projectId} ORDER BY e.id`);
 return {project,jobs,attempts,tracks,renders};
 });
}
/** Test-only SQL lock: hold an already-running, owned verification project across redeploy. */
export async function withDeploymentVerificationLock<T>(store:StateStore,projectId:string,jobId:string,work:()=>Promise<T>){
 return store.transaction(async q=>{
  await q.query(sql`SET LOCAL idle_in_transaction_session_timeout='240s'`);
  const p=await lockProject(q,projectId,true);
  const [job]=await q.query<{status:string;run_claim:string|null;driver:string}>(sql`SELECT status,run_claim,driver FROM jobs WHERE id=${jobId} AND project_id=${projectId}`);
  if(p?.active_job_id!==jobId||job?.status!=="running"||job.driver!=="workflows"||!job.run_claim)throw Error("Verification job must already be claimed and running");
  return work();
 });
}
export async function verificationCallInFlight(store:StateStore,projectId:string,jobId:string){
 const rows=await store.query<{run_claim:string}>(sql`SELECT j.run_claim FROM jobs j JOIN stage_attempts a ON a.job_id=j.id WHERE j.id=${jobId} AND j.project_id=${projectId} AND j.driver='workflows' AND j.status='running' AND j.run_claim IS NOT NULL AND a.provider='openai' AND a.outcome IN ('reserved','repair_reserved') AND EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(j.progress->'segments','[]'::jsonb)) s WHERE (s->>'idx')::int=a.segment_idx AND s->>'stage'=a.stage::text AND s->>'state' IN ('ok','retrying')) LIMIT 1`);
 return rows[0]??null;
}
