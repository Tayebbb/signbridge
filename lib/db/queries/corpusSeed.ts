import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
/** Offline-only: statements from the committed seed, never from HTTP or model content. */
export async function applyCorpusSeed(store:StateStore,committedSql:string){
  const statements=committedSql.trimEnd().split(/\r?\n/u);
  if(statements.length>10000||statements.some(s=>!/^INSERT INTO (corpus_releases|sign_assets|asset_aliases)\(/u.test(s)))throw Error("Unexpected corpus seed shape");
  // One network round trip per row makes the full corpus impractical on Neon.
  // Combine only adjacent inserts with identical columns and conflict policy;
  // the release/assets/aliases ordering and one atomic transaction are retained.
  const batches:{prefix:string;suffix:string;rows:string[]}[]=[];
  for(const statement of statements){
    const prefix=statement.match(/^INSERT INTO (?:corpus_releases|sign_assets|asset_aliases)\([a-z0-9_,]+\) VALUES /u)?.[0];
    const conflict=statement.lastIndexOf(" ON CONFLICT");
    if(!prefix||conflict<prefix.length||!statement.endsWith(";"))throw Error("Unexpected corpus seed shape");
    const suffix=statement.slice(conflict),row=statement.slice(prefix.length,conflict),previous=batches.at(-1);
    if(previous&&previous.prefix===prefix&&previous.suffix===suffix&&previous.rows.length<100)previous.rows.push(row);
    else batches.push({prefix,suffix,rows:[row]});
  }
  await store.transaction(async q=>{for(const batch of batches)await q.query(sql.raw(batch.prefix+batch.rows.join(",")+batch.suffix));});
}
