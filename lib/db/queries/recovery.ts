import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
import {StateError} from "./common";
export async function setRecovery(store:StateStore,ownerId:string,recoveryHash:Buffer){const rows=await store.query(sql`UPDATE owners SET recovery_hash=${recoveryHash} WHERE id=${ownerId} RETURNING id`);if(!rows.length)throw new StateError("not_found");}
export async function recoverOwner(store:StateStore,recoveryHash:Buffer,tokenHash:Buffer){return store.transaction(async q=>{const rows=await q.query<{id:string}>(sql`UPDATE owners SET token_hash=${tokenHash},last_seen_at=now() WHERE recovery_hash=${recoveryHash} RETURNING id`);if(!rows.length)throw new StateError("invalid_recovery");return rows[0].id;});}
