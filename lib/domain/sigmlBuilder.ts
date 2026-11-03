import { deriveSigml, rewriteUnitGloss } from "./sigml";
import { sha256 } from "./fingerprints";
export const SIGML_BUILDER_VERSION="sigml-builder-v2";
export function buildSigml(segmentIdx:number, assets:readonly {stepIdx:number;derivedSigml:string;unitCount:number}[]) {
  if(!Number.isSafeInteger(segmentIdx)||segmentIdx<0)throw new Error("Invalid segment index");
  const units:string[]=[], unitGlossIds:string[]=[], ranges:{stepIdx:number;first:number;count:number}[]=[];
  for(const asset of assets) {
    if(!Number.isSafeInteger(asset.stepIdx)||asset.stepIdx<0)throw new Error("Invalid step index");
    const parsed=deriveSigml(asset.derivedSigml);
    if(parsed.unitCount!==asset.unitCount)throw new Error("Asset unit count mismatch");
    ranges.push({stepIdx:asset.stepIdx,first:units.length,count:parsed.unitCount});
    parsed.units.forEach((unit,index)=>{const id=`s${segmentIdx}a${asset.stepIdx}u${index}`;unitGlossIds.push(id);units.push(rewriteUnitGloss(unit,id));});
  }
  if(new Set(unitGlossIds).size!==unitGlossIds.length)throw new Error("Duplicate unit IDs");
  const text=`<sigml>\n${units.join("\n")}\n</sigml>`;
  return {text,sha256:sha256(text),unitCount:units.length,unitGlossIds,ranges};
}
export function withGeneration(text:string,generation:number):string {
  if(!Number.isSafeInteger(generation)||generation<0)throw new Error("Invalid generation");
  return text.replace(/(\bgloss\s*=\s*)("|')([^"']+)\2/gu,(_,prefix:string,quote:string,id:string)=>{
    if(!/^s\d+a\d+u\d+$/u.test(id))throw new Error("Manifest gloss must be lowercase without a generation");
    return `${prefix}${quote}g${generation}_${id}${quote}`;
  });
}
export function parseUnitGloss(id:string) {const m=/^g(\d+)_s(\d+)a(\d+)u(\d+)$/u.exec(id);return m?{gen:Number(m[1]),segment:Number(m[2]),step:Number(m[3]),unit:Number(m[4])}:null;}
