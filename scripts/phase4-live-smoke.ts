import {readFile,mkdir,writeFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {sql} from "drizzle-orm";
import {createDatabase} from "../lib/db/client";
import {ensureOwner,createProject,loadJob} from "../lib/db/queries/api";
import {createOwnerCapability} from "../lib/auth/ownerCookie";
import {submitTranscriptVersion} from "../lib/db/queries/authority";
import {reserveMedia,finalizeMedia} from "../lib/db/queries/storage";
import {configureBudgets} from "../lib/db/queries/spend";
import {OpenAIModelClient} from "../lib/ai/client";
import {runPipeline} from "../lib/jobs/steps";
import {applyCorpusSeed} from "../lib/db/queries/corpusSeed";
if(!process.argv.includes("--live")){
  console.log("DRY RUN: two synthetic caption segments; isolated PGlite; real OpenAI only with --live after owner approval; both spend caps USD 0.20.");
  process.exit(0);
}
if(!process.env.OPENAI_API_KEY)throw Error("Configure OPENAI_API_KEY locally after approving its use; never put a credential in an argument");
const evidenceDir=process.argv.includes("--evidence-dir")?process.argv[process.argv.indexOf("--evidence-dir")+1]:"docs/evidence/phase-4";
const db=await createDatabase();
try{
  await db.migrate();
  if(db.kind!=="pglite")throw Error("An isolated local database is required");
  await applyCorpusSeed(db.state,await readFile("data/corpus/seed.sql","utf8"));
  await configureBudgets(db.state,200_000n,200_000n);
  const owner=await ensureOwner(db.state,createOwnerCapability().tokenHash),{projectId}=await createProject(db.state,owner,"Synthetic live smoke",randomUUID());
  const media=await reserveMedia(db.state,{projectId,declaredBytes:32,contentType:"video/mp4",clientSha256:"a".repeat(64),clientDurationMs:4000});
  // No media upload or renderer claim: only the two-segment model/persistence pipeline is under test.
  await finalizeMedia(db.state,media.id,{size:32,contentType:"video/mp4"});
  const job=await submitTranscriptVersion(db.state,{projectId,baseVersionId:null,idempotencyKey:randomUUID(),cues:[{idx:0,startMs:0,endMs:2000,text:"আমি আসবে।"},{idx:1,startMs:2000,endMs:4000,text:"আমি আসবে না।"}]});
  await runPipeline({store:db.state,model:new OpenAIModelClient(process.env.OPENAI_API_KEY)},job.id,randomUUID());
  const state=await loadJob(db.state,job.id),attempts=await db.state.query(sql`SELECT segment_idx,stage,attempt_no,outcome,input_tokens,output_tokens,reasoning_tokens,cost_usd_micros FROM stage_attempts WHERE job_id=${job.id} ORDER BY segment_idx,stage,attempt_no`),budgets=await db.state.query(sql`SELECT * FROM spend_budgets ORDER BY scope`);
  const result={date:new Date().toISOString(),status:state.job.status,model:state.job.model_profile,fixtureSegments:2,ceilingUsd:0.20,attempts,budgets};
  await mkdir(evidenceDir,{recursive:true});await writeFile(`${evidenceDir}/live-smoke.json`,JSON.stringify(result,(_,v)=>typeof v==="bigint"?v.toString():v,2)+"\n");
  const completePair=[0,1].every(idx=>["meaning","plan"].every(stage=>attempts.some(a=>a.segment_idx===idx&&a.stage===stage&&["completed","repair_completed"].includes(String(a.outcome))&&a.input_tokens!==null&&a.output_tokens!==null)));
  if(!["succeeded","partial"].includes(state.job.status)||!completePair)throw Error("Smoke did not complete both metered stages per segment; inspect recorded nonsecret evidence");
  console.log(JSON.stringify(result,(_,v)=>typeof v==="bigint"?v.toString():v));
}finally{await db.close();}
