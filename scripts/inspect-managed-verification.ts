import {readFile,writeFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {createDatabase} from "../lib/db/client";
import {deploymentSnapshot} from "../lib/db/queries/deploymentVerification";
import {demoBudgetSnapshot} from "../lib/db/queries/demo";
if(!process.argv.includes("--live")){console.log("DRY RUN: --live reads only the approved preview/production SQL verification state and budgets.");process.exit(0);}
const results=await Promise.all(["preview","production"].map(async target=>{
 const vars=parseEnv(await readFile(`.data/${target}.env`,"utf8")),db=await createDatabase({url:vars.DATABASE_URL});
 try{
  let state:{clips:Record<string,{projectId?:string}>}|null=null;try{state=JSON.parse(await readFile(`.data/${target}-demo-state.json`,"utf8"));}catch{/* No project has been created yet. */}
  const projects=await Promise.all(Object.entries(state?.clips??{}).filter(([,c])=>c.projectId).map(async([clip,c])=>({clip,...await deploymentSnapshot(db.state,c.projectId!)})));
  const budgets=await demoBudgetSnapshot(db.state);await writeFile(`.data/${target}-verification-snapshot.json`,JSON.stringify({target,projects,budgets},null,2)+"\n",{mode:0o600});
  const life=budgets.find(b=>b.scope==="lifetime")!;
  return {target,spentMicros:life.spent_micros,reservedMicros:life.reserved_micros,capMicros:life.cap_micros,projects:projects.map(p=>({clip:p.clip,projectId:p.project.id,jobs:p.jobs.map(j=>({id:j.id,status:j.status,driver:j.driver,runClaimed:!!j.run_claim})),attempts:p.attempts.length,tracks:p.tracks.length}))};
 }finally{await db.close();}
}));
const smoke=18616n,counted=smoke+results.reduce((sum,r)=>sum+BigInt(r.spentMicros),0n),reserved=results.reduce((sum,r)=>sum+BigInt(r.reservedMicros),0n);
if(counted+reserved>4000000n)throw Error("Approved global ceiling exceeded");
const evidence={date:new Date().toISOString(),approvedCeilingMicros:"4000000",countedUsageMicros:counted.toString(),reservedMicros:reserved.toString(),smokeMicros:smoke.toString(),funding:"Existing OpenAI API credits; no purchases or billing changes",note:"Returned usage and SQL metering; not a reconciled provider invoice",databases:results};
await writeFile("docs/evidence/phase-7/credit-usage.json",JSON.stringify(evidence,null,2)+"\n");console.log(JSON.stringify(evidence));
