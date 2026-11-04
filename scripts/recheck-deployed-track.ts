import {readFile,writeFile} from "node:fs/promises";
import {TrackStore} from "../lib/player/store";
if(!process.argv.includes("--live")){console.log("DRY RUN: --live --target preview|production|replay replays existing tracks only; zero processing calls.");process.exit(0);}
const target=process.argv[process.argv.indexOf("--target")+1];if(!["preview","production","replay"].includes(target))throw Error("An explicit approved target is required");
const d=JSON.parse(await readFile(`.data/${target}-deployment.json`,"utf8")),origin=new URL((d.deployment??d).url).origin;
const state=JSON.parse(await readFile(`.data/${target==="replay"?"preview":target}-demo-state.json`,"utf8")) as {ownerToken:string;clips:Record<string,{projectId:string}>};
const bypass=(JSON.parse(await readFile(".data/automation-bypass.json","utf8")) as {secret:string}).secret;
const observations:{status:number;etag:string|null;encoding:string|null;cacheControl:string|null}[]=[];
const fetcher:typeof fetch=async(input,init)=>{
 const url=new URL(String(input),origin);if(url.origin!==origin)throw Error("Foreign request forbidden");
 const headers=new Headers(init?.headers);headers.set("Cookie",`__Host-signbridge-owner=${state.ownerToken}`);headers.set("x-vercel-protection-bypass",bypass);headers.set("Accept-Encoding","gzip, deflate, br");
 const response=await fetch(url,{...init,headers,redirect:"error"});observations.push({status:response.status,etag:response.headers.get("etag"),encoding:response.headers.get("content-encoding"),cacheControl:response.headers.get("cache-control")});return response;
};
try{
 const store=new TrackStore(state.clips["sample-a"].projectId,fetcher),first=await store.refresh(),again=await store.refresh();
 if(!first||again?.changed||again?.manifest!==first.manifest)throw Error("Replay identity changed");
 const evidence={date:new Date().toISOString(),target,origin,status:"PASS",manifestHash:first.current.manifestHash,observations,additionalModelCalls:0};
 await writeFile(`docs/evidence/phase-7/${target}-track-recheck.json`,JSON.stringify(evidence,null,2)+"\n");console.log(JSON.stringify(evidence));
}catch(error){console.log(JSON.stringify({target,status:"FAIL",reason:error instanceof Error?error.message:"unknown",observations}));process.exitCode=1;}
