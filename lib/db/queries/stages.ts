import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
import {lockJob,hasAuthority,validProof,StateError,type RunProof} from "./common";
import {hash} from "../../domain/fingerprints";
export interface StageResultInput {cacheKey:string;stage:"meaning"|"plan";schemaVersion:string;modelId:string;promptVersion:string;output:unknown;validation:unknown}
export async function writeStageResult(store:StateStore,jobId:string,proof:RunProof,input:StageResultInput,now=new Date()) {
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||locked.project.status!=="active"||!validProof(locked.job,proof,now))return null;
    await q.query(sql`INSERT INTO stage_results(cache_key,stage,schema_version,model_id,prompt_version,output,output_hash,validation,created_at) VALUES (${input.cacheKey},${input.stage},${input.schemaVersion},${input.modelId},${input.promptVersion},${JSON.stringify(input.output)}::jsonb,${hash(input.output)},${JSON.stringify(input.validation)}::jsonb,${now}) ON CONFLICT(cache_key) DO NOTHING`);
    const row=(await q.query<{cache_key:string;output:unknown;output_hash:string}>(sql`SELECT cache_key,output,output_hash FROM stage_results WHERE cache_key=${input.cacheKey} FOR UPDATE`))[0];
    await q.query(sql`INSERT INTO stage_result_refs(project_id,cache_key) VALUES (${locked.project.id},${input.cacheKey}) ON CONFLICT DO NOTHING`);
    await q.query(sql`UPDATE jobs SET heartbeat_at=${now},updated_at=${now} WHERE id=${jobId}`);return {cache_key:row.cache_key,output:row.output,output_hash:row.output_hash};});
}
export async function cachedStage(store:StateStore,jobId:string,proof:RunProof,key:string,stage:"meaning"|"plan",segmentIdx:number,attemptNo=1,now=new Date()) {
  if(!Number.isInteger(attemptNo)||attemptNo<1||attemptNo>4)throw new StateError("attempt_cap");
  return store.transaction(async q=>{const locked=await lockJob(q,jobId);if(!locked||!hasAuthority(locked.project,locked.job)||!validProof(locked.job,proof,now))return null;
    const row=(await q.query<{cache_key:string;output:unknown;output_hash:string;model_id:string}>(sql`SELECT cache_key,output,output_hash,model_id FROM stage_results WHERE cache_key=${key} AND stage=${stage} FOR UPDATE`))[0];if(!row)return null;
    await q.query(sql`INSERT INTO stage_result_refs(project_id,cache_key) VALUES (${locked.project.id},${key}) ON CONFLICT DO NOTHING`);
    await q.query(sql`INSERT INTO stage_attempts(job_id,segment_idx,stage,cache_key,attempt_no,outcome,created_at,provider) VALUES (${jobId},${segmentIdx},${stage},${key},${attemptNo},'cache_hit',${now},${row.model_id.startsWith("fake/")?"fake":row.model_id.startsWith("gpt-")?"openai":"unknown"}) ON CONFLICT DO NOTHING`);
    await q.query(sql`UPDATE jobs SET heartbeat_at=${now},updated_at=${now} WHERE id=${jobId}`);return {cache_key:row.cache_key,output:row.output,output_hash:row.output_hash};});
}
