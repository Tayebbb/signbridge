import {test,expect} from "vitest";
import {canonicalJson,hash,segmentKey,meaningKey,candidatesHash,planKey,trackFingerprint,manifestHash} from "@/lib/domain/fingerprints";
import {phraseForm,retrievalForm} from "@/lib/domain/captions/textForms";
const pairs=[["সে আসবে।","সে আসবে?"],["আমি কিনেছি","আমি কিনিনি"],["দুটো আম","তিনটে আম"]];
const ctx={before:[],after:[],title:"Title"};
test.each(pairs)("T15: source/phrase and all neighbour positions stay distinct: %s / %s",(a,b)=>{
  expect(phraseForm(a)).not.toBe(phraseForm(b));
  expect(segmentKey({sourceText:a},ctx)).not.toBe(segmentKey({sourceText:b},ctx));
  for(const position of ["before0","before1","after","title"]){
    const context=(text:string)=>({...ctx,before:position==="before0"?[text,"same"]:position==="before1"?["same",text]:[],after:position==="after"?[text]:[],title:position==="title"?text:"Title"});
    expect(segmentKey({sourceText:"আমি"},context(a))).not.toBe(segmentKey({sourceText:"আমি"},context(b)));
  }
});
test("Lossy retrieval collisions cannot become cache-key collisions",()=>{
  expect(retrievalForm("কিনেছি")).toBe(retrievalForm("কিনিনি"));
  expect(segmentKey({sourceText:"কিনেছি"},ctx)).not.toBe(segmentKey({sourceText:"কিনিনি"},ctx));
});
test("Canonical JSON sorts keys, normalizes NFC, preserves array order and rejects invalid JSON",()=>{
  expect(canonicalJson({z:[-0,"e\u0301"],a:1})).toBe('{"a":1,"z":[0,"é"]}');
  expect(hash({b:2,a:1})).toBe(hash({a:1,b:2}));
  expect(hash([1,2])).not.toBe(hash([2,1]));
  for(const value of [NaN,Infinity,undefined,1n,new Date(),[undefined],Array(2),{"é":1,"e\u0301":2}])expect(()=>canonicalJson(value)).toThrow();
  const cycle:{self?:unknown}={};cycle.self=cycle;expect(()=>canonicalJson(cycle)).toThrow();
});
test("Every versioned key includes its exact dependency graph and type prefix",()=>{
  const config={model:"fake",effort:"none",promptVersion:"1",validatorVersion:"1"}, s=segmentKey({sourceText:"আমি"},ctx);
  expect(s).toMatch(/^s2:[a-f0-9]{64}$/);expect(meaningKey(s,config)).toMatch(/^m2:/);
  for(const field of Object.keys(config) as (keyof typeof config)[])expect(meaningKey(s,config)).not.toBe(meaningKey(s,{...config,[field]:"changed"}));
  expect(meaningKey(s,config)).not.toBe(meaningKey(s+"x",config));
  const assets=[{id:"b",derivedSha256:"1"},{id:"a",derivedSha256:"2"}], c=candidatesHash(assets);
  expect(c).toMatch(/^c1:/);expect(c).toBe(candidatesHash(assets.toReversed()));
  expect(c).not.toBe(candidatesHash([{id:"b",derivedSha256:"changed"},assets[1]]));
  expect(c).not.toBe(candidatesHash(assets,{retrieval:"changed",textForms:"1",corpus:"1"}));
  expect(planKey("meaning",c,config)).toMatch(/^p2:/);expect(planKey("meaning",c,config)).not.toBe(planKey("changed",c,config));
  expect(planKey("meaning",c,config)).not.toBe(planKey("meaning",c+"x",config));
  for(const field of Object.keys(config) as (keyof typeof config)[])expect(planKey("meaning",c,config)).not.toBe(planKey("meaning",c,{...config,[field]:"changed"}));
});
test("t2 binds every artifact binding, excludes only trackVersionId and never includes overlays",()=>{
  const manifest={trackVersionId:"track1",projectId:"p",transcriptVersion:{id:"A",versionNo:1,textHash:"text"},media:{contentSha256:"media",sizeBytes:1},provenance:{version:"v1"},renderer:{profile:"anna"},segments:[],anchors:[]};
  expect(trackFingerprint(manifest)).toMatch(/^t2:/);expect(manifestHash(manifest)).toMatch(/^[a-f0-9]{64}$/);
  expect(trackFingerprint({...manifest,trackVersionId:"track2"})).toBe(trackFingerprint(manifest));
  expect(manifestHash({...manifest,trackVersionId:"track2"})).not.toBe(manifestHash(manifest));
  for(const key of ["projectId","transcriptVersion","media","provenance","renderer","segments","anchors"])expect(trackFingerprint({...manifest,[key]:"changed"})).not.toBe(trackFingerprint(manifest));
  expect(trackFingerprint({...manifest,transcriptVersion:{...manifest.transcriptVersion,id:"A-third-version"}})).not.toBe(trackFingerprint(manifest));
});
