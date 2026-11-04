import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {readFile,writeFile,mkdir} from "node:fs/promises";
const edge=existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")||existsSync("C:/Program Files/Microsoft/Edge/Application/msedge.exe")||existsSync("/opt/microsoft/msedge/msedge");
const projects=["chromium",...(edge?["msedge"]:[])],root="docs/evidence/hardening-2026-11-05",legacy=process.env.SIGNBRIDGE_EVIDENCE_PHASE==="7"?"docs/evidence/phase-7/recheck/browser-results.json":"docs/evidence/phase-6/browser-results.json";
await mkdir(root,{recursive:true});const runs=[];
for(const [index,project] of projects.entries()){
 // Each invocation owns its server lifecycle and resets the dedicated local fixture DB.
 // Browser tests must not consume one another's genuine hourly IP/owner admission limits.
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,["node_modules/@playwright/test/cli.js","test","--config","playwright.product.config.ts","--project",project,...process.argv.slice(2)],{stdio:"inherit",windowsHide:true,env:{...process.env,SIGNBRIDGE_PRODUCT_PREBUILT:index===0?"false":"true"}});child.once("error",reject);child.once("close",resolve);});
 const output=`${root}/browser-${project}.json`;if(existsSync(legacy))await writeFile(output,await readFile(legacy));runs.push({project,exitCode:code,evidence:output});if(code!==0){process.exitCode=Number(code)||1;break;}
}
await writeFile(root+"/browser-runs.json",JSON.stringify({fixtureIsolation:"Fresh dedicated local fixture database for each browser; production limits unchanged",requestedProjects:projects,runs},null,2)+"\n");
