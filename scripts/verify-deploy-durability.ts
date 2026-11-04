// Actual production T9: a row lock holds an already-running Workflow across the cutover.
// It changes no job state, prompt, plan or runtime pause feature.
import {readFile,writeFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {spawn} from "node:child_process";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {createDatabase} from "../lib/db/client";
import {ensureOwner} from "../lib/db/queries/api";
import {createOwnerCapability,hashOwnerToken,OWNER_COOKIE_NAME} from "../lib/auth/ownerCookie";
import {deploymentSnapshot,verificationCallInFlight,withDeploymentVerificationLock} from "../lib/db/queries/deploymentVerification";
import {demoBudgetSnapshot} from "../lib/db/queries/demo";
import {prepareDemos} from "./seed-demo";
if(!process.argv.includes("--live")){console.log("DRY RUN: --live performs the owner-approved production Workflow/redeploy test, using one original two-segment fixture and the existing SQL cap.");process.exit(0);}
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms)),digest=(s:string)=>createHash("sha256").update(s).digest("hex");
interface Deployment {id:string;url:string;readyState?:string}
async function vc<T>(args:string[]):Promise<T>{
 const result=await new Promise<{code:number|null;out:string;err:string}>((res,rej)=>{
  let out="",err="";const p=spawn(process.execPath,[resolve(".data/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/vc.js"),...args,"--scope","mdtayebibne-4755s-projects"],{windowsHide:true,stdio:["ignore","pipe","pipe"]});
  const timer=setTimeout(()=>p.kill(),60000);p.stdout.on("data",c=>out+=c);p.stderr.on("data",c=>err+=c);p.on("error",rej);p.on("close",code=>{clearTimeout(timer);res({code,out,err});});
 });
 await writeFile(".data/durability-cli-last.log",result.out+"\n"+result.err,{mode:0o600});if(result.code!==0)throw Error("Durability CLI operation failed; private diagnostic saved");return JSON.parse(result.out) as T;
}
interface State {origin:string;ownerToken:string;title:string;projectId?:string;mediaId?:string;transcriptId?:string;jobId?:string}
async function main(){
 const vars=parseEnv(await readFile(".data/production.env","utf8"));if(!vars.DATABASE_URL)throw Error("Approved production database required");
 const current=JSON.parse(await readFile(".data/production-deployment.json","utf8")) as {deployment:Deployment},old=current.deployment,origin=new URL(old.url).origin;
 const bypass=(JSON.parse(await readFile(".data/automation-bypass.json","utf8")) as {secret:string}).secret;
 let state:State;try{state=JSON.parse(await readFile(".data/durability-state.json","utf8"));}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;state={origin,ownerToken:createOwnerCapability().token,title:`Durability technical fixture ${new Date().toISOString()}`};}
 if(state.origin!==origin)throw Error("Existing durability checkpoint belongs to another source deployment");
 const save=()=>writeFile(".data/durability-state.json",JSON.stringify(state),{mode:0o600});await save();
 const db=await createDatabase({url:vars.DATABASE_URL}),before=await demoBudgetSnapshot(db.state);
 const request=async <T>(path:string,method="GET",body?:unknown):Promise<T>=>{
  const r=await fetch(origin+path,{method,redirect:"error",signal:AbortSignal.timeout(30000),headers:{Origin:origin,Cookie:`${OWNER_COOKIE_NAME}=${state.ownerToken}`,"x-vercel-protection-bypass":bypass,"Content-Type":"application/json","Idempotency-Key":digest(state.title+path)},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!r.ok)throw Error(`Durability API status ${r.status}`);return r.json() as Promise<T>;
 };
 try{
  const fixture=(await prepareDemos("demo-input/demo.json")).find(d=>d.expectUnsupported)!;
  await ensureOwner(db.state,hashOwnerToken(state.ownerToken));
  if(!state.projectId){state.projectId=(await request<{projectId:string}>("/api/projects","POST",{title:state.title,rightsAttested:true})).projectId;await save();}
  const base=`/api/projects/${state.projectId}`;
  if(!state.mediaId){const init=await request<{mediaId:string;uploadUrl:string}>(base+"/media/init","POST",{contentType:fixture.contentType,sizeBytes:fixture.bytes.length,sha256:fixture.sha256,durationMs:fixture.durationMs,width:fixture.width,height:fixture.height});const put=await fetch(init.uploadUrl,{method:"PUT",redirect:"error",headers:{"Content-Type":fixture.contentType},body:fixture.bytes});if(!put.ok)throw Error("Durability upload failed");await request(base+"/media/finalize","POST",{mediaId:init.mediaId});state.mediaId=init.mediaId;await save();}
  if(!state.transcriptId){state.transcriptId=(await request<{transcriptVersion:{id:string}}>(base+"/transcripts","POST",{format:fixture.format,text:fixture.text})).transcriptVersion.id;await save();}
  if(!state.jobId){state.jobId=(await request<{jobId:string}>(base+"/jobs","POST",{transcriptVersionId:state.transcriptId})).jobId;await save();}
  const readyDeadline=Date.now()+90000;let running:Awaited<ReturnType<typeof verificationCallInFlight>>;
  do{running=await verificationCallInFlight(db.state,state.projectId,state.jobId);if(running)break;if(Date.now()>readyDeadline)throw Error("No live reserved model stage observed; do not automatically create another paid job");await wait(250);}while(true);
  const lockedAt=new Date().toISOString();let replacement:Deployment|undefined,cutoverAt:string|undefined;
  await withDeploymentVerificationLock(db.state,state.projectId,state.jobId,async()=>{
   const deadline=Date.now()+200000;
   const created=await vc<{deployment?:Deployment}&Partial<Deployment>>(["deploy","--prod","--yes","--no-wait","--json"]),candidate=created.deployment??created;
   if(!candidate.id||!candidate.url)throw Error("Replacement metadata is incomplete");replacement={id:candidate.id,url:candidate.url};
   if(!replacement?.id||replacement.id===old.id)throw Error("No distinct replacement deployment");
   while(true){
    const inspected=await vc<Deployment>(["api",`/v13/deployments/${replacement.id}`]);
    if(["ERROR","CANCELED"].includes(inspected.readyState??""))throw Error("Replacement build failed");
    if(inspected.readyState==="READY"){
     const project=await vc<{targets?:{production?:{id?:string}}}>(["api","/v9/projects/prj_VDwFXfilMBeY57c9r3FN3bRXmOuV"]);
     if(project.targets?.production?.id===replacement.id){cutoverAt=new Date().toISOString();break;}
    }
    if(Date.now()>deadline)throw Error("Replacement did not cut over within the bounded SQL lock");await wait(5000);
   }
   const during=await deploymentSnapshot(db.state,state.projectId!);if(during.jobs.at(-1)?.status!=="running"||during.tracks.length)throw Error("Job must remain running through actual cutover");
  });
  const releasedAt=new Date().toISOString(),deadline=Date.now()+120000;let after:Awaited<ReturnType<typeof deploymentSnapshot>>;
  for(;;){after=await deploymentSnapshot(db.state,state.projectId);const j=after.jobs.at(-1)!;if(!["queued","running"].includes(j.status))break;if(Date.now()>deadline)throw Error("Workflow did not finish after cutover");await wait(1000);}
  const job=after.jobs.at(-1)!;if(!["succeeded","partial"].includes(job.status)||job.driver!=="workflows"||job.run_claim!==running!.run_claim||after.tracks.length!==1||after.project.current_track_version_id!==job.result_track_version_id)throw Error("Workflow publication/durability mismatch");
  const budgets=await demoBudgetSnapshot(db.state),life=(rows:typeof budgets)=>rows.find(b=>b.scope==="lifetime")!;
  const result={date:new Date().toISOString(),status:"PASS",projectId:state.projectId,jobId:state.jobId,workflowRunId:job.run_claim,driver:job.driver,oldDeploymentId:old.id,newDeploymentId:replacement!.id,newDeploymentUrl:replacement!.url,lockedAt,cutoverAt,releasedAt,finishedAt:job.finished_at,heldRunningThroughCutover:true,lockScope:"Only this newly created verification project; after OpenAI stage reservation and progress commit",finalJobStatus:job.status,trackVersionId:job.result_track_version_id,manifestHash:after.tracks[0].manifest_hash,publishedTracks:after.tracks.length,attempts:after.attempts,spendDeltaMicros:(BigInt(life(budgets).spent_micros)-BigInt(life(before).spent_micros)).toString(),reservedMicros:life(budgets).reserved_micros};
  await writeFile("docs/evidence/phase-7/durability.json",JSON.stringify(result,null,2)+"\n");
  await writeFile(".data/production-deployment-before-durability.json",JSON.stringify(current),{mode:0o600});await writeFile(".data/production-deployment.json",JSON.stringify({deployment:replacement}),{mode:0o600});console.log(JSON.stringify({status:"PASS",jobId:state.jobId,newDeploymentId:replacement!.id,spendDeltaMicros:result.spendDeltaMicros}));
 }finally{await db.close();}
}
main().catch(async error=>{await writeFile(".data/durability-error.json",JSON.stringify({name:error instanceof Error?error.name:"unknown",message:error instanceof Error?error.message:"unknown"}),{mode:0o600});console.error("Production durability check failed; private diagnostic saved, gate remains open");process.exitCode=1;});
