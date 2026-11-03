import {FakeModelClient} from "./client";
import type {ModelRequest} from "./protocol";
import {detectSource} from "../domain/detectors";
import type {SegmentMeaning} from "../contracts/meaning";
/** A transparent deterministic demo fixture. It makes no language-model or signing claims. */
export function deterministicFake(){return new FakeModelClient((r:ModelRequest<unknown>)=>{
  const data=r.input as {segment:{text:string};meaning?:SegmentMeaning;candidates?:{id:string;concept_ids:string[];exact_phrase:boolean}[]};
  if(r.stage==="meaning"){
    const detected=detectSource(data.segment.text),words=[...new Set(data.segment.text.replace(/[।.!?]/gu," ").split(/\s+/u).filter(Boolean))].slice(0,90);
    return {schemaVersion:"meaning-v2",clauseType:detected.question?(detected.whQuestion?"wh_question":"yes_no_question"):"statement",polarity:detected.negations.length?"negative":"affirmative",referents:[],propositions:[],ambiguities:[],concepts:words.map((word,i)=>{const quantity=detected.quantities.find(q=>q.surface===word),negation=detected.negations.includes(word);return {id:`c${i}`,role:negation?"negation":quantity?"quantity":"other",surfaceBn:word,lemmaBn:word,referentId:null,numericValue:quantity?.value??null,critical:true};})};
  }
  const exact=data.candidates?.find(c=>c.exact_phrase),uncovered:string[]=[],steps:unknown[]=[];
  if(exact)return {schemaVersion:"plan-v2",strategy:"exact_corpus_phrase",steps:[{kind:"asset",assetId:exact.id,conceptIds:data.meaning!.concepts.map(c=>c.id).slice(0,6),gapReason:null}],uncoveredConceptIds:[],notes:"Deterministic fixture only"};
  for(const c of data.meaning!.concepts){const candidate=data.candidates?.find(a=>a.concept_ids.includes(c.id));if(!candidate)uncovered.push(c.id);steps.push({kind:candidate?"asset":"gap",assetId:candidate?.id??null,conceptIds:[c.id],gapReason:candidate?null:"no_candidate"});}
  return {schemaVersion:"plan-v2",strategy:steps.some((s)=> (s as {kind:string}).kind==="asset")?"composed_sequence":"no_signing_possible",steps:steps.slice(0,24),uncoveredConceptIds:uncovered,notes:"Deterministic fixture only"};
});}
