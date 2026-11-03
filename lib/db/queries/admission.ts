import type {StateStore} from "../session";
import {budgetsLocked} from "./spend";
import {sql} from "drizzle-orm";
export async function jobCanFitMinimum(store:StateStore,jobId:string){return store.transaction(async q=>{
  const [j]=await q.query<{model_profile:string;status:string}>(sql`SELECT model_profile,status FROM jobs WHERE id=${jobId}`);if(!j)return false;
  if(!["queued","running"].includes(j.status))return true;
  const minimum=j.model_profile==="gpt-6.1-terra"?20_000n:40_000n;
  return (await budgetsLocked(q,new Date())).every(b=>BigInt(b.spent_micros)+BigInt(b.reserved_micros)+minimum<=BigInt(b.cap_micros));
});}
