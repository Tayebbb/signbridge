import {beforeAll,beforeEach,afterEach,afterAll,test,expect} from "vitest";
import {sql,SQL} from "drizzle-orm";
import {PgDialect} from "drizzle-orm/pg-core";
import {randomUUID} from "node:crypto";
import type {StateStore} from "../../lib/db/session";
import {startJob,retryJob,cancelJob,deleteProject,stallFence,failJob,submitTranscriptVersion} from "../../lib/db/queries/authority";
import {claimRun,acknowledgeRun,acknowledgeKnownRun,claimLease,releaseLease,recordDispatchFailure} from "../../lib/db/queries/execution";
import {publishTrack} from "../../lib/db/queries/publish";
import {writeStageResult,cachedStage} from "../../lib/db/queries/stages";
import {reserveAttempt,settleAttempt,configureBudgets,budgetSignal,sweepSpend} from "../../lib/db/queries/spend";
import {reserveMedia,finalizeMedia,admitTransfer,reserveAnchor,finalizeAnchor} from "../../lib/db/queries/storage";
import {visibleProject,visibleMedia,visibleTrack} from "../../lib/db/queries/purge";
import {reconcile} from "../../lib/ops/reconcile";
import {purgeProject} from "../../lib/ops/purge";
import {sweepStorage,initMedia} from "../../lib/ops/storage";
import {dayScope,attemptUpperBound,usageCost} from "../../lib/domain/limits";
import {NOW,later,projectFixture,trackFor,gateProjectLock,blobFixture,assertBudgetInvariant,type Backend} from "./support";

