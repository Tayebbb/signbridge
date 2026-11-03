import { readFile,writeFile,mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deriveSigml,SigmlError } from "../lib/domain/sigml";
import { buildSigml } from "../lib/domain/sigmlBuilder";
import { sha256,hash,CORPUS_RELEASE_ID } from "../lib/domain/fingerprints";
import { phraseForm,retrievalForm } from "../lib/domain/captions/textForms";
export const ATTRIBUTION="MD. Ashikul Islam; Prato Dewan; Md Fuadul Islam; Md Ataullha Saim; M Shahidur Rahman. IsharaKotha: Avatar-based Bangla Sign Language Corpus, version 2 (2026), DOI 10.17632/6ykgx65ks5.2. CC BY 4.0. Derived gloss attributes changed to lowercase ASCII; motion XML unchanged.";
export interface CorpusInput { sourcePath:string;sourceName:string;category:string;sourceUrl:string;sha256:string;xml:string }
export interface AssetRenderCheck { assetId:string;derivedSha256:string;rendererProfile:string;passed:boolean;signs:number;frames:number;frameEvents:number;elapsedMs:number;[key:string]:unknown }
export function importCorpus(inputs:readonly CorpusInput[], checks:readonly AssetRenderCheck[]=[]) {
  const grouped=new Map<string,CorpusInput[]>();
  for(const input of inputs){if(sha256(input.xml)!==input.sha256)throw new Error(`Corpus hash mismatch: ${input.sourcePath}`);const rows=grouped.get(input.sha256)??[];rows.push(input);grouped.set(input.sha256,rows);}
  const rejected:{originalSha256:string;sourcePaths:string[];reason:string}[]=[];
  const assets=[];
  for(const [originalSha256,group] of [...grouped].sort(([a],[b])=>a<b?-1:1)) {
    group.sort((a,b)=>a.sourcePath<b.sourcePath?-1:a.sourcePath>b.sourcePath?1:0);
    try {
      const derived=deriveSigml(group[0].xml), derivedSha256=sha256(derived.derivedSigml), id=`ik2_${originalSha256.slice(0,12)}`;
      const stems=group.map(g=>g.sourceName.replace(/\.sigml$/iu,""));
      const primary=group.findIndex(g=>g.category.startsWith("Sentence")), selected=primary>=0?primary:0;
      const labelBn=stems[selected].split(/\s+\(/u)[0].trim();
      const renderEvidence=checks.find(c=>c.assetId===id&&c.derivedSha256===derivedSha256&&c.rendererProfile==="cwasa-vhg2026/anna/speed0");
      const eligible=Boolean(renderEvidence?.passed&&renderEvidence.signs===derived.unitCount&&Number.isInteger(renderEvidence.frames)&&renderEvidence.frames>0&&renderEvidence.frameEvents>0&&Number.isFinite(renderEvidence.elapsedMs)&&renderEvidence.elapsedMs>0);
      assets.push({id,corpusReleaseId:CORPUS_RELEASE_ID,kind:primary>=0?"sentence" as const:"lexical" as const,labelBn,labelPhraseForm:phraseForm(labelBn),
        sourcePaths:group.map(g=>g.sourcePath),sourceUrls:group.map(g=>g.sourceUrl),originalSha256,derivedSha256,derivedSigml:derived.derivedSigml,unitCount:derived.unitCount,
        units:derived.units.map((sigml,idx)=>({idx,gloss:`u${idx}`,sigml})),derivationVersion:"gloss-ascii-v2",renderState:eligible?"rendered_ok" as const:renderEvidence?"render_failed" as const:"untested" as const,
        renderEvidence:renderEvidence??null,eligible,estimatedDurationMs:eligible?Math.ceil(renderEvidence!.elapsedMs*1.1):derived.unitCount*1000,
        aliases:[...new Set([...stems,labelBn])],
      });
    }catch(error){if(!(error instanceof SigmlError))throw error;rejected.push({originalSha256,sourcePaths:group.map(g=>g.sourcePath),reason:String(error)});}
  }
  if(new Set(assets.map(a=>a.id)).size!==assets.length)throw new Error("Truncated corpus ID collision");
  const aliases=assets.flatMap(a=>[...new Set(a.aliases.map(retrievalForm).filter(Boolean))].map(aliasNorm=>({aliasNorm,assetId:a.id,source:"filename" as const}))).sort((a,b)=>a.assetId<b.assetId?-1:a.assetId>b.assetId?1:a.aliasNorm<b.aliasNorm?-1:1);
  const manifestSha256=hash({release:CORPUS_RELEASE_ID,derivation:"gloss-ascii-v2",assets:assets.map(a=>({id:a.id,originalSha256:a.originalSha256,derivedSha256:a.derivedSha256,sourcePaths:a.sourcePaths,labelPhraseForm:a.labelPhraseForm,kind:a.kind})),aliases});
  return {release:{id:CORPUS_RELEASE_ID,doi:"10.17632/6ykgx65ks5.2",license:"CC-BY-4.0",attribution:ATTRIBUTION,manifestSha256},files:inputs.length,distinctHashes:grouped.size,assets,aliases,rejected};
}
export type CorpusImport=ReturnType<typeof importCorpus>;
const literal=(value:unknown):string=>value===null?"NULL":typeof value==="boolean"?String(value):typeof value==="number"?String(value):`E'${String(value).replace(/\\/gu,"\\\\").replace(/'/gu,"''").replace(/\r/gu,"\\r").replace(/\n/gu,"\\n").replace(/\t/gu,"\\t")}'`;
export function corpusSeedSql(corpus:CorpusImport):string {
  const release=corpus.release;
  const lines=[`INSERT INTO corpus_releases(id,doi,license,attribution,manifest_sha256) VALUES (${[release.id,release.doi,release.license,release.attribution,release.manifestSha256].map(literal).join(",")}) ON CONFLICT(id) DO UPDATE SET manifest_sha256=excluded.manifest_sha256;`];
  for(const a of corpus.assets)lines.push(`INSERT INTO sign_assets(id,corpus_release_id,kind,label_bn,label_phrase_form,source_paths,original_sha256,derived_sha256,derived_sigml,unit_count,units,derivation_version,render_state,render_evidence,eligible) VALUES (${[a.id,a.corpusReleaseId,a.kind,a.labelBn,a.labelPhraseForm].map(literal).join(",")},ARRAY[${a.sourcePaths.map(literal).join(",")}],${[a.originalSha256,a.derivedSha256,a.derivedSigml,a.unitCount,JSON.stringify(a.units),a.derivationVersion,a.renderState,a.renderEvidence?JSON.stringify(a.renderEvidence):null,a.eligible].map(literal).join(",")}) ON CONFLICT(id) DO UPDATE SET render_state=excluded.render_state,render_evidence=excluded.render_evidence,eligible=excluded.eligible;`);
  for(const a of corpus.aliases)lines.push(`INSERT INTO asset_aliases(alias_norm,asset_id,source) VALUES (${[a.aliasNorm,a.assetId,a.source].map(literal).join(",")}) ON CONFLICT DO NOTHING;`);
  return lines.join("\n")+"\n";
}
async function main() {
  const args=process.argv.slice(2), research=args[args.indexOf("--research")+1]&&args.includes("--research")?args[args.indexOf("--research")+1]:"E:/AIgnite-Lab/research/2026-11-03-signbridge";
  const samples=JSON.parse(await readFile(`${research}/isharakotha-samples/manifest.json`,"utf8")) as {path:string;source_name:string;category:string;source_url:string;sha256:string}[];
  let inputs:CorpusInput[];
  if(args.includes("--samples")) inputs=await Promise.all(samples.map(async s=>({sourcePath:`${s.category}/${s.source_name}`,sourceName:s.source_name,category:s.category,sourceUrl:s.source_url,sha256:s.sha256,xml:await readFile(s.path,"utf8")})));
  else {
    const manifest=JSON.parse(await readFile(`${research}/isharakotha-v2-public-file-manifest.json`,"utf8")) as {folders:{id:string;name:string;parent_id:string}[];files:{filename:string;folder_id:string;content_details:{sha256_hash:string;download_url:string}}[]};
    const folders=new Map(manifest.folders.map(f=>[f.id,f]));
    inputs=await Promise.all(manifest.files.map(async f=>{const category=folders.get(f.folder_id)?.name??"root";return {sourcePath:`${category}/${f.filename}`,sourceName:f.filename,category,sourceUrl:f.content_details.download_url,sha256:f.content_details.sha256_hash,xml:await readFile(`.data/corpus/raw/${f.content_details.sha256_hash}.sigml`,"utf8")};}));
  }
  const checksPath=args.includes("--checks")?args[args.indexOf("--checks")+1]:null;
  const checks=checksPath?(JSON.parse(await readFile(checksPath,"utf8")) as {asset_render_checks:AssetRenderCheck[]}).asset_render_checks:[];
  const corpus=importCorpus(inputs,checks);
  const outputDir=args.includes("--output-dir")?args[args.indexOf("--output-dir")+1]:"data/corpus",evidenceDir=args.includes("--evidence-dir")?args[args.indexOf("--evidence-dir")+1]:"docs/evidence/phase-2";
  await mkdir(outputDir,{recursive:true});await mkdir(evidenceDir,{recursive:true});await mkdir("tests/fixtures",{recursive:true});
  await writeFile(`${outputDir}/assets.json`,JSON.stringify(corpus,null,2)+"\n");
  await writeFile(`${outputDir}/seed.sql`,corpusSeedSql(corpus));
  const sampleIds=new Set(samples.map(s=>`ik2_${s.sha256.slice(0,12)}`));
  const probe=corpus.assets.filter(a=>sampleIds.has(a.id)).map(a=>({assetId:a.id,labelBn:a.labelBn,derivedSha256:a.derivedSha256,unitCount:a.unitCount,xml:buildSigml(0,[{stepIdx:0,derivedSigml:a.derivedSigml,unitCount:a.unitCount}]).text}));
  await writeFile(`${outputDir}/sample-probe.json`,JSON.stringify(probe,null,2)+"\n");
  if(!args.includes("--output-dir"))await writeFile("tests/fixtures/corpus-samples.json",JSON.stringify(inputs.filter(i=>sampleIds.has(`ik2_${i.sha256.slice(0,12)}`)),null,2)+"\n");
  const summary={files:corpus.files,distinctHashes:corpus.distinctHashes,assets:corpus.assets.length,aliases:corpus.aliases.length,units:corpus.assets.reduce((s,a)=>s+a.unitCount,0),eligible:corpus.assets.filter(a=>a.eligible).length,manifestSha256:corpus.release.manifestSha256,rejected:corpus.rejected};
  await writeFile(`${evidenceDir}/import.json`,JSON.stringify(summary,null,2)+"\n");console.log(JSON.stringify({...summary,rejected:summary.rejected.length}));
  if(corpus.rejected.length)console.warn("Rejected unsafe/malformed assets are excluded; inspect import evidence.");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
