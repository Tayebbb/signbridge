import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
import {lockJob,hasAuthority,validProof,failLocked,StateError,type RunProof} from "./common";
export async function claimRun(store:StateStore,jobId:string,runId:string,now=new Date()) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||!hasAuthority(locked.project,locked.job)||locked.job.driver!=="workflows")return false;
    const rows=await q.query(sql`UPDATE jobs SET run_claim=${runId},status='running',heartbeat_at=${now},updated_at=${now} WHERE id=${jobId} AND (run_claim IS NULL OR run_claim=${runId}) AND status IN ('queued','running') AND cancel_requested=false RETURNING id`);return rows.length===1;});
}
export async function acknowledgeRun(store:StateStore,jobId:string,runId:string) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||locked.job.run_claim!==runId)throw new StateError("run_not_owned","Dispatch run does not own the job");
    await q.query(sql`UPDATE jobs SET dispatch_state='started',workflow_run_id=${runId},dispatch_attempts=dispatch_attempts+1 WHERE id=${jobId} AND dispatch_state='pending'`);});
}
export async function acknowledgeKnownRun(store:StateStore,jobId:string) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||!hasAuthority(locked.project,locked.job)||!locked.job.run_claim)return;
    await q.query(sql`UPDATE jobs SET dispatch_state='started',workflow_run_id=run_claim,dispatch_attempts=dispatch_attempts+1 WHERE id=${jobId} AND dispatch_state='pending'`);});
}
/** start() confirms the transport run before its first step has claimed authority. */
export async function recordWorkflowRun(store:StateStore,jobId:string,runId:string){await store.transaction(async q=>{
  const locked=await lockJob(q,jobId);if(!locked||!hasAuthority(locked.project,locked.job))return;
  if(locked.job.run_claim&&locked.job.run_claim!==runId)return;
  await q.query(sql`UPDATE jobs SET dispatch_state='started',workflow_run_id=${runId},dispatch_attempts=dispatch_attempts+1 WHERE id=${jobId} AND dispatch_state='pending'`);
});}
export async function pendingDispatches(store:StateStore,now?:Date,projectId?:string) {
  return store.query<{id:string}>(sql`SELECT j.id FROM jobs j JOIN projects p ON p.id=j.project_id WHERE p.status='active' AND p.active_job_id=j.id AND j.dispatch_state='pending' AND j.driver='workflows' AND j.status IN ('queued','running') AND NOT j.cancel_requested AND j.dispatch_attempts<5 ${now?sql`AND j.created_at<${new Date(now.getTime()-30_000)}`:sql``} ${projectId?sql`AND p.id=${projectId}`:sql``} ORDER BY j.created_at,j.id`);
}
export async function canDispatch(store:StateStore,jobId:string){const rows=await store.query(sql`SELECT id FROM jobs WHERE id=${jobId} AND status IN ('queued','running') AND dispatch_state='pending' AND NOT cancel_requested AND dispatch_attempts<5`);return rows.length>0;}
export async function recordDispatchFailure(store:StateStore,jobId:string) {await store.transaction(async q=>{const locked=await lockJob(q,jobId);if(locked&&hasAuthority(locked.project,locked.job)){
 const rows=await q.query<{dispatch_attempts:number}>(sql`UPDATE jobs SET dispatch_attempts=dispatch_attempts+1,last_error='{"code":"dispatch_failed"}'::jsonb WHERE id=${jobId} AND dispatch_state='pending' AND dispatch_attempts<5 RETURNING dispatch_attempts`);
 if(rows[0]?.dispatch_attempts>=5&&!locked.job.run_claim)await failLocked(q,locked.project,locked.job,"dispatch_exhausted",new Date());
}});}
export async function heartbeat(store:StateStore,jobId:string,proof:RunProof,now=new Date()) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||!hasAuthority(locked.project,locked.job)||!validProof(locked.job,proof,now))return false;await q.query(sql`UPDATE jobs SET heartbeat_at=${now},updated_at=${now} WHERE id=${jobId}`);return true;});
}
export async function claimLease(store:StateStore,jobId:string,owner:string,now=new Date()) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||!hasAuthority(locked.project,locked.job)||locked.job.driver!=="lease")return null;
    const rows=await q.query<{lease_epoch:string}>(sql`UPDATE jobs SET lease_owner=${owner},lease_expires_at=${new Date(now.getTime()+150_000)},lease_epoch=lease_epoch+1,status='running',heartbeat_at=${now} WHERE id=${jobId} AND (lease_expires_at IS NULL OR lease_expires_at<${now}) RETURNING lease_epoch`);
    return rows[0]?{leaseOwner:owner,leaseEpoch:BigInt(rows[0].lease_epoch)}:null;});
}
export async function releaseLease(store:StateStore,jobId:string,proof:RunProof,now=new Date()) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||!validProof(locked.job,proof,now))return false;await q.query(sql`UPDATE jobs SET lease_owner=NULL,lease_expires_at=NULL WHERE id=${jobId}`);return true;});
}
