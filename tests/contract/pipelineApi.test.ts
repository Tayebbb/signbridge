import {beforeAll,beforeEach,afterAll,test,expect} from "vitest";
import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {resolve,sep} from "node:path";
import {createDatabase,type Database} from "@/lib/db/client";
import {makeApi,type Action} from "@/lib/server/api";
import {handleLocalBlob} from "@/lib/server/localBlob";
import {LocalSignedBlobs} from "@/lib/storage/urls";
import {LocalPipelineDispatcher} from "@/lib/jobs/localDispatcher";
import {FakeModelClient,responseBody} from "@/lib/ai/client";
import {deterministicFake} from "@/lib/ai/fakeFixtures";
import {ModelFailure} from "@/lib/ai/protocol";
import {claimPipeline,processStage,finishPipeline,runPipeline,type Pipeline} from "@/lib/jobs/steps";
import {createOwnerCapability,ownerCookieHeader} from "@/lib/auth/ownerCookie";
import {deleteProject} from "@/lib/db/queries/authority";
import {reconcile} from "@/lib/ops/reconcile";
import {configureBudgets} from "@/lib/db/queries/spend";
import {stageAttemptsFor,loadJob,ensureOwner} from "@/lib/db/queries/api";
import {asset} from "../fixtures/domain";
let db:Database,root:string,blobs:LocalSignedBlobs,pipeline:Pipeline,model:FakeModelClient,api:ReturnType<typeof makeApi>,cookie:string;
let deferred:(()=>Promise<void>)[]=[];
beforeAll(async()=>{db=await createDatabase();await db.migrate();await mkdir(".data",{recursive:true});root=await mkdtemp(resolve(".data","phase4-api-"));blobs=new LocalSignedBlobs(root);});
afterAll(async()=>{await db?.close();if(root){const target=resolve(root);if(!target.startsWith(resolve(".data")+sep))throw Error("Unsafe test cleanup");await rm(target,{recursive:true,force:true});}});
beforeEach(async()=>{
  await db.state.query(sql`TRUNCATE owners,corpus_releases,storage_ledger,spend_budgets,spend_reservations,stage_results,api_requests,rate_windows,ops_settings CASCADE`);
  await db.state.query(sql`INSERT INTO corpus_releases(id,doi,license,attribution,manifest_sha256) VALUES ('ik2-mendeley-v2','fixture','CC-BY-4.0','Engineering fixture only','fixture')`);
  for(const [i,label] of ["আমি","আসবে"].entries()){const a=asset(label,i+1);await db.state.query(sql`INSERT INTO sign_assets(id,corpus_release_id,kind,label_bn,label_phrase_form,source_paths,original_sha256,derived_sha256,derived_sigml,unit_count,units,derivation_version,render_state,eligible) VALUES (${a.id},'ik2-mendeley-v2','lexical',${label},${a.labelPhraseForm},ARRAY['fixture'],${String(i)},${a.derivedSha256},${a.derivedSigml},1,'[]','fixture','rendered_ok',true)`);}
  model=deterministicFake();pipeline={store:db.state,model,hooks:{sleep:async()=>{}}};deferred=[];cookie="";
  api=makeApi({store:db.state,blobs,processingEnabled:true,adminToken:"fixture-admin",cronSecret:"fixture-cron",defer:work=>deferred.push(work),dispatcher:async()=>new LocalPipelineDispatcher(pipeline)});
});
async function request(action:Action,path:string,method="GET",input?:unknown,params:Record<string,string>={},options:{cookie?:string;origin?:string;key?:string;etag?:string;authorization?:string}={}){
  const headers=new Headers({origin:options.origin??"http://localhost",cookie:options.cookie??cookie,"idempotency-key":options.key??randomUUID(),...(options.etag?{"if-none-match":options.etag}:{}),...(options.authorization?{authorization:options.authorization}:{})});
  const r=await api(new Request(`http://localhost${path}`,{method,headers,...(input===undefined?{}:{body:JSON.stringify(input)})}),action,params);
  if(r.headers.has("set-cookie"))cookie=r.headers.get("set-cookie")!.split(";")[0];return r;
}
async function project(text="আমি আসবে।"){
  const created=await request("createProject","/api/projects","POST",{title:"Fixture",rightsAttested:true});expect(created.status).toBe(201);const {projectId}=await created.json(),params={projectId};
  const init=await request("mediaInit","/init","POST",{contentType:"video/mp4",sizeBytes:32,sha256:"a".repeat(64),durationMs:4000,width:320,height:240},params);expect(init.status).toBe(200);const {mediaId}=await init.json();
  const [media]=await db.state.query<{blob_pathname:string}>(sql`SELECT blob_pathname FROM media WHERE id=${mediaId}`);await blobs.put(media.blob_pathname,new Uint8Array(32));
  expect((await request("mediaFinalize","/finalize","POST",{mediaId},params)).status).toBe(200);
  const tv=await request("transcripts","/transcripts","POST",{format:"srt",text:`1\n00:00:00,000 --> 00:00:02,000\n${text}`},params);expect(tv.status).toBe(201);const body=await tv.json();expect(body.jobId).toBeNull();
  return {projectId,params,transcriptVersionId:body.transcriptVersion.id};
}
async function start(f:Awaited<ReturnType<typeof project>>){const response=await request("startJob","/jobs","POST",{transcriptVersionId:f.transcriptVersionId},f.params);return {response,jobId:response.status===202?(await response.clone().json()).jobId:""};}
async function drain(){while(deferred.length)await deferred.shift()!();}
async function current(f:Awaited<ReturnType<typeof project>>){const response=await request("track","/track","GET",undefined,f.params);expect(response.status).toBe(200);const pointer=await response.json(),manifest=await request("manifest","/manifest","GET",undefined,{trackId:pointer.trackVersionId});expect(manifest.status).toBe(200);return {pointer,manifest:await manifest.clone().json(),response:manifest};}
function artifact(pointer:{trackVersionId:string;manifestHash:string;overlays:unknown}){return {trackVersionId:pointer.trackVersionId,manifestHash:pointer.manifestHash,overlays:pointer.overlays};}

