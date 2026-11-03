import { playbackManifestSchema, type PlaybackManifest, type ManifestSegment } from "../contracts/manifest";
import { validateMeaning, validatePlan } from "./validators";
import { buildSigml } from "./sigmlBuilder";
import type { Segment } from "./segmentation";
import type { Candidate } from "./retrieval";
export interface SegmentBuildInput { segment:Segment; meaning:unknown; plan:unknown; candidates:readonly Candidate[]; before?:readonly string[]; meaningResultKey:string; planResultKey:string; failed?:boolean }
export function buildManifestSegment(input:SegmentBuildInput):ManifestSegment {
  const checked=validateMeaning(input.meaning,input.segment.sourceText,input.before,{final:true}), meaning=checked.value;
  const validated=validatePlan(input.plan,meaning,input.candidates), plan=validated.value;
  const byId=new Map(input.candidates.map(c=>[c.asset.id,c.asset]));
  const failed=Boolean(input.failed)||!validated.bounded;
  const steps=failed?[]:plan.steps;
  const signing=steps.flatMap((s,stepIdx)=>s.kind==="asset"?[{stepIdx,...byId.get(s.assetId!)!}]:[]);
  const sigml=buildSigml(input.segment.idx,signing), timeline:ManifestSegment["timeline"]=steps.map((s,stepIdx)=>{
    if(s.kind==="gap")return {kind:"gap",conceptIds:s.conceptIds,surfaceBn:s.conceptIds.map(id=>meaning.concepts.find(c=>c.id===id)?.surfaceBn??"").join(" / "),reason:s.gapReason!};
    const a=byId.get(s.assetId!)!, range=sigml.ranges.find(r=>r.stepIdx===stepIdx)!;
    return {kind:"asset",assetId:a.id,labelBn:a.labelBn,derivedSha256:a.derivedSha256,unitRange:{first:range.first,count:range.count},conceptIds:s.conceptIds};
  });
  const criticalGaps=meaning.concepts.filter(c=>c.critical&&plan.uncoveredConceptIds.includes(c.id)).map(c=>({conceptId:c.id,role:c.role,surfaceBn:c.surfaceBn,reason:plan.steps.find(s=>s.kind==="gap"&&s.conceptIds.includes(c.id))?.gapReason??"no_candidate"}));
  meaning.ambiguities.filter(a=>a.blocking).forEach((a,i)=>criticalGaps.push({conceptId:a.conceptId??`ambiguity-${i}`,role:"other",surfaceBn:a.description,reason:"ambiguous_source"}));
  const technicalStatus=failed?"failed":signing.length===0?"no_signing":criticalGaps.length?"partial_blocked":"ready";
  const {ranges: discarded,...embeddedSigml}=sigml; void discarded;
  return {idx:input.segment.idx,startMs:input.segment.startMs,endMs:input.segment.endMs,sourceTextBn:input.segment.sourceText,holdFrameMs:Math.max(input.segment.startMs,input.segment.endMs-40),technicalStatus,strategy:plan.strategy,meaningResultKey:input.meaningResultKey,planResultKey:input.planResultKey,criticalGaps,ambiguities:meaning.ambiguities.map(a=>({description:a.description,blocking:a.blocking})),timeline,sigml:embeddedSigml};
}
export const RENDERER_PROFILE={profile:"cwasa-vhg2026/anna/speed0",engineUrl:"https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/cwa/allcsa.js",jasBase:"https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/",avatar:"anna",remoteDependency:true} as const;
export function buildManifest(input:Omit<PlaybackManifest,"schemaVersion"|"renderer"|"segments">&{segments:SegmentBuildInput[]}):PlaybackManifest {
  return playbackManifestSchema.parse({...input,schemaVersion:"manifest-v2",renderer:RENDERER_PROFILE,segments:input.segments.map(buildManifestSegment)});
}
export function segmentPresentation(segment:ManifestSegment) {
  const blocked=segment.technicalStatus==="partial_blocked" || segment.criticalGaps.length>0;
  return {forceCaptionVisible:blocked,autoAdvanceAllowed:!blocked&&segment.technicalStatus==="ready",countsAsFullySigned:segment.technicalStatus==="ready",queue:[...(blocked?[{kind:"gap_card" as const,gaps:segment.criticalGaps,warning:"Available signs may convey a different or opposite meaning. Experimental · not reviewed by a BdSL signer."}]:[]),...segment.timeline]};
}
export function deriveTrackStatus(segments:readonly ManifestSegment[]):"complete"|"partial"|"failed" {return segments.length&&segments.every(s=>s.technicalStatus==="ready")?"complete":!segments.length||segments.every(s=>s.technicalStatus==="failed")?"failed":"partial";}