export function registerStateSuite(factory:()=>Promise<Backend>) {
  let backend:Backend,store:StateStore,files:Awaited<ReturnType<typeof blobFixture>>;
  beforeAll(async()=>{backend=await factory();store=backend.store;},60_000);
  beforeEach(async()=>{await store.query(sql`TRUNCATE owners,corpus_releases,stage_results,spend_budgets,spend_reservations,storage_ledger RESTART IDENTITY CASCADE`);files=await blobFixture();});
  afterEach(async()=>files?.close());afterAll(async()=>backend?.close());
  const stage=(cacheKey:string,output:unknown={fixture:"public engineering test"})=>({cacheKey,stage:"meaning" as const,schemaVersion:"meaning-v2",modelId:"fake",promptVersion:"1",output,validation:{technicalOnly:true}});
  const mediaInput=(projectId:string,declaredBytes=128,pinned=false)=>({projectId,declaredBytes,contentType:"video/mp4" as const,clientSha256:"a".repeat(64),clientDurationMs:2000,pinned});
  const dispatch=async(jobId:string,now=NOW)=>{const run=randomUUID();if(await claimRun(store,jobId,run,now))await acknowledgeRun(store,jobId,run);else await acknowledgeKnownRun(store,jobId);};
  async function waitForLock(){if(backend.engine!=="postgres")return;const end=Date.now()+5000;while(Date.now()<end){const [row]=await store.query<{n:number}>(sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`);if(row.n)return;await new Promise(r=>setTimeout(r,10));}throw new Error("Expected an actual PostgreSQL lock waiter");}
  async function totals(){return (await store.query<{pending_bytes:string;committed_bytes:string;est_transfer_bytes:string}>(sql`SELECT * FROM storage_ledger WHERE id=1`))[0];}
  async function readyVideo(projectId:string,pinned=false,now=NOW){const m=await reserveMedia(store,mediaInput(projectId,128,pinned),now);await files.blobs.put(m.pathname,new Uint8Array(32));await finalizeMedia(store,m.id,{size:(await files.blobs.head(m.pathname)).size,contentType:"video/mp4"},now);return m;}

  for(const action of ["cancel","retry","edit","delete","stall","second_start"] as const)for(const timing of ["before_claim","during_stage","at_publish"] as const) {
    test(`T16: ${action} × ${timing} fences the old job`,async()=>{
      const f=await projectFixture(store),proof={runId:"old-run"};
      if(timing!=="before_claim"||action==="stall"||action==="retry")expect(await claimRun(store,f.jobId,proof.runId,NOW)).toBe(true);
      if(timing==="during_stage")await writeStageResult(store,f.jobId,proof,stage("matrix-stage"),NOW);
      if(action==="retry")await failJob(store,f.jobId,"synthetic_stage_failure",NOW);
      const [before]=await store.query<{processing_epoch:string}>(sql`SELECT processing_epoch FROM projects WHERE id=${f.projectId}`);
      const when=action==="stall"?later(660_001):NOW;
      const act=(db:StateStore)=>action==="cancel"?cancelJob(db,f.jobId,when):action==="retry"?retryJob(db,{jobId:f.jobId,idempotencyKey:"retry"},when):action==="edit"?submitTranscriptVersion(db,{projectId:f.projectId,baseVersionId:f.transcriptVersionId,idempotencyKey:"edit",cues:[{idx:0,startMs:0,endMs:2000,text:"আমি আসবে?"}]},when):action==="delete"?deleteProject(db,f.projectId,when):action==="stall"?stallFence(db,f.jobId,when):startJob(db,{projectId:f.projectId,transcriptVersionId:f.transcriptVersionId,idempotencyKey:"second"},when);
      let published:{status:string;trackVersionId?:string};
      if(timing==="at_publish"){
        const gate=gateProjectLock(store),change=act(gate.store);await gate.entered;
        const publishing=publishTrack(store,f.jobId,proof,trackFor(f),when);
        try{await waitForLock();}finally{gate.release();}
        await change;published=await publishing;
      }else{await act(store);if(timing==="before_claim")expect(await claimRun(store,f.jobId,proof.runId,when)).toBe(false);published=await publishTrack(store,f.jobId,proof,trackFor(f),when);}
      expect(published.status).toBe("fenced");
      const [p]=await store.query<{processing_epoch:string;active_job_id:string|null;current_track_version_id:string|null}>(sql`SELECT * FROM projects WHERE id=${f.projectId}`);
      expect(BigInt(p.processing_epoch)).toBe(BigInt(before.processing_epoch)+1n);expect(p.current_track_version_id).toBeNull();
      const [active]=await store.query<{n:number}>(sql`SELECT count(*)::int AS n FROM jobs WHERE project_id=${f.projectId} AND status IN ('queued','running')`);expect(active.n).toBeLessThanOrEqual(1);
      if(action==="delete"){expect(await visibleProject(store,f.projectId)).toBeNull();return;}
      let winningId=p.active_job_id;
      if(!winningId)winningId=(await retryJob(store,{jobId:f.jobId,idempotencyKey:"after-fence"},when)).id;
      const [winner]=await store.query<{transcript_version_id:string}>(sql`SELECT transcript_version_id FROM jobs WHERE id=${winningId}`);
      const winning={...f,jobId:winningId,transcriptVersionId:winner.transcript_version_id};expect(await claimRun(store,winningId,"winner",when)).toBe(true);
      const body=trackFor(winning),[one,two]=await Promise.all([publishTrack(store,winningId,{runId:"winner"},body,when),publishTrack(store,winningId,{runId:"winner"},body,when)]);
      expect(one.status).toBe("published");expect(two).toEqual(one);
      expect((await store.query(sql`SELECT id FROM track_versions WHERE project_id=${f.projectId}`))).toHaveLength(1);
    });
  }
  test("T16: duplicate starts and competing transcript edits are atomic and idempotent",async()=>{
    const f=await projectFixture(store);
    const jobs=await Promise.all(Array.from({length:12},()=>startJob(store,{projectId:f.projectId,transcriptVersionId:f.transcriptVersionId,idempotencyKey:"same"},NOW)));
    expect(new Set(jobs.map(j=>j.id)).size).toBe(1);expect(jobs[0].epoch).toBe(2n);
    const edits=await Promise.allSettled(["one","two"].map(idempotencyKey=>submitTranscriptVersion(store,{projectId:f.projectId,baseVersionId:f.transcriptVersionId,idempotencyKey,cues:[{idx:0,startMs:500,endMs:2500,text:"আমি আসবে।"}]},NOW)));
    expect(edits.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(edits.filter(r=>r.status==="rejected")).toHaveLength(1);
    const keys=await store.query<{segment_key:string}>(sql`SELECT segment_key FROM segments ORDER BY transcript_version_id`);expect(new Set(keys.map(k=>k.segment_key)).size).toBe(1);
    const [p]=await store.query<{processing_epoch:string;lock_version:number}>(sql`SELECT * FROM projects WHERE id=${f.projectId}`);expect(BigInt(p.processing_epoch)).toBe(3n);expect(p.lock_version).toBe(2);
  });
  test("T19: post-commit/pre-start crash is repaired once after 30 seconds",async()=>{
    const f=await projectFixture(store);expect((await reconcile(store,files.blobs,{dispatch:id=>dispatch(id,NOW)},{now:later(29_000)})).redispatched).toBe(0);
    const first=await reconcile(store,files.blobs,{dispatch:id=>dispatch(id,later(31_000))},{now:later(31_000)});expect(first.redispatched).toBe(1);
    expect((await reconcile(store,files.blobs,{dispatch:id=>dispatch(id,later(31_000))},{now:later(31_000)})).redispatched).toBe(0);
    const [job]=await store.query<{dispatch_state:string;dispatch_attempts:number}>(sql`SELECT * FROM jobs WHERE id=${f.jobId}`);expect(job).toMatchObject({dispatch_state:"started",dispatch_attempts:1});
  });
  test("F4: another job with the same fingerprint reuses the stored artifact identity",async()=>{
    const f=await projectFixture(store);await claimRun(store,f.jobId,"first",NOW);const first=await publishTrack(store,f.jobId,{runId:"first"},trackFor(f),NOW);
    const second=await startJob(store,{projectId:f.projectId,transcriptVersionId:f.transcriptVersionId,idempotencyKey:"same-fingerprint"},NOW);await claimRun(store,second.id,"second",NOW);
    const result=await publishTrack(store,second.id,{runId:"second"},trackFor({...f,jobId:second.id}),NOW);expect(result).toEqual(first);
    const rows=await store.query<{manifest:{trackVersionId:string}}>(sql`SELECT manifest FROM track_versions`);expect(rows).toHaveLength(1);expect(rows[0].manifest.trackVersionId).toBe(first.trackVersionId);
  });
  test("T19: lost run ID and concurrent duplicate starts retain the first run claim",async()=>{
    const f=await projectFixture(store);expect(await claimRun(store,f.jobId,"original",NOW)).toBe(true);
    const claims=await Promise.all(Array.from({length:12},(_,i)=>claimRun(store,f.jobId,`duplicate-${i}`,NOW)));expect(claims.every(c=>!c)).toBe(true);
    await reconcile(store,files.blobs,{dispatch:id=>dispatch(id,later(31_000))},{now:later(31_000)});
    const [job]=await store.query(sql`SELECT run_claim,workflow_run_id,dispatch_state FROM jobs WHERE id=${f.jobId}`);expect(job).toEqual({run_claim:"original",workflow_run_id:"original",dispatch_state:"started"});
    expect(await claimRun(store,f.jobId,"original",NOW)).toBe(true);
    const counters=await reconcile(store,files.blobs,{dispatch:id=>dispatch(id,later(660_001))},{now:later(660_001)});expect(counters.fenced).toBe(1);
    expect((await publishTrack(store,f.jobId,{runId:"original"},trackFor(f),later(660_001))).status).toBe("fenced");
  });
  test("T19: failed redispatches stop at five attempts",async()=>{
    const f=await projectFixture(store);let calls=0;
    const errors:string[]=[];for(let i=0;i<7;i++)await reconcile(store,files.blobs,{async dispatch(){calls++;throw new Error("scheduler unavailable");}},{now:later(31_000),onError:code=>errors.push(code)});expect(errors).toHaveLength(5);
    expect(calls).toBe(5);expect((await store.query(sql`SELECT dispatch_attempts FROM jobs WHERE id=${f.jobId}`))[0]).toEqual({dispatch_attempts:5});
    await recordDispatchFailure(store,f.jobId);expect((await store.query(sql`SELECT dispatch_attempts FROM jobs WHERE id=${f.jobId}`))[0]).toEqual({dispatch_attempts:5});
  });
  test("F5: concurrent cache writers converge, references protect shared rows, and hits spend nothing",async()=>{
    const a=await projectFixture(store),b=await projectFixture(store);await claimRun(store,a.jobId,"a",NOW);await claimRun(store,b.jobId,"b",NOW);
    const results=await Promise.all([writeStageResult(store,a.jobId,{runId:"a"},stage("shared",{winner:"a"}),NOW),writeStageResult(store,b.jobId,{runId:"b"},stage("shared",{winner:"b"}),NOW)]);
    expect(results[0]).toEqual(results[1]);expect(await store.query(sql`SELECT * FROM stage_result_refs WHERE cache_key='shared'`)).toHaveLength(2);
    expect(await cachedStage(store,b.jobId,{runId:"b"},"shared","meaning",0,1,NOW)).toEqual(results[0]);expect(await store.query(sql`SELECT * FROM spend_reservations`)).toEqual([]);
    await cancelJob(store,a.jobId,NOW);expect(await writeStageResult(store,a.jobId,{runId:"a"},stage("late-public-cache"),NOW)).not.toBeNull();
    await deleteProject(store,a.projectId,NOW);expect(await writeStageResult(store,a.jobId,{runId:"a"},stage("after-delete"),NOW)).toBeNull();
  });
  test("T13: a one-cent cap fails the new attempt while saved replay stays available",async()=>{
    const f=await projectFixture(store);await claimRun(store,f.jobId,"saved",NOW);const saved=await publishTrack(store,f.jobId,{runId:"saved"},trackFor(f),NOW);expect(saved.status).toBe("published");
    const next=await startJob(store,{projectId:f.projectId,transcriptVersionId:f.transcriptVersionId,idempotencyKey:"costly"},NOW);await claimRun(store,next.id,"new",NOW);await configureBudgets(store,10_000n,10_000n,NOW);
    const result=await reserveAttempt(store,{jobId:next.id,proof:{runId:"new"},stage:"meaning",segmentIdx:0,cacheKey:"m2:cost",attemptNo:1,upperBound:20_000n},NOW);expect(result.status).toBe("spend_cap");
    const [job]=await store.query<{status:string;last_error:{code:string}}>(sql`SELECT status,last_error FROM jobs WHERE id=${next.id}`);expect(job).toMatchObject({status:"failed",last_error:{code:"spend_cap"}});
    expect(await visibleTrack(store,saved.trackVersionId!)).not.toBeNull();expect(await store.query(sql`SELECT * FROM spend_reservations`)).toEqual([]);await assertBudgetInvariant(store);
  });
  for(const mode of ["usage","incomplete","timeout","crash","never_sent"] as const)test(`T20: ${mode} settlement is conservative and idempotent`,async()=>{
    const f=await projectFixture(store),proof={runId:"billing"};await claimRun(store,f.jobId,proof.runId,NOW);
    const input={jobId:f.jobId,proof,stage:"meaning" as const,segmentIdx:0,cacheKey:"billing",attemptNo:1,upperBound:10_000n};const reservation=await reserveAttempt(store,input,NOW);if(reservation.status!=="reserved")throw new Error("Reservation missing");
    const replay=await reserveAttempt(store,input,NOW);expect(replay).toMatchObject({id:reservation.id,created:false});
    if(mode==="crash")expect(await sweepSpend(store,later(600_001))).toBe(1);
    else await settleAttempt(store,reservation.id,proof,mode==="timeout"?"held_uncertain":mode==="never_sent"?"released":"settled",mode==="incomplete"?3800n:2000n,NOW,{inputTokens:500,outputTokens:200,reasoningTokens:100},mode);
    const expected=["timeout","crash"].includes(mode)?10_000n:mode==="never_sent"?0n:mode==="incomplete"?3800n:2000n;
    const rows=await store.query<{spent_micros:string;reserved_micros:string}>(sql`SELECT spent_micros,reserved_micros FROM spend_budgets`);expect(rows).toHaveLength(2);for(const row of rows){expect(BigInt(row.spent_micros)).toBe(expected);expect(BigInt(row.reserved_micros)).toBe(0n);}
    expect(await settleAttempt(store,reservation.id,proof,"settled",9999n,NOW)).toBe(false);await assertBudgetInvariant(store);
  });
  test("T20: 30 concurrent reservations at the boundary never overspend either budget",async()=>{
    const fixtures=[];for(let i=0;i<30;i++){const f=await projectFixture(store);await claimRun(store,f.jobId,"run",NOW);fixtures.push(f);}await configureBudgets(store,10_000n,10_000n,NOW);
    const results=await Promise.all(fixtures.map(async f=>{const result=await reserveAttempt(store,{jobId:f.jobId,proof:{runId:"run"},stage:"meaning",segmentIdx:0,cacheKey:"cap",attemptNo:1,upperBound:2000n},NOW);await assertBudgetInvariant(store);return result;}));
    expect(results.filter(r=>r.status==="reserved")).toHaveLength(5);expect(results.filter(r=>r.status==="spend_cap")).toHaveLength(25);await assertBudgetInvariant(store);
  });
  test("T20: three ordinary attempts plus one repair, duplicate settlement and amount capping",async()=>{
    const f=await projectFixture(store),proof={runId:"attempts"};await claimRun(store,f.jobId,proof.runId,NOW);
    const request={jobId:f.jobId,proof,stage:"meaning" as const,segmentIdx:0,cacheKey:"attempts",upperBound:1000n};
    for(let attemptNo=1;attemptNo<=3;attemptNo++){const r=await reserveAttempt(store,{...request,attemptNo},NOW);if(r.status!=="reserved")throw new Error("Reserve failed");await settleAttempt(store,r.id,proof,"released",0n,NOW);}
    await expect(reserveAttempt(store,{...request,attemptNo:4},NOW)).rejects.toMatchObject({code:"attempt_cap"});
    const repair=await reserveAttempt(store,{...request,attemptNo:4,repair:true},NOW);if(repair.status!=="reserved")throw new Error("Repair reserve failed");await settleAttempt(store,repair.id,proof,"settled",99_000n,NOW);
    await expect(reserveAttempt(store,{...request,attemptNo:5},NOW)).rejects.toMatchObject({code:"attempt_cap"});
    expect(await store.query(sql`SELECT * FROM stage_attempts`)).toHaveLength(4);const [budget]=await store.query<{spent_micros:string}>(sql`SELECT spent_micros FROM spend_budgets WHERE scope='lifetime'`);expect(BigInt(budget.spent_micros)).toBe(1000n);await assertBudgetInvariant(store);
  });
  test("T20: Asia/Dhaka rollover settles the original day and 80 percent forces Terra for new jobs",async()=>{
    const before=new Date("2026-11-03T17:59:59Z"),after=new Date("2026-11-03T18:00:01Z"),f=await projectFixture(store),proof={runId:"day"};await claimRun(store,f.jobId,proof.runId,before);await configureBudgets(store,10_000n,10_000n,before);
    const r=await reserveAttempt(store,{jobId:f.jobId,proof,stage:"meaning",segmentIdx:0,cacheKey:"day",attemptNo:1,upperBound:8000n},before);if(r.status!=="reserved")throw new Error("Missing reserve");
    expect(dayScope(before)).toBe("day:2026-11-03");expect(dayScope(after)).toBe("day:2026-11-04");expect((await budgetSignal(store,before)).downgrade).toBe(true);
    const next=await projectFixture(store);expect((await store.query(sql`SELECT model_profile FROM jobs WHERE id=${next.jobId}`))[0]).toEqual({model_profile:"gpt-6.1-terra"});
    await settleAttempt(store,r.id,proof,"settled",3000n,after);const old=(await store.query<{spent_micros:string}>(sql`SELECT spent_micros FROM spend_budgets WHERE scope='day:2026-11-03'`))[0];expect(BigInt(old.spent_micros)).toBe(3000n);await assertBudgetInvariant(store);
  });
  test("Owner quotas serialize across projects, survive deletion and reset by Dhaka day",async()=>{
    const ownerId=randomUUID(),projects=[];for(let i=0;i<5;i++)projects.push(await projectFixture(store,{ownerId,job:false}));
    const results=await Promise.allSettled(projects.map(f=>submitTranscriptVersion(store,{projectId:f.projectId,baseVersionId:null,idempotencyKey:"fresh",cues:[{idx:0,startMs:0,endMs:2000,text:"আমি আসবে।"}]},NOW)));expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(3);
    for(const f of projects){await deleteProject(store,f.projectId,NOW);await purgeProject(store,files.blobs,f.projectId,NOW);}
    const f=await projectFixture(store,{ownerId,job:false});const request={projectId:f.projectId,baseVersionId:null,idempotencyKey:"fourth",cues:[{idx:0,startMs:0,endMs:2000,text:"আমি আসবে।"}]};await expect(submitTranscriptVersion(store,request,NOW)).rejects.toMatchObject({code:"owner_quota"});
    expect(await submitTranscriptVersion(store,request,later(86_400_000))).toBeTruthy();
  });
  test("Owner quota admits only ten concurrent segment replans and leaves one active job",async()=>{
    const f=await projectFixture(store);const results=await Promise.allSettled(Array.from({length:20},(_,i)=>startJob(store,{projectId:f.projectId,transcriptVersionId:f.transcriptVersionId,idempotencyKey:`replan-${i}`},NOW)));
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(10);const [quota]=await store.query(sql`SELECT replanned_segments FROM owner_daily_quotas WHERE owner_id=${f.ownerId}`);expect(quota).toEqual({replanned_segments:10});
    const [active]=await store.query(sql`SELECT count(*)::int AS n FROM jobs WHERE status IN ('queued','running')`);expect(active).toEqual({n:1});
  });
  test("T21: 60 concurrent 15 MB inits against 800 MB admit exactly 50; smaller finalize releases the difference",async()=>{
    const projects=[];for(let i=0;i<60;i++)projects.push(await projectFixture(store,{job:false}));
    const results=await Promise.allSettled(projects.map(f=>reserveMedia(store,mediaInput(f.projectId,15728640),NOW)));
    const admitted=results.flatMap(r=>r.status==="fulfilled"?[r.value]:[]);expect(admitted).toHaveLength(50);expect(results.filter(r=>r.status==="rejected")).toHaveLength(10);
    let total=await totals();expect(BigInt(total.pending_bytes)).toBe(50n*15728640n);expect(BigInt(total.committed_bytes)+BigInt(total.pending_bytes)).toBeLessThanOrEqual(800_000_000n);
    await finalizeMedia(store,admitted[0].id,{size:1_000_000,contentType:"video/mp4"},NOW);await finalizeMedia(store,admitted[0].id,{size:1_000_000,contentType:"video/mp4"},NOW);
    total=await totals();expect(BigInt(total.pending_bytes)).toBe(49n*15728640n);expect(BigInt(total.committed_bytes)).toBe(1_000_000n);
  });
  test("T21: abandoned and rejected uploads release only after Blob deletion; opportunistic sweep is bounded to five",async()=>{
    const f=await projectFixture(store,{job:false}),media=[];for(let i=0;i<7;i++){const m=await reserveMedia(store,mediaInput(f.projectId,1000),NOW);await files.blobs.put(m.pathname,new Uint8Array(12));media.push(m);}
    expect(await sweepStorage(store,files.blobs,later(900_001),5)).toBe(5);expect(BigInt((await totals()).pending_bytes)).toBe(2000n);
    await initMedia(store,files.blobs,mediaInput(f.projectId,1000),later(900_001));expect(BigInt((await totals()).pending_bytes)).toBe(1000n);
    const bad=await reserveMedia(store,mediaInput(f.projectId,100),later(900_001));await files.blobs.put(bad.pathname,new Uint8Array(101));expect((await finalizeMedia(store,bad.id,{size:101,contentType:"video/mp4"},later(900_001))).status).toBe("rejected");
    expect(await sweepStorage(store,files.blobs,later(900_001),5)).toBe(0);expect(BigInt((await totals()).pending_bytes)).toBe(1100n);
    files.blobs.failAt=files.blobs.removes+1;let cleanupErrors=0;expect(await sweepStorage(store,files.blobs,later(1_800_002),5,undefined,()=>{cleanupErrors++;})).toBe(1);expect(cleanupErrors).toBe(1);expect([100n,1000n]).toContain(BigInt((await totals()).pending_bytes));
    files.blobs.failAt=null;expect(await sweepStorage(store,files.blobs,later(1_800_002),5)).toBe(1);expect(BigInt((await totals()).pending_bytes)).toBe(0n);
  });
  test("T21: transfer gate includes pinned reads and monthly rollover occurs exactly once",async()=>{
    const f=await projectFixture(store,{job:false}),end=new Date("2026-11-30T17:59:59Z"),next=new Date("2026-11-30T18:00:01Z");
    const video=await readyVideo(f.projectId,false,end),pinned=await readyVideo(f.projectId,true,end);await store.query(sql`UPDATE storage_ledger SET transfer_cap_bytes=64 WHERE id=1`);
    const requests=await Promise.allSettled(Array.from({length:10},()=>admitTransfer(store,video.id,end)));expect(requests.filter(r=>r.status==="fulfilled")).toHaveLength(2);
    const pinnedBlocked=await Promise.allSettled(Array.from({length:10},()=>admitTransfer(store,pinned.id,end)));expect(pinnedBlocked.every(r=>r.status==="rejected")).toBe(true);expect(BigInt((await totals()).est_transfer_bytes)).toBe(64n);
    const fresh=await Promise.allSettled(Array.from({length:10},()=>admitTransfer(store,pinned.id,next)));expect(fresh.filter(r=>r.status==="fulfilled")).toHaveLength(2);expect(BigInt((await totals()).est_transfer_bytes)).toBe(64n);
    await expect(admitTransfer(store,video.id,end)).rejects.toMatchObject({code:"clock_regressed"});
  });
  test("Anchor reservations share the cap and finalized/abandoned bytes remain exact",async()=>{
    const f=await projectFixture(store,{job:false}),request={projectId:f.projectId,declaredBytes:100,frameMs:500,segmentStartMs:0,segmentEndMs:2000,mediaSha256:"a".repeat(64),labelBn:null};
    const anchors=await Promise.all(Array.from({length:3},()=>reserveAnchor(store,request,NOW)));await expect(reserveAnchor(store,request,NOW)).rejects.toMatchObject({code:"anchor_limits"});
    await files.blobs.put(anchors[0].pathname,new Uint8Array(20));expect(await finalizeAnchor(store,anchors[0].id,{size:20,contentType:"image/jpeg"},NOW)).toBe(true);
    expect(BigInt((await totals()).pending_bytes)).toBe(200n);expect(BigInt((await totals()).committed_bytes)).toBe(20n);
    expect(await sweepStorage(store,files.blobs,later(900_001),5)).toBe(2);expect(BigInt((await totals()).pending_bytes)).toBe(0n);
  });
  test("T21: 72-hour media retention releases actual bytes while pinned demo media survives",async()=>{
    const f=await projectFixture(store,{job:false}),normal=await readyVideo(f.projectId),pinned=await readyVideo(f.projectId,true),expired=later(259_200_001);
    expect(await sweepStorage(store,files.blobs,expired,5)).toBe(1);expect(BigInt((await totals()).committed_bytes)).toBe(32n);
    expect((await store.query(sql`SELECT status,storage_charge FROM media WHERE id=${normal.id}`))[0]).toEqual({status:"expired",storage_charge:"released"});
    await expect(admitTransfer(store,normal.id,expired)).rejects.toMatchObject({code:"media_unavailable"});expect(await admitTransfer(store,pinned.id,expired)).toMatchObject({pathname:pinned.pathname,size:32});
    expect((await files.blobs.list(`v/${f.projectId}/`)).map(f=>f.pathname)).toEqual([pinned.pathname]);
  });
  for(const interrupt of [1,2,3,"sql"] as const)test(`T24: deletion purge resumes after interruption ${interrupt}`,async()=>{
    const f=await projectFixture(store),other=await projectFixture(store),proof={runId:"delete"};await claimRun(store,f.jobId,proof.runId,NOW);await claimRun(store,other.jobId,"other",NOW);
    await writeStageResult(store,f.jobId,proof,stage("shared"),NOW);await writeStageResult(store,f.jobId,proof,stage("exclusive"),NOW);await writeStageResult(store,other.jobId,{runId:"other"},stage("shared"),NOW);
    const reservation=await reserveAttempt(store,{jobId:f.jobId,proof,stage:"meaning",segmentIdx:0,cacheKey:"deleting",attemptNo:1,upperBound:1000n},NOW);expect(reservation.status).toBe("reserved");
    const video=await readyVideo(f.projectId),anchor=await reserveAnchor(store,{projectId:f.projectId,declaredBytes:64,frameMs:500,segmentStartMs:0,segmentEndMs:2000,mediaSha256:"a".repeat(64),labelBn:null},NOW);await files.blobs.put(anchor.pathname,new Uint8Array(16));await finalizeAnchor(store,anchor.id,{size:16,contentType:"image/jpeg"},NOW);await files.blobs.put(`v/${f.projectId}/orphan.mp4`,new Uint8Array(3));
    const track=trackFor(f);await publishTrack(store,f.jobId,proof,track,NOW);await store.query(sql`INSERT INTO reviews(track_version_id,manifest_hash,renderer_profile,reviewer_ref,verdict) VALUES (${track.trackVersionId},'synthetic','synthetic','test-fixture','reviewed_needs_changes')`);
    await store.query(sql`UPDATE projects SET visibility='unlisted',share_token_hash=decode(${'b'.repeat(64)},'hex') WHERE id=${f.projectId}`);
    await deleteProject(store,f.projectId,NOW);expect(await visibleProject(store,f.projectId)).toBeNull();expect(await visibleTrack(store,track.trackVersionId)).toBeNull();expect(await visibleMedia(store,video.id)).toBeNull();expect((await store.query(sql`SELECT share_token_hash FROM projects WHERE id=${f.projectId}`))[0]).toEqual({share_token_hash:null});
    let fault:StateStore=store;
    if(interrupt==="sql"){const dialect=new PgDialect();fault={...store,transaction:work=>store.transaction(q=>work({async query<T extends object>(statement:SQL){if(dialect.sqlToQuery(statement).sql.startsWith("DELETE FROM projects"))throw new Error("interrupted SQL commit");return q.query<T>(statement);}}))};}
    else files.blobs.failAt=interrupt;
    await expect(purgeProject(fault,files.blobs,f.projectId,later(900_001))).rejects.toThrow("interrupted");expect(BigInt((await totals()).committed_bytes)).toBe(48n);
    files.blobs.failAt=null;const counters=await reconcile(store,files.blobs,{dispatch:id=>dispatch(id,later(900_001))},{now:later(900_001)});expect(counters.purged).toBe(1);expect(counters.reservationsConverted).toBe(1);
    expect(await store.query(sql`SELECT id FROM projects WHERE id=${f.projectId}`)).toEqual([]);expect(await files.blobs.list(`v/${f.projectId}/`)).toEqual([]);expect(await files.blobs.list(`a/${f.projectId}/`)).toEqual([]);
    expect(await store.query(sql`SELECT cache_key FROM stage_results ORDER BY cache_key`)).toEqual([{cache_key:"shared"}]);expect(await store.query(sql`SELECT id FROM spend_reservations`)).toHaveLength(1);expect(BigInt((await totals()).committed_bytes)).toBe(0n);expect(BigInt((await totals()).pending_bytes)).toBe(0n);
    expect(await purgeProject(store,files.blobs,f.projectId,later(601_000))).toBe(false);await assertBudgetInvariant(store);
  });
  test("F8: expired lease holders cannot reserve, settle, write cache or publish",async()=>{
    const f=await projectFixture(store,{driver:"lease"}),first=await claimLease(store,f.jobId,"first",NOW);if(!first)throw new Error("Lease missing");
    expect(await claimLease(store,f.jobId,"other",NOW)).toBeNull();const request={jobId:f.jobId,proof:first,stage:"meaning" as const,segmentIdx:0,cacheKey:"lease",attemptNo:1,upperBound:1000n};const reservation=await reserveAttempt(store,request,NOW);if(reservation.status!=="reserved")throw new Error("Reserve missing");
    const second=await claimLease(store,f.jobId,"second",later(150_001));expect(second?.leaseEpoch).toBe(first.leaseEpoch+1n);
    expect((await reserveAttempt(store,{...request,attemptNo:2},later(150_001))).status).toBe("fenced");expect(await settleAttempt(store,reservation.id,first,"settled",10n,later(150_001))).toBe(false);expect(await writeStageResult(store,f.jobId,first,stage("late-lease"),later(150_001))).toBeNull();expect((await publishTrack(store,f.jobId,first,trackFor(f),later(150_001))).status).toBe("fenced");
    expect(await releaseLease(store,f.jobId,first,later(150_001))).toBe(false);expect(await releaseLease(store,f.jobId,second!,later(150_001))).toBe(true);expect(await sweepSpend(store,later(600_001))).toBe(1);await assertBudgetInvariant(store);
  });
  test("T24: deletion waits out issued upload leases, then removes a late object",async()=>{
    const f=await projectFixture(store,{job:false}),video=await reserveMedia(store,mediaInput(f.projectId),NOW);await deleteProject(store,f.projectId,NOW);
    expect(await purgeProject(store,files.blobs,f.projectId,NOW)).toBe(false);expect(await visibleProject(store,f.projectId)).toBeNull();
    await files.blobs.put(video.pathname,new Uint8Array(64));expect(BigInt((await totals()).pending_bytes)).toBe(128n);
    expect(await purgeProject(store,files.blobs,f.projectId,later(900_001))).toBe(true);expect(await files.blobs.list(`v/${f.projectId}/`)).toEqual([]);expect(BigInt((await totals()).pending_bytes)).toBe(0n);
  });
  test("T24: a concurrent new reference survives exclusive-cache purge",async()=>{
    const a=await projectFixture(store),b=await projectFixture(store);await claimRun(store,a.jobId,"a",NOW);await claimRun(store,b.jobId,"b",NOW);await writeStageResult(store,a.jobId,{runId:"a"},stage("reference-race"),NOW);await deleteProject(store,a.projectId,NOW);
    let reached!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>reached=r),pause=new Promise<void>(r=>release=r),dialect=new PgDialect();
    const gated:StateStore={...store,transaction:work=>store.transaction(q=>work({async query<T extends object>(statement:SQL){const rows=await q.query<T>(statement);if(dialect.sqlToQuery(statement).sql.startsWith("SELECT cache_key,output,output_hash FROM stage_results")){reached();await pause;}return rows;}}))};
    const referencing=writeStageResult(gated,b.jobId,{runId:"b"},stage("reference-race"),NOW);await entered;const deleting=purgeProject(store,files.blobs,a.projectId,NOW);
    try{await waitForLock();}finally{release();}await Promise.all([referencing,deleting]);
    expect(await store.query(sql`SELECT cache_key FROM stage_results`)).toEqual([{cache_key:"reference-race"}]);expect(await store.query(sql`SELECT project_id FROM stage_result_refs`)).toEqual([{project_id:b.projectId}]);
  });
  test("Reconciler removes only unreferenced stage content older than 30 days",async()=>{
    const f=await projectFixture(store),old=new Date(NOW.getTime()-31*86_400_000);
    for(const key of ["old-orphan","old-shared"])await store.query(sql`INSERT INTO stage_results(cache_key,stage,schema_version,model_id,prompt_version,output,output_hash,validation,created_at) VALUES (${key},'meaning','meaning-v2','fake','1','{}','hash','{}',${old})`);
    await store.query(sql`INSERT INTO stage_result_refs(project_id,cache_key) VALUES (${f.projectId},'old-shared')`);
    const counters=await reconcile(store,files.blobs,{dispatch:id=>dispatch(id,NOW)},{now:NOW});expect(Object.keys(counters).sort()).toEqual(["fenced","purged","redispatched","reservationsConverted","storageReleased"]);
    expect(await store.query(sql`SELECT cache_key FROM stage_results`)).toEqual([{cache_key:"old-shared"}]);
  });
  test("Spend math includes request/schema bytes, output reasoning once, and integer upper bounds",()=>{
    const prices={inputMicrosPerMillion:2_000_000n,outputMicrosPerMillion:10_000_000n};expect(attemptUpperBound("ক",4000,prices)).toBe(41_006n);expect(usageCost({inputTokens:10,outputTokens:20,reasoningTokens:15},prices)).toBe(220n);
  });
  test("Daily reconciliation drains a 107-object retention backlog rather than stopping after one batch",async()=>{
    const f=await projectFixture(store,{job:false}),old=new Date(NOW.getTime()-31*86_400_000);
    for(let i=0;i<107;i++){await reserveMedia(store,mediaInput(f.projectId,10),NOW);await store.query(sql`INSERT INTO stage_results(cache_key,stage,schema_version,model_id,prompt_version,output,output_hash,validation,created_at) VALUES (${'old-'+i},'meaning','meaning-v2','fake','1','{}','hash','{}',${old})`);}
    const result=await reconcile(store,files.blobs,{dispatch:id=>dispatch(id,NOW)},{now:later(900_001),opportunistic:false});expect(result.storageReleased).toBe(107);expect(BigInt((await totals()).pending_bytes)).toBe(0n);expect(await store.query(sql`SELECT cache_key FROM stage_results`)).toEqual([]);
  });
}