test("T4 through routes: upload, draft, job and fully supported published manifest",async()=>{
  const f=await project(),{response,jobId}=await start(f);expect(response.status).toBe(202);await drain();const result=await current(f);
  expect(result.manifest.segments[0]).toMatchObject({technicalStatus:"ready",criticalGaps:[]});expect(result.manifest.provenance.modelProfile).toBe("fake/gpt-6.1-sol");expect(model.calls).toHaveLength(2);
  const progress=await request("getJob","/job","GET",undefined,{jobId}),etag=progress.headers.get("etag")!;expect((await progress.json()).status).toBe("succeeded");expect((await request("getJob","/job","GET",undefined,{jobId},{etag})).status).toBe(304);await drain();
});
test.each(["আমি আসবে না।","আমি ২ আসবে।","আমি নক্ষত্র আসবে।"])("T5 through routes: missing critical content in %s remains blocked",async text=>{
  const f=await project(text);await start(f);await drain();const {manifest}=await current(f);expect(manifest.segments[0].technicalStatus).toBe("partial_blocked");expect(manifest.segments[0].criticalGaps.length).toBeGreaterThan(0);
});
test("T6: an older in-flight result cannot replace a newer edit's current artifact",async()=>{
  const f=await project(),{jobId:j1}=await start(f);deferred=[];let release!:()=>void,entered!:()=>void;const atModel=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);const base=deterministicFake();
  const old=new FakeModelClient(async (r:Parameters<FakeModelClient["respond"]>[0])=>{entered();await hold;return base.respond(r);});const oldPipeline={store:db.state,model:old,hooks:{sleep:async()=>{}}};
  const running=runPipeline(oldPipeline,j1,"old-run");await atModel;
  const edit=await request("transcripts","/transcripts","POST",{baseVersionId:f.transcriptVersionId,edits:[{segmentIdx:0,text:"আমি আসবে না।"}]},f.params);expect(edit.status).toBe(201);const {jobId:j2}=await edit.json();expect(j2).not.toBe(j1);await drain();const first=(await current(f)).pointer;
  release();await running;expect(artifact((await current(f)).pointer)).toEqual(artifact(first));const [p]=await db.state.query<{active_job_id:string|null}>(sql`SELECT active_job_id FROM projects WHERE id=${f.projectId}`);expect(p.active_job_id).toBeNull();
});
test("T8: crash after response before stage insert, then two replays produce one stage pair and track",async()=>{
  const f=await project(),{jobId}=await start(f);deferred=[];let crash=true;pipeline.hooks={sleep:async()=>{},afterModel:async()=>{if(crash){crash=false;throw Error("injected process termination");}}};
  const indices=await claimPipeline(pipeline,jobId,"same-run");expect(indices).toEqual([0]);await expect(processStage(pipeline,jobId,"same-run",0,"meaning")).rejects.toThrow("injected");
  await runPipeline(pipeline,jobId,"same-run");const first=(await current(f)).pointer;await runPipeline(pipeline,jobId,"same-run");expect(artifact((await current(f)).pointer)).toEqual(artifact(first));
  expect(await db.state.query(sql`SELECT cache_key FROM stage_results`)).toHaveLength(2);expect(await db.state.query(sql`SELECT id FROM track_versions`)).toHaveLength(1);expect(await stageAttemptsFor(db.state,jobId,0,"meaning")).toHaveLength(2);
  expect(await finishPipeline(pipeline,jobId,"same-run")).toEqual({status:"fenced"});
});
test("T13: route returns 402 spend_cap while an existing saved manifest still replays",async()=>{
  const f=await project();await start(f);await drain();const {pointer}=await current(f);const [usage]=await db.state.query<{spent:string}>(sql`SELECT spent_micros::text AS spent FROM spend_budgets WHERE scope='lifetime'`);
  // Keep settled fixture spend; only one cent of capacity remains.
  await configureBudgets(db.state,BigInt(usage.spent)+10_000n,BigInt(usage.spent)+10_000n);
  const result=await start(f);expect(result.response.status).toBe(402);expect((await result.response.json()).error.code).toBe("spend_cap");expect(artifact((await current(f)).pointer)).toEqual(artifact(pointer));expect(model.calls).toHaveLength(2);
});
test("T17: A→B→A versions bind distinct artifacts, reuse stages, and source checks remain overlays",async()=>{
  const f=await project();await start(f);await drain();const a=await current(f);let tv=f.transcriptVersionId;
  for(const text of ["আমি আসবে না।","আমি আসবে।"]){const r=await request("transcripts","/transcripts","POST",{baseVersionId:tv,edits:[{segmentIdx:0,text}]},f.params);expect(r.status).toBe(201);tv=(await r.json()).transcriptVersion.id;await drain();}
  const again=await current(f);expect(again.pointer.trackVersionId).not.toBe(a.pointer.trackVersionId);expect(again.manifest.transcriptVersion.id).not.toBe(f.transcriptVersionId);expect(model.calls).toHaveLength(4);
  expect((await request("sourceCheck","/source-check","PATCH",{transcriptVersionId:tv,state:"creator_confirmed"},{...f.params,idx:"0"})).status).toBe(200);const checked=await current(f);expect(checked.pointer.manifestHash).toBe(again.pointer.manifestHash);expect(checked.pointer.overlays.sourceChecks[0].state).toBe("creator_confirmed");
  const [old]=await db.state.query<{id:string}>(sql`SELECT id FROM media WHERE project_id=${f.projectId}`);await db.state.query(sql`UPDATE media SET status='expired' WHERE id=${old.id}`);
  const init=await request("mediaInit","/init","POST",{contentType:"video/mp4",sizeBytes:32,sha256:"a".repeat(64),durationMs:4000,width:320,height:240},f.params);const {mediaId}=await init.json();const [m]=await db.state.query<{blob_pathname:string}>(sql`SELECT blob_pathname FROM media WHERE id=${mediaId}`);await blobs.put(m.blob_pathname,new Uint8Array(32));await request("mediaFinalize","/finalize","POST",{mediaId},f.params);
  expect((await current(f)).pointer.manifestHash).toBe(again.pointer.manifestHash);expect((await current(f)).pointer.media.state).toBe("available");expect(model.calls).toHaveLength(4);
});
test("T18: strong manifest revalidation follows authorization and deletion; fresh media is no-store",async()=>{
  const f=await project();await start(f);await drain();const currentTrack=await request("track","/track","GET",undefined,f.params);expect(currentTrack.headers.get("cache-control")).toBe("no-store");const {pointer,response}=await current(f),etag=response.headers.get("etag")!;
  expect(etag).toBe(`"${pointer.manifestHash}"`);expect(response.headers.get("cache-control")).toBe("private, no-cache");expect(response.headers.get("vary")).toBe("Cookie");expect(JSON.stringify(await response.clone().json())).not.toContain("/api/local-blob");
  expect((await request("manifest","/manifest","GET",undefined,{trackId:pointer.trackVersionId},{etag})).status).toBe(304);
  const foreign=ownerCookieHeader(createOwnerCapability().token);expect((await request("manifest","/manifest","GET",undefined,{trackId:pointer.trackVersionId},{etag,cookie:foreign})).status).toBe(404);
  await deleteProject(db.state,f.projectId);expect((await request("manifest","/manifest","GET",undefined,{trackId:pointer.trackVersionId},{etag})).status).toBe(404);
});
test("API security: origin, owner, strict JSON, project idempotency, kill switch and rate gate",async()=>{
  const f=await project();expect((await request("mediaInit","/init","POST",{},f.params,{origin:"null"})).status).toBe(403);expect((await request("getProject","/p","GET",undefined,f.params,{cookie:""})).status).toBe(404);
  const key=randomUUID(),one=await request("createProject","/projects","POST",{title:"Replay",rightsAttested:true},{},{key}),two=await request("createProject","/projects","POST",{title:"Replay",rightsAttested:true},{},{key});expect(await one.json()).toEqual(await two.json());
  expect((await request("createProject","/projects","POST",{title:"Changed",rightsAttested:true},{},{key})).status).toBe(409);
  expect((await request("killSwitch","/kill","POST",{processing:false},{},{authorization:"Bearer fixture-admin"})).status).toBe(200);expect((await start(f)).response.status).toBe(503);
  await db.state.query(sql`UPDATE rate_windows SET count=120`);expect((await request("sourceCheck","/source-check","PATCH",{},{...f.params,idx:"0"})).status).toBe(429);
});
test("Explicit retries settle every attempt; refusal is not retried and schema instructions isolate captions",async()=>{
  const f=await project(),fake=deterministicFake();let attempts=0;model=new FakeModelClient(async (r:Parameters<FakeModelClient["respond"]>[0])=>{attempts++;if(attempts===1)return {status:"incomplete",output:null,usage:{inputTokens:11,outputTokens:12}};if(attempts===2)throw new ModelFailure("model_http_429",true,0);return fake.respond(r);});pipeline.model=model;
  const {jobId}=await start(f);await drain();expect((await loadJob(db.state,jobId)).job.status).toBe("succeeded");expect(await stageAttemptsFor(db.state,jobId,0,"meaning")).toHaveLength(3);expect(await db.state.query(sql`SELECT id FROM spend_reservations WHERE state='reserved'`)).toHaveLength(0);
  const wire=responseBody(model.calls[0]);expect(wire.store).toBe(false);expect(wire.safety_identifier).toMatch(/^[a-f0-9]{64}$/u);expect(wire).not.toHaveProperty("tools");expect(wire.max_output_tokens).toBe(4000);expect(wire.input[0].content).not.toContain("আমি আসবে");expect(JSON.parse(wire.input[1].content).segment.text).toBe("আমি আসবে।");
  const f2=await project("আমি আসবে না।");pipeline.model=new FakeModelClient({status:"refusal",output:null,usage:{inputTokens:1,outputTokens:1}});await start(f2);await drain();expect((pipeline.model as FakeModelClient).calls).toHaveLength(1);expect((await current(f2)).manifest.segments[0].technicalStatus).toBe("failed");
});

