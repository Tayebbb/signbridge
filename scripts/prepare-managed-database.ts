// Explicit deployment preparation only. Credentials remain in the ignored environment file.
import {readFile,writeFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {createDatabase} from "../lib/db/client";
import {applyCorpusSeed} from "../lib/db/queries/corpusSeed";
import {configureBudgets} from "../lib/db/queries/spend";
import {eligibleAssets} from "../lib/db/queries/api";
const target=process.argv.includes("--target")?process.argv[process.argv.indexOf("--target")+1]:null;
if(!process.argv.includes("--live")){console.log("DRY RUN: --live --target preview|production applies additive migrations, curated seed and bounded SQL budgets to the approved new Neon project.");process.exit(0);}
if(target!=="production"&&target!=="preview")throw Error("An explicit target is required");
const vars=parseEnv(await readFile(`.data/${target}.env`,"utf8"));if(!vars.DATABASE_URL)throw Error("Approved target database URL is not configured");
const other=parseEnv(await readFile(`.data/${target==="production"?"preview":"production"}.env`,"utf8"));if(vars.DATABASE_URL===other.DATABASE_URL)throw Error("Preview and production must be isolated");
const cap=target==="production"?700000n:300000n,db=await createDatabase({url:vars.DATABASE_URL});
try{
  await db.migrate();await applyCorpusSeed(db.state,await readFile(".data/phase7-corpus/seed.sql","utf8"));await configureBudgets(db.state,cap,cap);
  const assets=await eligibleAssets(db.state);if(assets.length!==12)throw Error("Managed corpus eligibility mismatch");
  const result={target,database:db.kind,additiveMigrations:true,eligible:assets.length,lifetimeCapMicros:cap.toString(),dailyCapMicros:cap.toString(),modelCalls:0};
  await writeFile(`docs/evidence/phase-7/${target}-database.json`,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
}finally{await db.close();}
