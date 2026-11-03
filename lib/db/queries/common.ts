import {sql} from "drizzle-orm";
import type {SqlSession} from "../session";
export class StateError extends Error {constructor(public readonly code:string,message=code){super(message);this.name="StateError";}}
export interface ProjectRow {id:string;owner_id:string;title:string;status:string;processing_epoch:string|bigint;current_transcript_version_id:string|null;current_track_version_id:string|null;active_job_id:string|null;lock_version:number}
export interface JobRow {id:string;project_id:string;transcript_version_id:string;processing_epoch:string|bigint;status:string;cancel_requested:boolean;run_claim:string|null;driver:string;lease_owner:string|null;lease_epoch:string|bigint;lease_expires_at:Date|string|null;heartbeat_at:Date|string|null;result_track_version_id:string|null;dispatch_state:string;dispatch_attempts:number;workflow_run_id:string|null;progress:Record<string,unknown>}
export interface RunProof {runId?:string;leaseOwner?:string;leaseEpoch?:bigint}
export async function lockProject(q:SqlSession,id:string,active=false) {const p=(await q.query<ProjectRow>(sql`SELECT * FROM projects WHERE id=${id} FOR UPDATE`))[0];if(active&&(!p||p.status!=="active"))throw new StateError("not_found");return p??null;}
export async function lockJob(q:SqlSession,id:string) {
  const ref=(await q.query<{project_id:string}>(sql`SELECT project_id FROM jobs WHERE id=${id}`))[0];if(!ref)return null;
  const project=await lockProject(q,ref.project_id);if(!project)return null;
  const job=(await q.query<JobRow>(sql`SELECT * FROM jobs WHERE id=${id} FOR UPDATE`))[0];return job?{project,job}:null;
}
export function validProof(job:JobRow,proof:RunProof,now:Date) {
  return job.driver==="lease"?proof.leaseEpoch!==undefined&&BigInt(job.lease_epoch)===proof.leaseEpoch&&job.lease_owner===proof.leaseOwner&&!!job.lease_expires_at&&new Date(job.lease_expires_at)>now:!!proof.runId&&job.run_claim===proof.runId;
}
export function hasAuthority(project:ProjectRow,job:JobRow) {return project.status==="active"&&project.active_job_id===job.id&&project.current_transcript_version_id===job.transcript_version_id&&BigInt(project.processing_epoch)===BigInt(job.processing_epoch)&&["queued","running"].includes(job.status)&&!job.cancel_requested;}
export async function failLocked(q:SqlSession,project:ProjectRow,job:JobRow,code:string,now:Date) {
  await q.query(sql`UPDATE jobs SET status='failed',last_error=${JSON.stringify({code})}::jsonb,finished_at=${now},updated_at=${now} WHERE id=${job.id} AND status IN ('queued','running')`);
  if(project.active_job_id===job.id)await q.query(sql`UPDATE projects SET active_job_id=NULL,processing_epoch=processing_epoch+1 WHERE id=${project.id}`);
}