test("Local signed transport enforces scope, type, size, expiry, no-overwrite and ranged reads",async()=>{
 const pathname='v/local/fixture-'+randomUUID()+'.mp4',expires=new Date(Date.now()+600000),put=await blobs.sign(pathname,'put',expires,{contentType:'video/mp4',maximumSizeInBytes:4});
 const send=(url:string,contentType:string,data:Uint8Array)=>handleLocalBlob(new Request('http://localhost'+url,{method:'PUT',headers:{origin:'http://localhost','content-type':contentType},body:data as Uint8Array<ArrayBuffer>}),blobs);
 expect((await send(put,'text/plain',new Uint8Array(4))).status).toBe(422);
 expect((await send(put,'video/mp4',new Uint8Array(5))).status).toBe(413);
 const concurrent=await Promise.all([send(put,'video/mp4',new Uint8Array(4)),send(put,'video/mp4',new Uint8Array(4))]);expect(concurrent.map(r=>r.status).sort()).toEqual([201,409]);
 const get=await blobs.sign(pathname,'get',expires),read=await handleLocalBlob(new Request('http://localhost'+get,{headers:{range:'bytes=1-2'}}),blobs);expect(read.status).toBe(206);expect((await read.arrayBuffer()).byteLength).toBe(2);
 expect((await handleLocalBlob(new Request('http://localhost'+get+'forged'),blobs)).status).toBe(404);
 const expired=await blobs.sign(pathname,'get',new Date(Date.now()-1));expect((await handleLocalBlob(new Request('http://localhost'+expired),blobs)).status).toBe(404);
});
test("Transcript merge and split preserve cue boundaries and require current-version CAS",async()=>{
 const f=await project();
 const initial=await request('transcripts','/transcripts','POST',{baseVersionId:f.transcriptVersionId,format:'srt',text:'1\n00:00:00,000 --> 00:00:02,000\nআমি আসবে।\n\n2\n00:00:02,000 --> 00:00:04,000\nআমি আসবে।'},f.params);expect(initial.status).toBe(201);let tv=(await initial.json()).transcriptVersion.id;
 const merged=await request('transcripts','/transcripts','POST',{baseVersionId:tv,merge:[0,1]},f.params);expect(merged.status).toBe(201);const m=await merged.json();expect(m.segments).toHaveLength(1);tv=m.transcriptVersion.id;
 const split=await request('transcripts','/transcripts','POST',{baseVersionId:tv,split:{segmentIdx:0,atCueIdx:1}},f.params);expect(split.status).toBe(201);const s=await split.json();expect(s.segments).toHaveLength(2);expect(s.segments.map((s:{startMs:number;endMs:number})=>[s.startMs,s.endMs])).toEqual([[0,2000],[2000,4000]]);
 const conflict=await request('transcripts','/transcripts','POST',{baseVersionId:tv,merge:[0,1]},f.params);expect(conflict.status).toBe(409);expect((await conflict.json()).currentVersionId).toBe(s.transcriptVersion.id);
});
test("Transcript and job idempotency survive a newer version and a disabled processing switch",async()=>{
  const f=await project(),jobKey=randomUUID(),first=await request("startJob","/jobs","POST",{transcriptVersionId:f.transcriptVersionId},f.params,{key:jobKey});expect(first.status).toBe(202);const original=await first.json();await drain();
  const key=randomUUID(),input={baseVersionId:f.transcriptVersionId,edits:[{segmentIdx:0,text:"আমি আসবে না।"}]};
  const edited=await request("transcripts","/transcripts","POST",input,f.params,{key});expect(edited.status).toBe(201);const version=await edited.json();await drain();
  await request("killSwitch","/kill","POST",{processing:false},{},{authorization:"Bearer fixture-admin"});
  const replay=await request("transcripts","/transcripts","POST",input,f.params,{key});expect(replay.status).toBe(201);expect(await replay.json()).toEqual(version);
  const job=await request("startJob","/jobs","POST",{transcriptVersionId:f.transcriptVersionId},f.params,{key:jobKey});expect(job.status).toBe(202);expect(await job.json()).toEqual(original);await drain();expect(model.calls).toHaveLength(4);
});
test("Sol unavailability selects Terra on the next recovery job and keeps separate cache provenance",async()=>{
  const f=await project();pipeline.model={kind:"openai",respond:async()=>{throw new ModelFailure("model_http_404",false);}};const {jobId}=await start(f);await drain();
  pipeline.model=deterministicFake();expect((await request("retryJob","/retry","POST",undefined,{jobId})).status).toBe(503);await request("killSwitch","/kill","POST",{processing:true},{},{authorization:"Bearer fixture-admin"});const retried=await request("retryJob","/retry","POST",undefined,{jobId});expect(retried.status).toBe(202);const id=(await retried.json()).jobId;await drain();
  expect((await loadJob(db.state,id)).job.model_profile).toBe("gpt-6.1-terra");expect((await current(f)).manifest.provenance.modelProfile).toBe("fake/gpt-6.1-terra");
});

