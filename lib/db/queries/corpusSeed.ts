import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
/** Offline-only: statements from the committed seed, never from HTTP or model content. */
export async function applyCorpusSeed(store:StateStore,committedSql:string){
  const statements=committedSql.trimEnd().split("\n");
  if(statements.length>10000||statements.some(s=>!/^INSERT INTO (corpus_releases|sign_assets|asset_aliases)\(/u.test(s)))throw Error("Unexpected corpus seed shape");
  await store.transaction(async q=>{for(const statement of statements)await q.query(sql.raw(statement));});
}
