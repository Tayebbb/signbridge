import {readFile,writeFile,mkdir,rename} from "node:fs/promises";
import {resolve,dirname,extname} from "node:path";
import {pathToFileURL} from "node:url";
import {createHash} from "node:crypto";
import {z} from "zod";
import {parseSrt} from "../lib/domain/captions/parseSrt";
import {parseVtt} from "../lib/domain/captions/parseVtt";
import {segmentCues} from "../lib/domain/segmentation";
import {createDatabase} from "../lib/db/client";
import {createOwnerCapability,hashOwnerToken,OWNER_COOKIE_NAME} from "../lib/auth/ownerCookie";
import {ensureOwner,ownedProject} from "../lib/db/queries/api";
import {pinDemo,demoBudgetSnapshot} from "../lib/db/queries/demo";
import {budgetSignal} from "../lib/db/queries/spend";
import {dayScope} from "../lib/domain/limits";
const digest=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
export const demoConfigSchema=z.strictObject({rightsAttested:z.literal(true),clips:z.array(z.strictObject({
  id:z.string().regex(/^[a-z0-9-]{1,40}$/u),title:z.string().min(1).max(120),video:z.string().min(1),captions:z.string().min(1),
  durationMs:z.number().int().positive().max(90000),width:z.number().int().positive().max(8192),height:z.number().int().positive().max(8192),expectUnsupported:z.boolean(),
})).min(2).max(3)}).superRefine((c,ctx)=>{if(new Set(c.clips.map(x=>x.id)).size!==c.clips.length)ctx.addIssue({code:"custom",message:"Demo IDs must be unique"});if(!c.clips.some(x=>x.expectUnsupported)||!c.clips.some(x=>!x.expectUnsupported))ctx.addIssue({code:"custom",message:"Include a covered demo and an intentionally unsupported demo"});});
export async function prepareDemos(configPath:string){
  const config=demoConfigSchema.parse(JSON.parse(await readFile(configPath,"utf8"))),root=dirname(resolve(configPath));
  return Promise.all(config.clips.map(async clip=>{
    const videoPath=resolve(root,clip.video),bytes=await readFile(videoPath),text=await readFile(resolve(root,clip.captions),"utf8"),format=extname(clip.captions).toLowerCase()===".vtt"?"vtt":"srt";
    if(![".mp4",".webm"].includes(extname(videoPath).toLowerCase())||!bytes.length||bytes.length>15728640)throw Error("Demo video must be MP4/WebM, nonempty and at most 15 MB");
    if(Buffer.byteLength(text)>65536)throw Error("Demo captions exceed 64 KB");
    const segments=segmentCues(format==="vtt"?parseVtt(text):parseSrt(text));if(!segments.length||segments.length>20||segments.at(-1)!.endMs>clip.durationMs)throw Error("Demo caption timing/segment limits failed");
    return {...clip,bytes,text,format,sha256:digest(bytes),segments:segments.length,contentType:extname(videoPath).toLowerCase()===".webm"?"video/webm":"video/mp4"};
  }));
}
interface SeedState {origin:string;ownerToken:string;clips:Record<string,{fingerprint:string;projectId?:string;mediaId?:string;transcriptVersionId?:string;jobId?:string}>}
async function main(){
  const args=process.argv.slice(2),value=(flag:string)=>args[args.indexOf(flag)+1];
  if(args.includes("--help")){console.log("seed-demo [--config demo-input/demo.json] [--state checkpoint-name.json] [--apply --origin https://deployment --budget-micros APPROVED_LIMIT]. Default dry run reads only demo files. Apply requires owner-approved DATABASE_URL for that deployment; no environment file is loaded. Optional VERCEL_AUTOMATION_BYPASS_SECRET is sent only to that deployment origin. Owner capability/checkpoints stay in ignored .data/. Never put credentials in arguments.");return;}
  const demos=await prepareDemos(args.includes("--config")?value("--config"):"demo-input/demo.json");
  if(!args.includes("--apply")){console.log(JSON.stringify({mode:"DRY RUN",clips:demos.map(d=>({id:d.id,bytes:d.bytes.length,sha256:d.sha256,segments:d.segments,expectUnsupported:d.expectUnsupported})),modelCalls:0}));return;}
  const origin=new URL(value("--origin"));if(origin.protocol!=="https:"||origin.pathname!=="/"||origin.search||origin.hash||origin.username||origin.password)throw Error("A bare HTTPS deployment origin is required");
  const maxMicros=BigInt(value("--budget-micros"));if(maxMicros<=0n||maxMicros>4000000n)throw Error("Explicit approved demo budget must be at most USD 4");
  if(!process.env.DATABASE_URL)throw Error("Approved DATABASE_URL is required; local fallback is forbidden");
  const stateName=args.includes("--state")?value("--state"):"phase7-demo-state.json";
  if(!/^[a-z0-9-]+\.json$/u.test(stateName))throw Error("Checkpoint must be a JSON basename inside .data");
  const statePath=resolve(".data",stateName),db=await createDatabase({url:process.env.DATABASE_URL});
  let state:SeedState;try{state=JSON.parse(await readFile(statePath,"utf8"));}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;state={origin:origin.origin,ownerToken:createOwnerCapability().token,clips:{}};}
  if(state.origin!==origin.origin)throw Error("Checkpoint belongs to another deployment; keep a separate checkpoint per preview/production origin");
  const save=async()=>{await mkdir(dirname(statePath),{recursive:true});await writeFile(statePath+".tmp",JSON.stringify(state),{mode:0o600});await rename(statePath+".tmp",statePath);};
  const request=async <T>(path:string,method="GET",body?:unknown,key?:string):Promise<T>=>{
    const url=new URL(path,origin);if(url.origin!==origin.origin)throw Error("Demo requests must stay on the approved deployment origin");
    const response=await fetch(url,{method,redirect:"error",signal:AbortSignal.timeout(30000),headers:{Origin:origin.origin,Cookie:`${OWNER_COOKIE_NAME}=${state.ownerToken}`,"Content-Type":"application/json",...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{"x-vercel-protection-bypass":process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{}),...(key?{"Idempotency-Key":key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok)throw Error(`Demo API ${response.status}; inspect admin metrics (no response or captions logged)`);return response.json() as Promise<T>;
  };
  await save();
  let before:Awaited<ReturnType<typeof demoBudgetSnapshot>>=[];
  try{
    const ownerId=await ensureOwner(db.state,hashOwnerToken(state.ownerToken));await budgetSignal(db.state);before=await demoBudgetSnapshot(db.state);
    const life=before.find(b=>b.scope==="lifetime")!,day=before.find(b=>b.scope===dayScope(new Date()))!;
    if(BigInt(life.cap_micros)-BigInt(life.spent_micros)>maxMicros||BigInt(day.cap_micros)-BigInt(day.spent_micros)>maxMicros)throw Error("Before seeding, configure both database budgets within the approved remaining amount; this tool never raises or restores a cap");
    for(const demo of demos){
      const fingerprint=digest(JSON.stringify({sha:demo.sha256,text:demo.text,title:demo.title,duration:demo.durationMs,width:demo.width,height:demo.height})),key=(action:string)=>digest(`${origin.origin}:${demo.id}:${fingerprint}:${action}`);
      let item=state.clips[demo.id];if(item&&item.fingerprint!==fingerprint)throw Error("Demo content changed; use a new demo ID rather than silently reprocessing");
      item??=state.clips[demo.id]={fingerprint};
      if(!item.projectId){item.projectId=(await request<{projectId:string}>("/api/projects","POST",{title:demo.title,rightsAttested:true},key("project"))).projectId;await save();}
      const p=await ownedProject(db.state,item.projectId,ownerId),base=`/api/projects/${p.id}`; // Confirms the URL and DATABASE_URL refer to the same database before any model call.
      if(!p.current_track_version_id){
        if(!item.mediaId){const init=await request<{mediaId:string;uploadUrl:string}>(base+"/media/init","POST",{contentType:demo.contentType,sizeBytes:demo.bytes.length,sha256:demo.sha256,durationMs:demo.durationMs,width:demo.width,height:demo.height},key("media"));
          const upload=await fetch(init.uploadUrl,{method:"PUT",redirect:"error",signal:AbortSignal.timeout(120000),headers:{"Content-Type":demo.contentType},body:demo.bytes});if(!upload.ok)throw Error("Demo media upload failed");await request(base+"/media/finalize","POST",{mediaId:init.mediaId},key("finalize"));item.mediaId=init.mediaId;await save();}
        if(!item.transcriptVersionId){item.transcriptVersionId=(await request<{transcriptVersion:{id:string}}>(base+"/transcripts","POST",{format:demo.format,text:demo.text},key("transcript"))).transcriptVersion.id;await save();}
        if(!item.jobId){item.jobId=(await request<{jobId:string}>(base+"/jobs","POST",{transcriptVersionId:item.transcriptVersionId},key("job"))).jobId;await save();}
        const deadline=Date.now()+600000;for(;;){const job=await request<{status:string}>(`/api/jobs/${item.jobId}`);if(!["queued","running"].includes(job.status)){if(!["succeeded","partial"].includes(job.status))throw Error("Demo job stopped; inspect before explicitly retrying");break;}if(Date.now()>deadline)throw Error("Demo job still running; resume from the checkpoint without another job");await new Promise(r=>setTimeout(r,3000));}
      }
      console.log(JSON.stringify({...await pinDemo(db.state,{projectId:p.id,ownerId,sha256:demo.sha256,expectUnsupported:demo.expectUnsupported}),url:new URL(`/p/${p.id}`,origin).href}));
    }
  }finally{
    try{if(before.length){const after=await demoBudgetSnapshot(db.state),lifeBefore=before.find(b=>b.scope==="lifetime")!,lifeAfter=after.find(b=>b.scope==="lifetime")!;console.log(JSON.stringify({seedSpendMicros:(BigInt(lifeAfter.spent_micros)-BigInt(lifeBefore.spent_micros)).toString(),lifetimeSpentMicros:lifeAfter.spent_micros,reservedMicros:lifeAfter.reserved_micros,capMicros:lifeAfter.cap_micros}));}}finally{await db.close();}
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(async error=>{await mkdir(".data",{recursive:true});await writeFile(".data/demo-seed-error.json",JSON.stringify({name:error instanceof Error?error.name:"unknown",message:error instanceof Error?error.message:"unknown"}),{mode:0o600});console.error("Demo seed stopped. Check inputs, checkpoint and admin metrics; credentials, signed URLs and captions are omitted.");process.exitCode=1;});