test("T2 / T12 / T18: read-only share replay makes no model calls, revocation beats ETag, and every mutation stays owner-only",async()=>{
 const f=await project();await start(f);await drain();const currentTrack=await current(f),before=await db.state.query(sql`SELECT id FROM stage_attempts`),calls=model.calls.length;
 const shared=await request('share','/share','POST',{enable:true},f.params);expect(shared.status).toBe(200);const link=new URL((await shared.json()).shareUrl),token=link.searchParams.get('s')!,query='?s='+token;
 const read=await request('getProject','/project'+query,'GET',undefined,f.params,{cookie:''});expect(read.status).toBe(200);expect((await read.json()).job).toBeNull();
 const pointer=await request('track','/track'+query,'GET',undefined,f.params,{cookie:''});expect(pointer.status).toBe(200);expect((await pointer.json()).manifestHash).toBe(currentTrack.pointer.manifestHash);
 const manifest=await request('manifest','/manifest'+query,'GET',undefined,{trackId:currentTrack.pointer.trackVersionId},{cookie:''});expect(manifest.status).toBe(200);const etag=manifest.headers.get('etag')!;
 expect((await request('manifest','/manifest'+query,'GET',undefined,{trackId:currentTrack.pointer.trackVersionId},{cookie:'',etag})).status).toBe(304);
 const foreignCapability=createOwnerCapability();await ensureOwner(db.state,foreignCapability.tokenHash);const foreign=ownerCookieHeader(foreignCapability.token);
 for(const [action,params,method,input] of [
  ['transcripts',f.params,'POST',{baseVersionId:f.transcriptVersionId,edits:[{segmentIdx:0,text:'forged'}]}],['sourceCheck',{...f.params,idx:'0'},'PATCH',{transcriptVersionId:f.transcriptVersionId,state:'creator_confirmed'}],
  ['mediaInit',f.params,'POST',{}],['mediaFinalize',f.params,'POST',{}],['startJob',f.params,'POST',{transcriptVersionId:f.transcriptVersionId}],
  ['retryJob',{jobId:(await loadJob(db.state,(await db.state.query<{id:string}>(sql`SELECT id FROM jobs WHERE project_id=${f.projectId} ORDER BY created_at LIMIT 1`))[0].id)).job.id},'POST',undefined],
  ['cancelJob',{jobId:(await db.state.query<{id:string}>(sql`SELECT id FROM jobs WHERE project_id=${f.projectId} LIMIT 1`))[0].id},'POST',undefined],['share',f.params,'POST',{enable:true}],['deleteProject',f.params,'DELETE',undefined],
 ] as [Action,Record<string,string>,string,unknown][]){expect((await request(action,'/mutation'+query,method,input,params,{cookie:foreign})).status).toBe(404);}
 expect(await db.state.query(sql`SELECT id FROM stage_attempts`)).toEqual(before);expect(model.calls).toHaveLength(calls);
 await request('share','/share','POST',{enable:false},f.params);expect((await request('manifest','/manifest'+query,'GET',undefined,{trackId:currentTrack.pointer.trackVersionId},{cookie:'',etag})).status).toBe(404);
 expect((await request('track','/track','GET',undefined,f.params)).status).toBe(200);
});
test("T24 API deletion fences visibility immediately and reconciliation removes files after upload grace",async()=>{
 const f=await project();await start(f);await drain();const saved=await current(f),shared=await request('share','/share','POST',{enable:true},f.params),token=new URL((await shared.json()).shareUrl).searchParams.get('s')!;
 const deleted=await request('deleteProject','/project','DELETE',undefined,f.params);expect(deleted.status).toBe(202);expect(await deleted.json()).toEqual({status:'deleting'});
 expect((await request('getProject','/project','GET',undefined,f.params)).status).toBe(404);expect((await request('track','/track?s='+token,'GET',undefined,f.params,{cookie:''})).status).toBe(404);expect((await request('manifest','/manifest','GET',undefined,{trackId:saved.pointer.trackVersionId})).status).toBe(404);
 await drain();await reconcile(db.state,blobs,new LocalPipelineDispatcher(pipeline),{now:new Date(Date.now()+900001),opportunistic:false});
 expect(await db.state.query(sql`SELECT id FROM projects WHERE id=${f.projectId}`)).toEqual([]);expect(await blobs.list('v/'+f.projectId+'/')).toEqual([]);expect((await db.state.query<{n:number}>(sql`SELECT count(*)::int AS n FROM spend_reservations`))[0].n).toBeGreaterThan(0);
});
test("Source confirmation has an idempotent timestamp overlay; transfer closure preserves model-free captions and manifest",async()=>{
 const f=await project();await start(f);await drain();const saved=await current(f);
 for(let i=0;i<2;i++)expect((await request('sourceCheck','/source-check','PATCH',{transcriptVersionId:f.transcriptVersionId,state:'creator_confirmed'},{...f.params,idx:'0'})).status).toBe(200);
 const checked=await current(f);expect(checked.pointer.overlays.sourceChecks[0].confirmedAt).toMatch(/^\d{4}-/u);expect(checked.pointer.manifestHash).toBe(saved.pointer.manifestHash);
 await db.state.query(sql`UPDATE storage_ledger SET est_transfer_bytes=transfer_cap_bytes`);const limited=await request('track','/track','GET',undefined,f.params);expect(limited.status).toBe(200);expect((await limited.json()).media).toMatchObject({state:'missing',url:null,reason:'transfer_cap'});expect((await request('mediaUrl','/url','GET',undefined,f.params)).status).toBe(503);expect(model.calls).toHaveLength(2);
});
test("Kill switch prevents the next reserved model attempt and admin metrics expose bounded observations",async()=>{
 const f=await project(),{jobId}=await start(f);await request('killSwitch','/kill','POST',{processing:false},{},{authorization:'Bearer fixture-admin'});await drain();expect(model.calls).toHaveLength(0);expect((await loadJob(db.state,jobId)).job.status).toBe('failed');
 const status=await request('adminStatus','/admin','GET',undefined,{},{authorization:'Bearer fixture-admin'});expect(status.status).toBe(200);const metrics=await status.json();expect(metrics).toMatchObject({processing:false,duration:{p50Ms:expect.any(Number),p95Ms:expect.any(Number)},stages:{attempts:0,cacheHits:0},alerts:expect.any(Array)});expect(metrics).toHaveProperty('renderEvents');expect(metrics).toHaveProperty('segments');
});

test("Environment processing switch fences a queued job before a model call",async()=>{
 const f=await project(),{jobId}=await start(f);pipeline.processingEnabled=()=>false;await drain();expect(model.calls).toHaveLength(0);expect((await loadJob(db.state,jobId)).job.status).toBe('failed');expect(await stageAttemptsFor(db.state,jobId,0,'meaning')).toHaveLength(0);
});

test("H7 long-running jobs alert even when their heartbeat is fresh",async()=>{
 const f=await project(),{jobId}=await start(f);await claimPipeline(pipeline,jobId,'metric-fixture-run');await db.state.query(sql`UPDATE jobs SET created_at=now()-interval '11 minutes',heartbeat_at=now() WHERE id=${jobId}`);
 const response=await request('adminStatus','/admin','GET',undefined,{},{authorization:'Bearer fixture-admin'});expect(response.status).toBe(200);const metrics=await response.json();expect(metrics.alerts).toContain('stalled_job');expect(metrics.warningCounts.stalled).toBe(1);
});
