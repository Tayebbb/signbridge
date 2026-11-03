import {test,expect} from "vitest";
import {readFile} from "node:fs/promises";
import {importCorpus,corpusSeedSql,type CorpusInput,type CorpusImport,type AssetRenderCheck} from "../../scripts/corpus-import";
import {createDatabase} from "@/lib/db/client";
import {sha256} from "@/lib/domain/fingerprints";
test("Corpus: 20 real sample hashes dedupe, preserve attribution/aliases and derive exact units",async()=>{
  const inputs=JSON.parse(await readFile("tests/fixtures/corpus-samples.json","utf8")) as CorpusInput[];
  const corpus=importCorpus(inputs);
  expect(corpus.assets).toHaveLength(20);expect(corpus.rejected).toEqual([]);expect(corpus.release.license).toBe("CC-BY-4.0");expect(corpus.release.attribution).toContain("MD. Ashikul Islam");
  expect(corpus.assets.every(a=>!a.eligible&&a.renderState==="untested")).toBe(true);
  for(const a of corpus.assets){expect(a.derivedSha256).toBe(sha256(a.derivedSigml));expect(a.units).toHaveLength(a.unitCount);expect(a.units.map(u=>u.gloss)).toEqual(Array.from({length:a.unitCount},(_,i)=>`u${i}`));expect(a.sourceUrls.every(u=>u.startsWith("https://data.mendeley.com/public-files/"))).toBe(true);}
  expect(importCorpus(inputs.toReversed()).release.manifestSha256).toBe(corpus.release.manifestSha256);
  const duplicate={...inputs[0],sourcePath:"different/alias.sigml",sourceName:"alias.sigml"};
  const merged=importCorpus([...inputs,duplicate]);expect(merged.assets).toHaveLength(20);expect(merged.assets.find(a=>a.originalSha256===duplicate.sha256)?.sourcePaths).toContain(duplicate.sourcePath);
  expect(()=>importCorpus([{...inputs[0],sha256:"mismatch"}])).toThrow("hash mismatch");
});
test("Corpus: render eligibility requires successful evidence bound to the exact derived bytes",async()=>{
  const inputs=JSON.parse(await readFile("tests/fixtures/corpus-samples.json","utf8")) as CorpusInput[],first=importCorpus(inputs).assets[0];
  const evidence={assetId:first.id,derivedSha256:first.derivedSha256,rendererProfile:"cwasa-vhg2026/anna/speed0",passed:true,signs:first.unitCount,frames:10,frameEvents:10,elapsedMs:500};
  expect(importCorpus(inputs,[evidence]).assets.filter(a=>a.eligible)).toHaveLength(1);
  for(const wrong of [{...evidence,passed:false},{...evidence,derivedSha256:"wrong"},{...evidence,rendererProfile:"wrong"},{...evidence,signs:99},{...evidence,elapsedMs:0},{...evidence,frameEvents:0},{...evidence,frames:0}])expect(importCorpus(inputs,[wrong]).assets.some(a=>a.eligible)).toBe(false);
});
test("Corpus: unsafe files are quarantined rather than repaired or silently dropped",()=>{
  const xml='<sigml><hns_sign><hamnosys_nonmanual><hnm_head/></hamnosys_nonmanual></hns_sign></sigml>';
  const result=importCorpus([{xml,sha256:sha256(xml),sourcePath:"unsafe",sourceName:"unsafe.sigml",category:"fixture",sourceUrl:"https://example.invalid"}]);
  expect(result.assets).toEqual([]);expect(result.rejected).toEqual([{originalSha256:sha256(xml),sourcePaths:["unsafe"],reason:"SigmlError: Forbidden element hnm_head"}]);
});
test("Full public corpus seed migrates into empty PGlite and remains idempotent with correct eligibility",async()=>{
  const corpus=JSON.parse(await readFile("data/corpus/assets.json","utf8")) as CorpusImport;
  expect(corpus.files).toBe(3990);expect(corpus.distinctHashes).toBe(3108);expect(corpus.assets.length+corpus.rejected.length).toBe(3108);
  const database=await createDatabase();
  try{
    await database.migrate();if(database.kind!=="pglite")throw new Error("Expected local PGlite");
    const seed=await readFile("data/corpus/seed.sql","utf8");expect(corpusSeedSql(corpus)).toBe(seed);
    expect(seed).not.toContain("\r");expect(seed.trimEnd().split("\n")).toHaveLength(1+corpus.assets.length+corpus.aliases.length);
    await database.client.exec(seed);await database.client.exec(seed);
    const withCR=corpus.assets.find(a=>a.derivedSigml.includes("\r"))!;
    expect((await database.client.query("select derived_sigml,derived_sha256,units,source_paths from sign_assets where id=$1",[withCR.id])).rows).toEqual([{derived_sigml:withCR.derivedSigml,derived_sha256:withCR.derivedSha256,units:withCR.units,source_paths:withCR.sourcePaths}]);
    expect((await database.client.query("select count(*)::int as n from sign_assets")).rows).toEqual([{n:corpus.assets.length}]);
    expect((await database.client.query("select count(*)::int as n from asset_aliases")).rows).toEqual([{n:corpus.aliases.length}]);
    expect((await database.client.query("select count(*)::int as n from sign_assets where eligible and render_state<>'rendered_ok'")).rows).toEqual([{n:0}]);
    expect((await database.client.query("select attribution from corpus_releases")).rows).toEqual([{attribution:corpus.release.attribution}]);
  }finally{await database.close();}
},60_000);
test("T14: all 20 derived sample assets have successful exact-unit render checks; only these become eligible",async()=>{
  const report=JSON.parse(await readFile("docs/evidence/phase-2/asset-render-checks.json","utf8")) as {passed:number;attempted:number;asset_render_checks:AssetRenderCheck[]};
  expect(report.attempted).toBe(20);expect(report.passed).toBe(20);expect(report.asset_render_checks.every(c=>c.passed&&c.frames>0)).toBe(true);
  const corpus=JSON.parse(await readFile("data/corpus/assets.json","utf8")) as CorpusImport;
  const eligible=corpus.assets.filter(a=>a.eligible);expect(eligible).toHaveLength(20);
  for(const a of eligible)expect(report.asset_render_checks).toContainEqual(expect.objectContaining({assetId:a.id,derivedSha256:a.derivedSha256,passed:true}));
});
