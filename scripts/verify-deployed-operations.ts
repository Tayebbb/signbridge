import {readFile,writeFile} from "node:fs/promises";
import {spawn} from "node:child_process";
import {sameEntityTag} from "../lib/domain/entityTag";
if(!process.argv.includes("--live")){console.log("DRY RUN: --live verifies the approved production health/admin/cron and curl HEAD headers; no model processing is requested.");process.exit(0);}
async function main(){
 const deployment=JSON.parse(await readFile(".data/production-deployment.json","utf8")),origin=new URL((deployment.deployment??deployment).url).origin;
 const state=JSON.parse(await readFile(".data/production-demo-state.json","utf8")) as {ownerToken:string;clips:Record<string,{projectId:string}>};
 const tokens=(JSON.parse(await readFile(".data/server-tokens.json","utf8")) as {production:{admin:string;cron:string}}).production;
 const bypass=(JSON.parse(await readFile(".data/automation-bypass.json","utf8")) as {secret:string}).secret;
 const headers={"x-vercel-protection-bypass":bypass,Cookie:`__Host-signbridge-owner=${state.ownerToken}`};
 async function request(path:string,authorization?:string){const r=await fetch(origin+path,{redirect:"error",headers:{...headers,...(authorization?{Authorization:`Bearer ${authorization}`}:{})}});if(r.status!==200)throw Error(`Operational API status ${r.status}`);return {status:r.status,body:await r.json() as Record<string,unknown>};}
 const health=await request("/api/health"),adminBefore=await request("/api/admin/status",tokens.admin),cron=await request("/api/cron/reconcile",tokens.cron),adminAfter=await request("/api/admin/status",tokens.admin);
 if(adminAfter.body.stageAttemptCount!==adminBefore.body.stageAttemptCount)throw Error("Operational checks initiated unexpected processing");
 const current=(await request(`/api/projects/${state.clips["sample-a"].projectId}/track`)).body as {trackVersionId:string;manifestHash:string};
 const url=`${origin}/api/tracks/${current.trackVersionId}/manifest`,config=[`url = "${url}"`,...Object.entries(headers).map(([key,value])=>`header = "${key}: ${value}"`)].join("\n")+"\n";
 await writeFile(".data/phase7-curl.config",config,{mode:0o600});
 const curl=await new Promise<{code:number|null;out:string}>((res,rej)=>{let out="";const p=spawn("curl.exe",["--silent","--show-error","--head","--config",".data/phase7-curl.config"],{windowsHide:true,stdio:["ignore","pipe","ignore"]});p.stdout.on("data",c=>out+=c);p.on("error",rej);p.on("close",code=>res({code,out}));});
 if(curl.code!==0)throw Error("curl HEAD failed");await writeFile(".data/phase7-curl-headers.txt",curl.out,{mode:0o600});
 const etag=curl.out.match(/^etag:\s*(.+)$/imu)?.[1]?.trim()??null,cache=curl.out.match(/^cache-control:\s*(.+)$/imu)?.[1]?.trim(),status=Number(curl.out.match(/^HTTP\/\S+ (\d+)/mu)?.[1]);
 if(status!==200||!sameEntityTag(etag,`"${current.manifestHash}"`)||!cache?.includes("private, no-cache"))throw Error("HEAD cache/identity mismatch");
 const result={date:new Date().toISOString(),origin,status:"PASS",health,admin:adminAfter,cron,curlHead:{exitCode:curl.code,status,etag,cacheControl:cache},additionalModelCalls:0};
 await writeFile("docs/evidence/phase-7/operations.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify({status:"PASS",health:health.status,admin:adminAfter.status,cron:cron.status,curlHead:status}));
}
main().catch(()=>{console.error("Deployed operations check failed; no credentials or response body logged");process.exitCode=1;});
