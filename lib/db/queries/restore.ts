import {sql} from "drizzle-orm";
import {randomBytes} from "node:crypto";
import type {StateStore} from "../session";
/** Run only against an isolated restored snapshot before it can receive public traffic. */
export async function quarantineRestoredDatabase(store:StateStore){return store.transaction(async q=>{
 await q.query(sql`INSERT INTO ops_settings(key,value) VALUES ('processing','false') ON CONFLICT(key) DO UPDATE SET value='false'`);
 await q.query(sql`UPDATE jobs SET status='cancelled',cancel_requested=true,finished_at=now(),updated_at=now() WHERE status IN ('queued','running')`);
 const projects=await q.query(sql`UPDATE projects SET share_token_hash=NULL,share_created_at=NULL,visibility='private',active_job_id=NULL,processing_epoch=processing_epoch+1,lock_version=lock_version+1 RETURNING id`);
 const owners=await q.query<{id:string}>(sql`SELECT id FROM owners ORDER BY id FOR UPDATE`);
 for(const owner of owners)await q.query(sql`UPDATE owners SET token_hash=${randomBytes(32)},recovery_hash=NULL WHERE id=${owner.id}`);
 await q.query(sql`UPDATE spend_budgets SET cap_micros=spent_micros+reserved_micros`);
 return {projectsQuarantined:projects.length,ownersRevoked:owners.length,processing:false as const};
});}
