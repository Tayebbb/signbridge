import {test,expect} from "vitest";
import {validateMeaning,validatePlan} from "@/lib/domain/validators";
import {buildManifestSegment,segmentPresentation,deriveTrackStatus,buildManifest} from "@/lib/domain/manifest";
import {manifestHash,trackFingerprint,sha256} from "@/lib/domain/fingerprints";
import {meaning,plan,candidates,segmentInput,asset} from "../fixtures/domain";
import type {ConceptRole} from "@/lib/contracts/meaning";
import {detectSource} from "@/lib/domain/detectors";
test("Independent detectors preserve signed decimal numeric values and Bangla number words",()=>{
  expect(detectSource("−২.৫ এবং 3.25 দুটো তিনটে").quantities).toEqual([{surface:"−২.৫",value:-2.5},{surface:"3.25",value:3.25},{surface:"দুটো",value:2},{surface:"তিনটে",value:3}]);
  expect(detectSource("সে কিনিনি? সে নেই")).toMatchObject({negations:["নি","নেই"],question:true});
});
test("T4: fully supported engineering fixture is ready, with no gap card and immutable inputs",()=>{
  const input=segmentInput(),copy=structuredClone(input),result=buildManifestSegment(input);
  expect(result.technicalStatus).toBe("ready");expect(result.criticalGaps).toEqual([]);expect(result.sigml.unitCount).toBe(3);
  expect(result.sigml.unitGlossIds).toEqual(["s3a0u0","s3a1u0","s3a1u1"]);expect(result.timeline[1]).toMatchObject({unitRange:{first:1,count:2}});
  expect(segmentPresentation(result)).toMatchObject({forceCaptionVisible:false,autoAdvanceAllowed:true,countsAsFullySigned:true});
  expect(input).toEqual(copy);
});
test.each([
  ["negation","না",null,"আমি আসবে না।"], ["quantity","২",2,"আমি ২ আসবে।"], ["object","নক্ষত্র",null,"আমি নক্ষত্র আসবে।"],
] as const)("T5: unsupported %s is partial_blocked, with a card before signing and forced captions",(role,surface,numericValue,text)=>{
  const input=segmentInput();input.segment.sourceText=text;
  input.meaning.concepts.push({id:"c3",role:role as ConceptRole,surfaceBn:surface,lemmaBn:surface,numericValue,critical:false,referentId:null});
  if(role==="negation"){input.meaning.polarity="negative";input.meaning.propositions[0].negated=true;}
  input.plan.uncoveredConceptIds=["c3"];input.plan.steps.push({kind:"gap",assetId:null,conceptIds:["c3"],gapReason:"no_candidate"});
  const result=buildManifestSegment(input),view=segmentPresentation(result);
  expect(result.technicalStatus).toBe("partial_blocked");expect(result.criticalGaps).toContainEqual({conceptId:"c3",role,surfaceBn:surface,reason:"no_candidate"});
  expect(view.queue[0].kind).toBe("gap_card");expect(view.queue[1].kind).toBe("asset");expect(result.timeline.at(-1)).toMatchObject({kind:"gap",conceptIds:["c3"]});
  expect(view).toMatchObject({forceCaptionVisible:true,autoAdvanceAllowed:false,countsAsFullySigned:false});expect(deriveTrackStatus([result])).toBe("partial");
});
test("T5 / M3: mocked output forgetting negation requests repair; exhausted repair fails closed",()=>{
  const input=segmentInput();input.segment.sourceText="আমি আসবে না।";
  const checked=validateMeaning(input.meaning,input.segment.sourceText);
  expect(checked.repairRequired).toBe(true);expect(checked.issues).toContainEqual(expect.objectContaining({code:"M3",message:expect.stringContaining("negation")}));
  const result=buildManifestSegment(input);
  expect(result.technicalStatus).toBe("partial_blocked");expect(result.criticalGaps.some(g=>g.role==="negation")).toBe(true);
  expect(segmentPresentation(result).queue[0].kind).toBe("gap_card");
});
test("M1: surface/ID/referential errors cannot become ready",()=>{
  const m=meaning();m.concepts[0].surfaceBn=" ";m.concepts[0].referentId="r9";m.concepts.push({...m.concepts[0]});m.propositions[0].argumentConceptIds.push("c9");m.ambiguities.push({conceptId:"c8",description:"unknown",blocking:false});
  const checked=validateMeaning(m,"আমি আসবে।",[],{final:true});expect(checked.issues.filter(i=>i.code==="M1").length).toBeGreaterThanOrEqual(5);
  expect(checked.value.ambiguities.some(a=>a.blocking)).toBe(true);
  expect(buildManifestSegment({...segmentInput(),meaning:m}).technicalStatus).not.toBe("ready");
});
test("M1 strips no markup from model surface claims; only NFC/whitespace can normalize",()=>{
  const m=meaning();m.concepts[0].surfaceBn="<b>আমি</b>";
  expect(validateMeaning(m,"আমি আসবে।").issues.some(i=>i.code==="M1")).toBe(true);
});
test("M1 context references are limited to supplied previous segments; unresolved actors block",()=>{
  const m=meaning();m.referents=[{id:"r1",surfaceBn:"রহিম",kind:"person",resolvedFrom:"previous_context"}];m.concepts[0].referentId="r1";
  expect(validateMeaning(m,"আমি আসবে।",["রহিম এখানে"]).issues).toEqual([]);
  expect(validateMeaning(m,"আমি আসবে।").issues.some(i=>i.code==="M1")).toBe(true);
  m.referents[0]={...m.referents[0],surfaceBn:"আমি",resolvedFrom:"unresolved"};
  expect(validateMeaning(m,"আমি আসবে।").value.ambiguities).toContainEqual(expect.objectContaining({blocking:true,conceptId:"c1"}));
});
test("M2 forced criticality overrides all six protected roles without mutating output cache",()=>{
  const m=meaning();for(const role of ["actor","action","object","quantity","negation","question"] as ConceptRole[]){m.concepts[0].role=role;m.concepts[0].critical=false;expect(validateMeaning(m,"আমি আসবে।").value.concepts[0].critical).toBe(true);expect(m.concepts[0].critical).toBe(false);}
});
test.each(["আমি ২ আসবে।","আমি দুটো আসবে।","আমি আসবে?","কেন আমি আসবে।"])("M3 catches independent number/question evidence in %s",text=>{
  expect(validateMeaning(meaning(),text).issues.some(i=>i.code==="M3")).toBe(true);
  expect(validateMeaning(meaning(),text,[],{final:true}).value.ambiguities.some(a=>a.blocking)).toBe(true);
});
test("P1: foreign, ineligible and null asset IDs become explicit gaps",()=>{
  for(const variant of ["foreign","ineligible","null"]){const p=plan(),c=candidates();if(variant==="foreign")p.steps[0].assetId=asset("foreign",99).id;else if(variant==="null")p.steps[0].assetId=null;else c[0].asset.eligible=false;
    const result=validatePlan(p,validateMeaning(meaning(),"আমি আসবে।").value,c);expect(result.issues.some(i=>i.code==="P1")).toBe(true);expect(result.value.steps[0]).toMatchObject({kind:"gap",assetId:null});expect(result.value.uncoveredConceptIds).toContain("c1");}
});
test("P2: recompute uncovered difference, synthesize missing gap, reject foreign concept references",()=>{
  const p=plan();p.steps=p.steps.slice(0,1);p.uncoveredConceptIds=[];
  const result=validatePlan(p,meaning(),candidates());expect(result.issues.some(i=>i.code==="P2")).toBe(true);expect(result.value.uncoveredConceptIds).toEqual(["c2"]);expect(result.value.steps[1]).toMatchObject({kind:"gap",conceptIds:["c2"]});
  const foreign=plan();foreign.steps[0].conceptIds=["c9"];expect(validatePlan(foreign,meaning(),candidates()).issues.some(i=>i.code==="P2")).toBe(true);
});
test("P3: claimed support needs retrieval provenance or an exact concept label; lossy keys are not validators",()=>{
  const c=candidates();c[0].conceptIds=[];c[0].asset.labelBn="অন্য";c[0].asset.aliases=[];
  const result=validatePlan(plan(),meaning(),c);expect(result.issues.some(i=>i.code==="P3")).toBe(true);expect(result.value.steps[0]).toMatchObject({kind:"gap",gapReason:"candidate_meaning_mismatch"});
});
test("P4: exact phrase requires precisely one exact sentence candidate and only one step",()=>{
  const p=plan();p.strategy="exact_corpus_phrase";
  expect(validatePlan(p,meaning(),candidates()).issues.some(i=>i.code==="P4")).toBe(true);
  const a={...asset("আমি আসবে",8),kind:"sentence" as const},c=[{asset:a,conceptIds:["c1","c2"],exactPhrase:true,score:4}];
  p.steps=[{kind:"asset",assetId:a.id,conceptIds:["c1","c2"],gapReason:null}];
  expect(validatePlan(p,meaning(),c).issues).toEqual([]);
  expect(validatePlan(p,meaning(),[...c,{...c[0],asset:{...a,id:asset("duplicate",9).id}}]).issues.some(i=>i.code==="P4")).toBe(true);
});
test("P5: duration/unit/step bounds fail closed and cannot generate playable oversized manifests",()=>{
  for(const field of ["unitCount","estimatedDurationMs"] as const){const input=segmentInput();input.candidates[0].asset[field]=field==="unitCount"?41:31_000;const result=validatePlan(input.plan,input.meaning,input.candidates);expect(result.bounded).toBe(false);expect(result.issues.some(i=>i.code==="P5")).toBe(true);expect(buildManifestSegment(input)).toMatchObject({technicalStatus:"failed",sigml:{unitCount:0}});}
  const p=plan();p.steps=Array(25).fill(p.steps[0]);expect(()=>validatePlan(p,meaning(),candidates())).toThrow();
});
test("No-signing and explicit failure remain honest and excluded from ready counts",()=>{
  const input=segmentInput();input.plan.steps=[];input.plan.strategy="no_signing_possible";
  const noSigning=buildManifestSegment(input);expect(noSigning.technicalStatus).toBe("no_signing");expect(segmentPresentation(noSigning).countsAsFullySigned).toBe(false);
  expect(buildManifestSegment({...input,failed:true}).technicalStatus).toBe("failed");expect(deriveTrackStatus([])).toBe("failed");
});
test("Manifest binds current transcript positions, source/media/provenance and embedded XML; overlays are separate",()=>{
  const input=segmentInput();input.segment={...input.segment,idx:9,startMs:20000,endMs:24000};
  const meta={trackVersionId:"t1",projectId:"project",transcriptVersion:{id:"v1",versionNo:1,textHash:"hash"},media:{contentSha256:"content",sizeBytes:10,durationMs:30000},provenance:{corpusReleaseId:"ik2-mendeley-v2" as const,corpusLicense:"CC-BY-4.0" as const,corpusAttribution:"Engineering fixture",sourceFormVersion:"src-v1",sigmlBuilderVersion:"sigml-builder-v2",modelProfile:"fake",promptVersions:{meaning:"1",plan:"1"},validatorVersion:"validator-v1"},anchors:[]};
  const manifest=buildManifest({...meta,segments:[input]});expect(manifest.segments[0]).toMatchObject({idx:9,startMs:20000,endMs:24000,holdFrameMs:23960});
  expect(manifest.segments[0].sigml.unitGlossIds).toEqual(["s9a0u0","s9a1u0","s9a1u1"]);expect(manifest.segments[0].sigml.sha256).toBe(sha256(manifest.segments[0].sigml.text));
  expect(manifest).not.toHaveProperty("overlays");expect(manifest).not.toHaveProperty("sourceChecks");expect(manifest.renderer.remoteDependency).toBe(true);
  expect(manifestHash(manifest)).not.toBe(manifestHash({...manifest,trackVersionId:"t2"}));expect(trackFingerprint(manifest)).toBe(trackFingerprint({...manifest,trackVersionId:"t2"}));expect(deriveTrackStatus(manifest.segments)).toBe("complete");
});
