// Offline SQL eligibility check. Always uses an isolated in-memory database, never DATABASE_URL.
import {readFile,writeFile} from "node:fs/promises";
import {createDatabase} from "../lib/db/client";
import {applyCorpusSeed} from "../lib/db/queries/corpusSeed";
import {eligibleAssets} from "../lib/db/queries/api";
import {sha256} from "../lib/domain/fingerprints";
import type {AssetRenderCheck} from "./corpus-import";
const checks=JSON.parse(await readFile("docs/evidence/phase-7/asset-render-checks.json","utf8")) as {asset_render_checks:AssetRenderCheck[]};
const seed=await readFile(".data/phase7-corpus/seed.sql","utf8"),db=await createDatabase();
try{
  await db.migrate();await applyCorpusSeed(db.state,seed);await applyCorpusSeed(db.state,seed);
  const eligible=await eligibleAssets(db.state),expected=checks.asset_render_checks.filter(c=>c.passed);
  if(!eligible.length||eligible.length!==expected.length)throw Error("Eligible subset does not match successful render probes");
  for(const a of eligible){const c=expected.find(x=>x.assetId===a.id);if(!c||c.derivedSha256!==a.derivedSha256||c.signs!==a.unitCount||sha256(a.derivedSigml)!==a.derivedSha256)throw Error("Eligibility does not match exact rendered bytes");}
  const result={status:"PASS",database:db.kind,production:false,eligible:eligible.length,allEligibleRenderedOk:true,allHashesMatch:true,seedApplications:2,modelCalls:0};
  await writeFile("docs/evidence/phase-7/curated-seed.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
}finally{await db.close();}
