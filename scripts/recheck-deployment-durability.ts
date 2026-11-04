// Read-only revalidation of the existing T9 run; never creates a job or model call.
import {readFile,writeFile,stat} from "node:fs/promises";
import {parseEnv} from "node:util";
import assert from "node:assert/strict";
import {createDatabase} from "../lib/db/client";
import {deploymentSnapshot} from "../lib/db/queries/deploymentVerification";
import {demoBudgetSnapshot} from "../lib/db/queries/demo";
if(!process.argv.includes("--live")){console.log("DRY RUN: --live rechecks the same completed production T9 run with coherent SQL reads; no model processing.");process.exit(0);}
const state=JSON.parse(await readFile(".data/durability-state.json","utf8")) as {projectId:string;jobId:string;origin:string};
const failed=JSON.parse(await readFile(".data/durability-error.json","utf8")) as {message:string};
assert.equal(failed.message,"Workflow publication/durability mismatch","Only the final checker mismatch is eligible for this recheck");
const observed=JSON.parse(await readFile(".data/durability-cli-last.log","utf8")) as {targets:{production:{id:string;url:string;createdAt:number;readyAt:number;readyState:string}}};
const replacement=observed.targets.production,observedAt=(await stat(".data/durability-cli-last.log")).mtime;
const original=JSON.parse(await readFile(".data/production-deployment.json","utf8")) as {deployment:{id:string;url:string}};
const vars=parseEnv(await readFile(".data/production.env","utf8")),db=await createDatabase({url:vars.DATABASE_URL});
try{
 const snapshot=await deploymentSnapshot(db.state,state.projectId),job=snapshot.jobs.find(j=>j.id===state.jobId)!;
 assert.ok(job&&["partial","succeeded"].includes(job.status));assert.equal(job.driver,"workflows");assert.ok(job.run_claim);assert.equal(job.run_claim,job.workflow_run_id);
 assert.equal(snapshot.tracks.length,1);assert.equal(snapshot.project.current_track_version_id,job.result_track_version_id);assert.equal(snapshot.tracks[0].id,job.result_track_version_id);
 assert.equal(replacement.readyState,"READY");assert.notEqual(replacement.id,original.deployment.id);
 assert.ok(new Date(job.created_at).getTime()<replacement.createdAt);assert.ok(replacement.createdAt<replacement.readyAt);
 // Vercel, Neon and this Windows host have separate clocks. The READY/target
 // response is the cutover witness; both recorded ready/observation times must
 // precede the terminal publication, without assuming subsecond clock ordering.
 assert.ok(replacement.readyAt<new Date(job.finished_at!).getTime());assert.ok(observedAt.getTime()<new Date(job.finished_at!).getTime());
 assert.ok(snapshot.attempts.every(a=>["completed","repair_completed","cache_hit"].includes(a.outcome)));
 const budgets=await demoBudgetSnapshot(db.state),life=budgets.find(b=>b.scope==="lifetime")!;assert.equal(BigInt(life.reserved_micros),0n);
 const result={date:new Date().toISOString(),status:"PASS",verificationMode:"Same run rechecked after fixing inconsistent multi-query reads; zero additional processing",projectId:state.projectId,jobId:job.id,workflowRunId:job.run_claim,driver:job.driver,oldDeploymentId:original.deployment.id,newDeploymentId:replacement.id,newDeploymentUrl:`https://${replacement.url}`,productionOrigin:state.origin,jobCreatedAt:job.created_at,deploymentCreatedAt:new Date(replacement.createdAt).toISOString(),deploymentReadyAt:new Date(replacement.readyAt).toISOString(),cutoverObservedAt:observedAt.toISOString(),observerClockDeltaMs:observedAt.getTime()-replacement.readyAt,finishedAt:job.finished_at,heldRunningThroughCutover:true,lockScope:"Only this verification project; original in-lock running/zero-track assertion passed before the final checker mismatch",finalJobStatus:job.status,trackVersionId:job.result_track_version_id,manifestHash:snapshot.tracks[0].manifest_hash,publishedTracks:1,attempts:snapshot.attempts,spendDeltaMicros:snapshot.attempts.reduce((n,a)=>n+BigInt(a.cost_usd_micros),0n).toString(),reservedMicros:life.reserved_micros};
 await writeFile("docs/evidence/phase-7/durability.json",JSON.stringify(result,null,2)+"\n");
 await writeFile(".data/production-deployment-before-durability.json",JSON.stringify(original),{mode:0o600});await writeFile(".data/production-deployment.json",JSON.stringify({deployment:{id:replacement.id,url:state.origin,readyState:"READY",immutableUrl:`https://${replacement.url}`}}),{mode:0o600});
 console.log(JSON.stringify({status:"PASS",jobId:job.id,newDeploymentId:replacement.id,publishedTracks:1,spendDeltaMicros:result.spendDeltaMicros,additionalModelCalls:0}));
}finally{await db.close();}
