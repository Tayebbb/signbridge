import {test,expect} from "vitest";
import {sql} from "drizzle-orm";
import {mkdir,writeFile,readFile,mkdtemp,rm} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {resolve,join,sep} from "node:path";
import {performance} from "node:perf_hooks";
import {nativeBackend} from "./backend";
import {projectFixture,trackFor,NOW} from "../support";
import {claimRun} from "@/lib/db/queries/execution";
import {publishTrack} from "@/lib/db/queries/publish";
import {makeApi} from "@/lib/server/api";
import {createOwnerCapability,ownerCookieHeader} from "@/lib/auth/ownerCookie";
import {ensureOwner} from "@/lib/db/queries/api";
import {LocalSignedBlobs} from "@/lib/storage/urls";
import {quarantineRestoredDatabase} from "@/lib/db/queries/restore";
const evidence="docs/evidence/hardening-2026-11-05";
test("Local native PostgreSQL: 20 concurrent viewers and representative media history remain bounded",async()=>{
 const db=await nativeBackend();try{
  const cap=createOwnerCapability(),ownerId=await ensureOwner(db.store,cap.tokenHash),f=await projectFixture(db.store,{ownerId});expect(await claimRun(db.store,f.jobId,"load-fixture",NOW)).toBe(true);expect((await publishTrack(db.store,f.jobId,{runId:"load-fixture"},trackFor(f),NOW)).status).toBe("published");
  await db.store.query(sql`INSERT INTO media(project_id,blob_pathname,content_type,declared_bytes,size_bytes,client_sha256,client_duration_ms,status,reservation_expires_at,expires_at,storage_charge) SELECT ${f.projectId},'load/'||n,'video/mp4',32,32,repeat('a',64),2000,'ready',now()+interval '15 minutes',now()+interval '72 hours','committed' FROM generate_series(1,10000) n`);
  await db.store.query(sql`INSERT INTO storage_ledger(id,cap_bytes,transfer_cap_bytes,transfer_month,committed_bytes) VALUES (1,800000000,6000000000,to_char(now() AT TIME ZONE 'Asia/Dhaka','YYYY-MM'),320000)`);await db.store.query(sql`ANALYZE media`);
  const blobs=new LocalSignedBlobs(".data/unused"),api=makeApi({store:db.store,blobs,processingEnabled:false,defer:()=>{},dispatcher:async()=>({dispatch:async()=>{},reconcile:async()=>{}})}),latencies:number[]=[];const started=performance.now();
  await Promise.all(Array.from({length:20},async()=>{for(let i=0;i<10;i++){const before=performance.now(),r=await api(new Request("https://fixture.invalid/api/track",{headers:{cookie:ownerCookieHeader(cap.token)}}),"track",{projectId:f.projectId});expect(r.status).toBe(200);expect((await r.json()).media.url).toContain("/media/stream");latencies.push(performance.now()-before);}}));
  const elapsed=performance.now()-started;latencies.sort((a,b)=>a-b);const p95=latencies[Math.ceil(latencies.length*.95)-1];expect(latencies).toHaveLength(200);expect(p95).toBeLessThan(2000);
  const [ledger]=await db.store.query<{est_transfer_bytes:string}>(sql`SELECT est_transfer_bytes FROM storage_ledger WHERE id=1`);expect(BigInt(ledger.est_transfer_bytes)).toBe(0n);
  const plan=await db.store.query(sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM media WHERE project_id=${f.projectId} AND status='ready' AND client_sha256=repeat('a',64) ORDER BY created_at DESC,id DESC LIMIT 1`);
  await mkdir(evidence,{recursive:true});await writeFile(evidence+"/local-load.json",JSON.stringify({kind:"Local PostgreSQL 16 synthetic API workload; not hosted-capacity or linguistic evidence",viewers:20,requests:200,mediaRows:10000,elapsedMs:elapsed,p95Ms:p95,requestsPerSecond:200/(elapsed/1000),transferBytes:0,modelCalls:0,plan},null,2)+"\n");
 }finally{await db.close();}
});
test("A restored snapshot keeps immutable manifests but quarantines stale access and spending",async()=>{
 const source=await nativeBackend(),target=await nativeBackend(),base=resolve(".data"),root=await mkdtemp(join(base,"restore-drill-")),binary=process.env.PG_TEST_BIN??"C:/Program Files/PostgreSQL/16/bin",run=promisify(execFile);
 try{const f=await projectFixture(source.store);expect(await claimRun(source.store,f.jobId,"restore-fixture",NOW)).toBe(true);expect((await publishTrack(source.store,f.jobId,{runId:"restore-fixture"},trackFor(f),NOW)).status).toBe("published");
  await source.store.query(sql`UPDATE projects SET visibility='unlisted',share_token_hash=decode(repeat('aa',32),'hex')`);await source.store.query(sql`UPDATE owners SET recovery_hash=decode(repeat('bb',32),'hex')`);await source.store.query(sql`INSERT INTO spend_budgets(scope,cap_micros,spent_micros,reserved_micros) VALUES ('lifetime',1000,100,20) ON CONFLICT(scope) DO UPDATE SET cap_micros=excluded.cap_micros,spent_micros=excluded.spent_micros,reserved_micros=excluded.reserved_micros`);
  const [before]=await source.store.query<{manifest_hash:string}>(sql`SELECT manifest_hash FROM track_versions`);const file=join(root,"fixture.dump"),env:NodeJS.ProcessEnv={...process.env,PGPASSWORD:"",PGPASSFILE:join(root,"empty-password-file")};delete env.PGSERVICE;delete env.PGSERVICEFILE;await writeFile(env.PGPASSFILE!,"");
  const connection=["-h","127.0.0.1","-p",String(source.port),"-U","signbridge_test"];
  await run(join(binary,"pg_dump"),[...connection,"-d",source.databaseName,"--format=custom","--no-owner","--no-acl","--file",file],{windowsHide:true,env});
  await run(join(binary,"pg_restore"),[...connection,"-d",target.databaseName,"--clean","--if-exists","--no-owner","--no-acl",file],{windowsHide:true,env});
  expect(await quarantineRestoredDatabase(target.store)).toEqual({projectsQuarantined:1,ownersRevoked:1,processing:false});const [after]=await target.store.query<{manifest_hash:string}>(sql`SELECT manifest_hash FROM track_versions`);expect(after.manifest_hash).toBe(before.manifest_hash);
  const [access]=await target.store.query<{visibility:string;share_token_hash:Buffer|null}>(sql`SELECT visibility,share_token_hash FROM projects`);expect(access.share_token_hash).toBeNull();expect(access.visibility).toBe("private");
  const [budget]=await target.store.query<{cap_micros:string}>(sql`SELECT cap_micros FROM spend_budgets WHERE scope='lifetime'`);expect(BigInt(budget.cap_micros)).toBe(120n);const [owner]=await target.store.query<{recovery_hash:Buffer|null}>(sql`SELECT recovery_hash FROM owners`);expect(owner.recovery_hash).toBeNull();
  await mkdir(evidence,{recursive:true});await writeFile(evidence+"/restore-drill.json",JSON.stringify({kind:"Disposable local PostgreSQL logical backup/restore; not Neon PITR",manifestHashPreserved:true,staleAccessRevoked:true,processingPaused:true,budgetHeadroomZero:true,dumpBytes:(await readFile(file)).byteLength,modelCalls:0},null,2)+"\n");
 }finally{await source.close();await target.close();if(!resolve(root).startsWith(base+sep))throw Error("Unsafe restore fixture path");await rm(root,{recursive:true,force:true});}
});
