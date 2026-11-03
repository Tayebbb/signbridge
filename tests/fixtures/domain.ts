import type { SegmentMeaning } from "../../lib/contracts/meaning";
import type { SegmentPlan } from "../../lib/contracts/plan";
import type { SignAsset,Candidate } from "../../lib/domain/retrieval";
import type { Segment } from "../../lib/domain/segmentation";
import { sha256 } from "../../lib/domain/fingerprints";
import { phraseForm } from "../../lib/domain/captions/textForms";
export function asset(labelBn:string,index:number,unitCount=1):SignAsset {
  const derivedSigml=`<sigml>\n${Array.from({length:unitCount},(_,i)=>`<hns_sign gloss="u${i}"><hamnosys_manual><hamfinger2/></hamnosys_manual></hns_sign>`).join("\n")}\n</sigml>`;
  return {id:`ik2_${index.toString(16).padStart(12,"0")}`,kind:"lexical",labelBn,labelPhraseForm:phraseForm(labelBn),aliases:[labelBn],derivedSigml,derivedSha256:sha256(derivedSigml),unitCount,eligible:true,estimatedDurationMs:1000};
}
export function meaning():SegmentMeaning {return {schemaVersion:"meaning-v2",clauseType:"statement",polarity:"affirmative",referents:[],concepts:[
  {id:"c1",role:"actor",surfaceBn:"আমি",lemmaBn:"আমি",referentId:null,numericValue:null,critical:false},
  {id:"c2",role:"action",surfaceBn:"আসবে",lemmaBn:"আসবে",referentId:null,numericValue:null,critical:false},
],propositions:[{id:"p1",predicateConceptId:"c2",argumentConceptIds:["c1"],negated:false,tense:"future"}],ambiguities:[]};}
export const segment:Segment={idx:3,startMs:12_400,endMs:15_900,cueFrom:0,cueTo:0,sourceText:"আমি আসবে।"};
export function candidates():Candidate[] {return [asset("আমি",1),asset("আসবে",2,2)].map((asset,i)=>({asset,conceptIds:[`c${i+1}`],exactPhrase:false,score:3}));}
export function plan():SegmentPlan {return {schemaVersion:"plan-v2",strategy:"composed_sequence",steps:candidates().map((c,i)=>({kind:"asset",assetId:c.asset.id,conceptIds:[`c${i+1}`],gapReason:null})),uncoveredConceptIds:[],notes:"Engineering fixture only; no linguistic review."};}
export function segmentInput() {return {segment:{...segment},meaning:meaning(),plan:plan(),candidates:candidates(),meaningResultKey:"m2:test",planResultKey:"p2:test"};}
