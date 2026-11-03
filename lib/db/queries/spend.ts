import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import type {SqlSession,StateStore} from "../session";
import {DAILY_CAP,LIFETIME_CAP,dayScope} from "../../domain/limits";
import {lockJob,hasAuthority,validProof,failLocked,StateError,type RunProof} from "./common";
interface BudgetRow {scope:string;cap_micros:string;spent_micros:string;reserved_micros:string}
export async function budgetsLocked(q:SqlSession,now:Date) {
  const day=dayScope(now);
  await q.query(sql`INSERT INTO spend_budgets(scope,cap_micros) VALUES ('lifetime',${LIFETIME_CAP.toString()}),(${day},${DAILY_CAP.toString()}) ON CONFLICT DO NOTHING`);
  return q.query<BudgetRow>(sql`SELECT * FROM spend_budgets WHERE scope IN ('lifetime',${day}) ORDER BY scope FOR UPDATE`);
}
export async function budgetSignalLocked(q:SqlSession,now:Date) {const rows=await budgetsLocked(q,now);return {downgrade:rows.some(r=>(BigInt(r.spent_micros)+BigInt(r.reserved_micros))*100n>=BigInt(r.cap_micros)*80n),closed:rows.some(r=>BigInt(r.spent_micros)+BigInt(r.reserved_micros)>=BigInt(r.cap_micros))};}
export async function budgetSignal(store:StateStore,now=new Date()) {return store.transaction(q=>budgetSignalLocked(q,now));}
export async function configureBudgets(store:StateStore,lifetime:bigint,daily:bigint,now=new Date()) {
  if(lifetime<0n||daily<0n)throw new StateError("invalid_budget");
  await store.transaction(async q=>{const rows=await budgetsLocked(q,now);for(const row of rows){const cap=row.scope==="lifetime"?lifetime:daily;if(cap<BigInt(row.spent_micros)+BigInt(row.reserved_micros))throw new StateError("budget_below_usage");await q.query(sql`UPDATE spend_budgets SET cap_micros=${cap.toString()} WHERE scope=${row.scope}`);}});
}
export interface ReserveAttempt {jobId:string;segmentIdx:number;stage:"meaning"|"plan";cacheKey:string;attemptNo:number;upperBound:bigint;repair?:boolean;proof:RunProof;provider?:"openai"|"fake"}
export async function reserveAttempt(store:StateStore,input:ReserveAttempt,now=new Date()) {
  if(!Number.isInteger(input.attemptNo)||input.attemptNo<1||input.attemptNo>4||input.upperBound<0n||!Number.isInteger(input.segmentIdx)||input.segmentIdx<0)throw new StateError("attempt_cap");
  return store.transaction(async q=>{
    const locked=await lockJob(q,input.jobId);if(!locked||!hasAuthority(locked.project,locked.job)||!validProof(locked.job,input.proof,now))return {status:"fenced" as const};
    const [switchRow]=await q.query<{value:boolean}>(sql`SELECT value FROM ops_settings WHERE key='processing'`);if(switchRow?.value===false){await failLocked(q,locked.project,locked.job,"processing_disabled",now);return {status:"processing_disabled" as const};}
    const key=`${input.jobId}|${input.segmentIdx}|${input.stage}|${input.attemptNo}`;
    const existing=(await q.query<{id:string;state:string;amount_micros:string}>(sql`SELECT * FROM spend_reservations WHERE attempt_key=${key} FOR UPDATE`))[0];
    if(existing)return {status:"reserved" as const,id:existing.id,created:false,state:existing.state,upperBound:BigInt(existing.amount_micros)};
    const attempts=await q.query<{outcome:string;attempt_no:number}>(sql`SELECT outcome,attempt_no FROM stage_attempts WHERE job_id=${input.jobId} AND segment_idx=${input.segmentIdx} AND stage=${input.stage}`);
    if(attempts.some(a=>a.attempt_no===input.attemptNo)||attempts.length>=4||input.repair&&attempts.some(a=>a.outcome.startsWith("repair_"))||!input.repair&&attempts.filter(a=>!a.outcome.startsWith("repair_")).length>=3)throw new StateError("attempt_cap");
    await budgetsLocked(q,now);const day=dayScope(now),bound=input.upperBound.toString();
    const updated=await q.query(sql`UPDATE spend_budgets SET reserved_micros=reserved_micros+${bound} WHERE scope IN ('lifetime',${day}) AND (SELECT count(*)=2 AND bool_and(spent_micros+reserved_micros+${bound}<=cap_micros) FROM spend_budgets WHERE scope IN ('lifetime',${day})) RETURNING scope`);
    if(updated.length!==2){await failLocked(q,locked.project,locked.job,"spend_cap",now);return {status:"spend_cap" as const};}
    const id=randomUUID();
    await q.query(sql`INSERT INTO spend_reservations(id,attempt_key,day_scope,amount_micros,created_at) VALUES (${id},${key},${day},${bound},${now})`);
    await q.query(sql`INSERT INTO stage_attempts(job_id,segment_idx,stage,cache_key,attempt_no,outcome,reservation_id,created_at,provider) VALUES (${input.jobId},${input.segmentIdx},${input.stage},${input.cacheKey},${input.attemptNo},${input.repair?"repair_reserved":"reserved"},${id},${now},${input.provider??"unknown"})`);
    return {status:"reserved" as const,id,created:true,state:"reserved",upperBound:input.upperBound};
  });
}
interface ReservationRow {id:string;state:string;attempt_key:string;day_scope:string;amount_micros:string}
export async function settleLocked(q:SqlSession,row:ReservationRow,mode:"settled"|"held_uncertain"|"released",actual:bigint,now:Date,usage?:{inputTokens:number;outputTokens:number;reasoningTokens?:number},outcome="usage") {
  if(row.state!=="reserved")return false;
  const bound=BigInt(row.amount_micros),cost=mode==="held_uncertain"?bound:mode==="released"?0n:actual>bound?bound:actual;
  if(cost<0n)throw new StateError("invalid_usage");
  await q.query(sql`SELECT scope FROM spend_budgets WHERE scope IN ('lifetime',${row.day_scope}) ORDER BY scope FOR UPDATE`);
  const budgets=await q.query(sql`UPDATE spend_budgets SET reserved_micros=reserved_micros-${bound.toString()},spent_micros=spent_micros+${cost.toString()} WHERE scope IN ('lifetime',${row.day_scope}) AND reserved_micros>=${bound.toString()} RETURNING scope`);
  if(budgets.length!==2)throw new StateError("ledger_inconsistent");
  await q.query(sql`UPDATE spend_reservations SET state=${mode},actual_micros=${mode==="settled"?cost.toString():null},resolved_at=${now} WHERE id=${row.id}`);
  await q.query(sql`UPDATE stage_attempts SET outcome=CASE WHEN outcome LIKE 'repair_%' THEN 'repair_'||${outcome} ELSE ${outcome} END,cost_usd_micros=${cost.toString()},input_tokens=${usage?.inputTokens??null},output_tokens=${usage?.outputTokens??null},reasoning_tokens=${usage?.reasoningTokens??null},latency_ms=greatest(0,least(2147483647,floor(extract(epoch FROM(${now}::timestamptz-created_at))*1000)))::int,error_code=${["usage","completed","cache_hit"].includes(outcome)?null:outcome} WHERE reservation_id=${row.id}`);return true;
}
export async function settleAttempt(store:StateStore,reservationId:string,proof:RunProof,mode:"settled"|"held_uncertain"|"released",actual=0n,now=new Date(),usage?:{inputTokens:number;outputTokens:number;reasoningTokens?:number},outcome="usage") {
  const reference=(await store.query<{attempt_key:string}>(sql`SELECT attempt_key FROM spend_reservations WHERE id=${reservationId}`))[0];if(!reference)return false;
  return store.transaction(async q=>{const locked=await lockJob(q,reference.attempt_key.split("|")[0]);if(!locked||!validProof(locked.job,proof,now))return false;
    const row=(await q.query<ReservationRow>(sql`SELECT * FROM spend_reservations WHERE id=${reservationId} FOR UPDATE`))[0];return row?settleLocked(q,row,mode,actual,now,usage,outcome):false;});
}
export async function sweepSpend(store:StateStore,now=new Date()) {
  const candidates=await store.query<{id:string}>(sql`SELECT id FROM spend_reservations WHERE state='reserved' AND created_at<${new Date(now.getTime()-600_000)} ORDER BY created_at,id`);let count=0;
  for(const item of candidates)count+=Number(await store.transaction(async q=>{const row=(await q.query<ReservationRow>(sql`SELECT * FROM spend_reservations WHERE id=${item.id} FOR UPDATE`))[0];return row?settleLocked(q,row,"held_uncertain",0n,now,undefined,"uncertain"):false;}));return count;
}
