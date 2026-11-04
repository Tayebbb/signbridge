import {beforeAll,beforeEach,afterAll,test,expect} from "vitest";
import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {createDatabase,type Database} from "@/lib/db/client";
import {makeApi} from "@/lib/server/api";
import {LocalSignedBlobs} from "@/lib/storage/urls";
import {createOwnerCapability,ownerCookieHeader} from "@/lib/auth/ownerCookie";
import {ensureOwner,processingAllowed,setProcessing,consumeRate} from "@/lib/db/queries/api";
import {reserveMedia,finalizeMedia} from "@/lib/db/queries/storage";
import {claimRun} from "@/lib/db/queries/execution";
import {publishTrack} from "@/lib/db/queries/publish";
import {applyErrorKillSwitch} from "@/lib/db/queries/operations";
import {initMedia,sweepStorage} from "@/lib/ops/storage";
import {projectFixture,trackFor,NOW} from "../race/support";
import {trackIdFor,trackFingerprint} from "@/lib/domain/fingerprints";
import {TrackStore} from "@/lib/player/store";
import {configureBudgets,budgetSignal} from "@/lib/db/queries/spend";
let db:Database;
beforeAll(async()=>{db=await createDatabase();await db.migrate();});
beforeEach(async()=>{await db.state.query(sql`TRUNCATE owners,storage_ledger,stage_results,rate_windows,ops_settings,spend_budgets,spend_reservations CASCADE`);});
afterAll(async()=>{await db.close();});
async function saved(){
 const cap=createOwnerCapability(),ownerId=await ensureOwner(db.state,cap.tokenHash),f=await projectFixture(db.state,{ownerId});
 const media=await reserveMedia(db.state,{projectId:f.projectId,declaredBytes:12_000_000,contentType:"video/mp4",clientSha256:"a".repeat(64),clientDurationMs:2000});await finalizeMedia(db.state,media.id,{size:12_000_000,contentType:"video/mp4"});
 const run=randomUUID();expect(await claimRun(db.state,f.jobId,run)).toBe(true);const manifest=trackFor(f);manifest.media.sizeBytes=12_000_000;manifest.trackVersionId=trackIdFor(f.jobId,trackFingerprint(manifest));expect((await publishTrack(db.state,f.jobId,{runId:run},manifest)).status).toBe("published");
 return {...f,media,cap};
}
test("Stable pointer polling neither reissues video URLs nor consumes transfer bytes",async()=>{
 const f=await saved(),blobs=new LocalSignedBlobs(".data/unused");let issued=0,downloads=0;
 const sign=blobs.sign.bind(blobs);blobs.sign=async(...args)=>{issued++;return sign(...args);};blobs.get=async()=>{downloads++;return new Uint8Array();};
 const api=makeApi({store:db.state,blobs,processingEnabled:false,defer:()=>{},dispatcher:async()=>({dispatch:async()=>{},reconcile:async()=>{}})});
 const fetcher:typeof fetch=async(input,init)=>{const url=new URL(String(input),"https://audit.invalid");const headers=new Headers(init?.headers);headers.set("cookie",ownerCookieHeader(f.cap.token));return api(new Request(url,{headers}),url.pathname.endsWith("/track")?"track":"manifest",url.pathname.endsWith("/track")?{projectId:f.projectId}:{trackId:url.pathname.split("/")[3]});};
 const store=new TrackStore(f.projectId,fetcher);const first=await store.refresh();for(let i=0;i<12;i++)await store.refresh();
 const [ledger]=await db.state.query<{est_transfer_bytes:string}>(sql`SELECT est_transfer_bytes FROM storage_ledger WHERE id=1`);
 expect(issued).toBe(0);expect(downloads).toBe(0);expect(BigInt(ledger.est_transfer_bytes)).toBe(0n);expect(store.current?.media.url).toBe(first?.current.media.url);
});
test("One failed expiry deletion leaves its charge intact and does not block unrelated admission",async()=>{
 const f=await saved(),other=await projectFixture(db.state,{ownerId:f.ownerId,job:false}),blobs=new LocalSignedBlobs(".data/unused");let errors=0;blobs.remove=async()=>{throw Error("controlled outage");};const later=new Date(Date.now()+73*3600000);
 expect(await sweepStorage(db.state,blobs,later,5,undefined,()=>{errors++;})).toBe(0);expect(errors).toBe(1);
 await expect(initMedia(db.state,blobs,{projectId:other.projectId,declaredBytes:32,contentType:"video/mp4",clientSha256:"b".repeat(64),clientDurationMs:2000},later)).resolves.toHaveProperty("id");
 const [ledger]=await db.state.query<{committed_bytes:string;pending_bytes:string}>(sql`SELECT committed_bytes,pending_bytes FROM storage_ledger WHERE id=1`);expect(BigInt(ledger.committed_bytes)).toBe(12_000_000n);expect(BigInt(ledger.pending_bytes)).toBe(32n);
});
test("Circuit cooldown needs a sample, expires automatically, and never reverses an admin stop",async()=>{
 const f=await projectFixture(db.state);
 const attempt=async(i:number,outcome:string)=>{await db.state.query(sql`INSERT INTO stage_attempts(job_id,segment_idx,stage,cache_key,attempt_no,outcome,provider,created_at) VALUES (${f.jobId},${i},'meaning',${`fixture-${i}`},1,${outcome},'openai',${NOW})`);};
 await attempt(0,"error");expect(await applyErrorKillSwitch(db.state,NOW)).toBe(false);expect(await processingAllowed(db.state,true,NOW)).toBe(true);
 for(let i=1;i<5;i++)await attempt(i,i<3?"error":"completed");expect(await applyErrorKillSwitch(db.state,NOW)).toBe(true);expect(await processingAllowed(db.state,true,NOW)).toBe(false);
 const later=new Date(NOW.getTime()+11*60000);expect(await applyErrorKillSwitch(db.state,later)).toBe(false);expect(await processingAllowed(db.state,true,later)).toBe(true);
 await setProcessing(db.state,false);expect(await processingAllowed(db.state,true,later)).toBe(false);
});
test("Read rate windows renew independently of the existing hourly mutation limit",async()=>{
 await consumeRate(db.state,["read:fixture"],2,NOW,60000);await consumeRate(db.state,["read:fixture"],2,NOW,60000);await expect(consumeRate(db.state,["read:fixture"],2,NOW,60000)).rejects.toMatchObject({code:"rate_limited"});await expect(consumeRate(db.state,["read:fixture"],2,new Date(NOW.getTime()+60000),60000)).resolves.toBeUndefined();
});
test("A new budget day inherits the smaller configured cap instead of restoring a larger default",async()=>{await configureBudgets(db.state,500n,120n,NOW);await budgetSignal(db.state,new Date(NOW.getTime()+86400000));const rows=await db.state.query<{cap_micros:string}>(sql`SELECT cap_micros FROM spend_budgets WHERE scope LIKE 'day:%' ORDER BY scope`);expect(rows.map(r=>BigInt(r.cap_micros))).toEqual([120n,120n]);});
test("Recovery revokes old creator sessions, replaces old recovery keys and rejects foreign/CSRF requests",async()=>{
 const f=await saved(),blobs=new LocalSignedBlobs(".data/unused"),api=makeApi({store:db.state,blobs,processingEnabled:false,defer:()=>{},dispatcher:async()=>({dispatch:async()=>{},reconcile:async()=>{}})});
 const post=(action:"ownerRecovery"|"recoverOwner",body:unknown,cookie="",origin="https://audit.invalid")=>api(new Request("https://audit.invalid/api/owner",{method:"POST",headers:{origin,cookie,"content-type":"application/json"},body:JSON.stringify(body)}),action);
 expect((await post("ownerRecovery",{})).status).toBe(404);expect((await post("ownerRecovery",{},ownerCookieHeader(f.cap.token),"https://foreign.invalid")).status).toBe(403);
 const old=(await (await post("ownerRecovery",{},ownerCookieHeader(f.cap.token))).json()).recoveryKey;
 const key=(await (await post("ownerRecovery",{},ownerCookieHeader(f.cap.token))).json()).recoveryKey;
 expect((await post("recoverOwner",{recoveryKey:old})).status).toBe(400);
 const restored=await post("recoverOwner",{recoveryKey:key});expect(restored.status).toBe(200);const nextCookie=restored.headers.get("set-cookie")!;expect(nextCookie).toContain("Max-Age=15552000");
 const get=(cookie:string)=>api(new Request("https://audit.invalid/api/project",{headers:{cookie}}),"getProject",{projectId:f.projectId});
 expect((await get(ownerCookieHeader(f.cap.token))).status).toBe(404);expect((await get(nextCookie)).status).toBe(200);
 const rows=await db.state.query<{recovery_hash:Buffer}>(sql`SELECT recovery_hash FROM owners WHERE id=${f.ownerId}`);expect(rows[0].recovery_hash.toString()).not.toContain(key);
});
test("Video stream checks authorization on every range read and debits only actual upstream access",async()=>{
 const f=await saved(),blobs=new LocalSignedBlobs(".data/unused");let reads=0;blobs.get=async()=>{reads++;return new Uint8Array(12_000_000).fill(7);};
 const api=makeApi({store:db.state,blobs,processingEnabled:false,defer:()=>{},dispatcher:async()=>({dispatch:async()=>{},reconcile:async()=>{}})});
 const get=(cookie:string,range:string)=>api(new Request("https://audit.invalid/api/media",{headers:{cookie,range}}),"mediaStream",{projectId:f.projectId});
 expect((await get("","bytes=0-1")).status).toBe(404);expect((await get(ownerCookieHeader(f.cap.token),"bytes=12000000-")).status).toBe(416);expect(reads).toBe(0);
 const r=await get(ownerCookieHeader(f.cap.token),"bytes=1-2");expect(r.status).toBe(206);expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([7,7]);expect(r.headers.get("content-range")).toBe("bytes 1-2/12000000");
 const [ledger]=await db.state.query<{est_transfer_bytes:string}>(sql`SELECT est_transfer_bytes FROM storage_ledger WHERE id=1`);expect(BigInt(ledger.est_transfer_bytes)).toBe(12_000_000n);expect(reads).toBe(1);
 await db.state.query(sql`UPDATE storage_ledger SET est_transfer_bytes=transfer_cap_bytes`);expect((await get(ownerCookieHeader(f.cap.token),"bytes=0-1")).status).toBe(503);expect(reads).toBe(1);
});
