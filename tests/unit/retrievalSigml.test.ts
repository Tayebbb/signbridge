import {test,expect} from "vitest";
import {retrieveCandidates} from "@/lib/domain/retrieval";
import {deriveSigml,SigmlError,rewriteUnitGloss} from "@/lib/domain/sigml";
import {buildSigml,withGeneration,parseUnitGloss} from "@/lib/domain/sigmlBuilder";
import {asset,meaning} from "../fixtures/domain";
test("T15: a statement can never exact-match a question asset",()=>{
  const statement={...asset("সে আসবে।",1),kind:"sentence" as const},question={...asset("সে আসবে?",2),kind:"sentence" as const};
  expect(retrieveCandidates("সে আসবে।",meaning(),[question])).toEqual([]);
  expect(retrieveCandidates("সে আসবে।",meaning(),[statement,question]).map(c=>c.asset.id)).toEqual([statement.id]);
  expect(retrieveCandidates("সে আসবে?",meaning(),[statement,question]).map(c=>c.asset.id)).toEqual([question.id]);
});
test("Retrieval only eligible assets; top eight per concept, deduped, deterministic and bounded to 150",()=>{
  const m=meaning(),actors=Array.from({length:12},(_,i)=>asset("আমি",i));actors[0].eligible=false;
  const result=retrieveCandidates("আমি আসবে।",m,actors);expect(result).toHaveLength(8);expect(result.every(c=>c.conceptIds.includes("c1"))).toBe(true);expect(result).toEqual(retrieveCandidates("আমি আসবে।",m,actors.toReversed()));
  m.concepts=Array.from({length:30},(_,i)=>({...m.concepts[0],id:`c${i}`,surfaceBn:`শব্দ${i}`,lemmaBn:`শব্দ${i}`}));
  const many=m.concepts.flatMap((c,i)=>Array.from({length:8},(_,j)=>asset(c.surfaceBn,i*8+j)));
  expect(retrieveCandidates("fixture",m,many)).toHaveLength(150);
});
test("Numeric quantity retrieval uses digit and number-word aliases",()=>{
  const m=meaning();m.concepts=[{...m.concepts[0],role:"quantity",surfaceBn:"২",lemmaBn:"২",numericValue:2}];
  expect(retrieveCandidates("২",m,[asset("দুই",1)])[0].conceptIds).toEqual(["c1"]);
});
test("SiGML derivation rewrites only gloss values, keeping every byte of motion unchanged",()=>{
  const raw="<hns_sign gloss = 'বাংলা' note=\"ascii\"><hamnosys_manual>\n  <hamfinger2/>\n</hamnosys_manual></hns_sign>";
  const result=deriveSigml(`<sigml>\n${raw}\n</sigml>`);
  expect(result.units[0]).toBe(raw.replace("'বাংলা'","'u0'"));expect(result.unitCount).toBe(1);
  expect(rewriteUnitGloss(result.units[0],"g4_s1a0u0")).toContain("gloss = 'g4_s1a0u0'");
  const built=buildSigml(1,[{stepIdx:2,derivedSigml:result.derivedSigml,unitCount:1}]);
  expect(withGeneration(built.text,7)).toContain("gloss = 'g7_s1a2u0'");
});
test("Multi-asset SiGML, gaps in step numbers, generations and range mappings are exact",()=>{
  const a=asset("first",1,2),b=asset("next",2,1),built=buildSigml(3,[{stepIdx:0,...a},{stepIdx:2,...b}]);
  expect(built.unitGlossIds).toEqual(["s3a0u0","s3a0u1","s3a2u0"]);expect(built.ranges).toEqual([{stepIdx:0,first:0,count:2},{stepIdx:2,first:2,count:1}]);
  expect(withGeneration(built.text,7)).toContain('gloss="g7_s3a2u0"');expect(parseUnitGloss("g7_s3a2u0")).toEqual({gen:7,segment:3,step:2,unit:0});expect(parseUnitGloss("g7_S3A2U0")).toBeNull();
  expect(()=>buildSigml(0,[{stepIdx:0,...a,unitCount:99}])).toThrow("unit count mismatch");expect(()=>buildSigml(0,[{stepIdx:0,...a},{stepIdx:0,...a}])).toThrow("Duplicate");
  expect(()=>withGeneration(built.text,-1)).toThrow();expect(()=>rewriteUnitGloss(a.derivedSigml,"UPPER")).toThrow();
});
test.each([
  ['<!DOCTYPE sigml [<!ENTITY xxe SYSTEM "file:///secret">]><sigml><hns_sign gloss="x"/></sigml>',"xml_doctype_forbidden"],
  ["<sigml><script/></sigml>","xml_element_forbidden"], ["<sigml><hns_sign></sigml>","xml_invalid"],
  ['<sigml><hns_sign gloss="x" other="বাংলা"/></sigml>',"xml_attribute_non_ascii"],
  ['<sigml><hns_sign gloss="x"/><sigml><hns_sign gloss="x"/></sigml></sigml>',"xml_invalid"],
])("T12: unsafe XML rejected with exact error code",(xml,code)=>{expect(()=>deriveSigml(xml)).toThrowError(expect.objectContaining({code}));try{deriveSigml(xml);}catch(e){expect(e).toBeInstanceOf(SigmlError);}});
