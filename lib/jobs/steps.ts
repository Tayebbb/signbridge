import type {StateStore} from "../db/session";
import {loadJob,eligibleAssets,stageRecord,updateProgress,readyMedia,jobProgress,corpusAttribution} from "../db/queries/api";
import {claimRun,heartbeat,acknowledgeRun} from "../db/queries/execution";
import {failJob} from "../db/queries/authority";
import {publishTrack} from "../db/queries/publish";
import {StateError} from "../db/queries/common";
import {meaningKey,planKey,segmentKey,hash,candidatesHash,trackIdFor,trackFingerprint,VALIDATOR_VERSION} from "../domain/fingerprints";
import {contextWindow} from "../domain/segmentation";
import {retrieveCandidates} from "../domain/retrieval";
import {validateMeaning,validatePlan} from "../domain/validators";
import {buildManifest,type SegmentBuildInput} from "../domain/manifest";
import {segmentMeaningSchema,meaningJsonSchema,type SegmentMeaning} from "../contracts/meaning";
import {segmentPlanSchema,createPlanSchema,planJsonSchema} from "../contracts/plan";
import {PROMPT_VERSIONS,type ModelId} from "../ai/models";
import type {ModelClient} from "../ai/protocol";
import {runStage,StageFailure,type StageHooks} from "../ai/runStage";
export interface Pipeline {store:StateStore;model:ModelClient;hooks?:StageHooks}
function profile(p:Pipeline,model:string){return p.model.kind==="fake"?`fake/${model}`:model;}
function config(model:string,stage:"meaning"|"plan"){return {model,effort:"medium",promptVersion:PROMPT_VERSIONS[stage],validatorVersion:VALIDATOR_VERSION};}
export function emptyMeaning(text:string):SegmentMeaning{return {schemaVersion:"meaning-v2",clauseType:"fragment",polarity:"affirmative",referents:[],concepts:[],propositions:[],ambiguities:[{conceptId:null,description:`Meaning analysis unavailable for this segment (${text.length} characters)`,blocking:true}]};}
const emptyPlan=()=>({schemaVersion:"plan-v2" as const,strategy:"no_signing_possible" as const,steps:[],uncoveredConceptIds:[],notes:"Processing failed"});
export async function claimPipeline(p:Pipeline,jobId:string,runId:string){if(!await claimRun(p.store,jobId,runId))return null;await acknowledgeRun(p.store,jobId,runId);const data=await loadJob(p.store,jobId);return data.segments.map(s=>s.idx);}
export async function processStage(p:Pipeline,jobId:string,runId:string,idx:number,stage:"meaning"|"plan"){
  const proof={runId};if(!await heartbeat(p.store,jobId,proof))return false;
  const data=await loadJob(p.store,jobId),segment=data.segments[idx];if(!segment)throw new StateError("not_found");
  const context=contextWindow(data.segments,idx,data.project.title),model=data.job.model_profile as ModelId;
  const mKey=meaningKey(segmentKey(segment,context),config(profile(p,model),"meaning"));
  try{
    if(stage==="meaning")await runStage(p.store,p.model,{jobId,proof,idx,stage,key:mKey,model,ownerId:data.project.owner_id,data:{segment:{text:segment.sourceText},context_before:context.before,context_after:context.after,title:context.title},schema:segmentMeaningSchema,jsonSchema:meaningJsonSchema,validate:(m,final)=>validateMeaning(m,segment.sourceText,context.before,{final})},p.hooks);
    else{
      const record=await stageRecord(p.store,mKey);if(!record)throw new StageFailure("meaning_failed");const meaning=segmentMeaningSchema.parse(record.output),candidates=retrieveCandidates(segment.sourceText,meaning,await eligibleAssets(p.store));
      const key=planKey(hash(meaning),candidatesHash(candidates.map(c=>({id:c.asset.id,derivedSha256:c.asset.derivedSha256}))),config(profile(p,model),"plan"));
      await runStage(p.store,p.model,{jobId,proof,idx,stage,key,model,ownerId:data.project.owner_id,data:{segment:{text:segment.sourceText},meaning,context_before:context.before,context_after:context.after,candidates:candidates.map(c=>({id:c.asset.id,label_bn:c.asset.labelBn,kind:c.asset.kind,unit_count:c.asset.unitCount,concept_ids:c.conceptIds,exact_phrase:c.exactPhrase}))},schema:createPlanSchema(candidates.map(c=>c.asset.id)),jsonSchema:planJsonSchema(candidates.map(c=>c.asset.id)),validate:m=>validatePlan(m,meaning,candidates)},p.hooks);
    }
    return true;
  }catch(error){if(error instanceof StageFailure){await updateProgress(p.store,jobId,proof,idx,stage,"failed",error.code);return false;}if(error instanceof StateError&&["fenced","spend_cap"].includes(error.code))return false;throw error;}
}
export async function finishPipeline(p:Pipeline,jobId:string,runId:string){
  const proof={runId};if(!await heartbeat(p.store,jobId,proof))return {status:"fenced" as const};
  const data=await loadJob(p.store,jobId),media=await readyMedia(p.store,data.project.id);if(!media){await failJob(p.store,jobId,"media_unavailable");return {status:"failed" as const};}
  const assets=await eligibleAssets(p.store),inputs:SegmentBuildInput[]=[];
  for(const segment of data.segments){const context=contextWindow(data.segments,segment.idx,data.project.title),mKey=meaningKey(segmentKey(segment,context),config(profile(p,data.job.model_profile),"meaning")),m=await stageRecord(p.store,mKey),meaning=m?segmentMeaningSchema.parse(m.output):emptyMeaning(segment.sourceText),candidates=retrieveCandidates(segment.sourceText,meaning,assets);
    const pKey=planKey(hash(meaning),candidatesHash(candidates.map(c=>({id:c.asset.id,derivedSha256:c.asset.derivedSha256}))),config(profile(p,data.job.model_profile),"plan")),plan=await stageRecord(p.store,pKey);
    inputs.push({segment,meaning,plan:plan?segmentPlanSchema.parse(plan.output):emptyPlan(),candidates,before:context.before,meaningResultKey:mKey,planResultKey:pKey,failed:!m||!plan});
  }
  const manifest=buildManifest({trackVersionId:"pending",projectId:data.project.id,transcriptVersion:{id:data.transcript.id,versionNo:data.transcript.version_no,textHash:data.transcript.text_hash},media:{contentSha256:media.client_sha256,sizeBytes:media.size_bytes,durationMs:media.client_duration_ms},provenance:{corpusReleaseId:"ik2-mendeley-v2",corpusLicense:"CC-BY-4.0",corpusAttribution:await corpusAttribution(p.store),sourceFormVersion:"src-v1",sigmlBuilderVersion:"sigml-builder-v2",modelProfile:profile(p,data.job.model_profile),promptVersions:PROMPT_VERSIONS,validatorVersion:VALIDATOR_VERSION},anchors:[],segments:inputs});
  manifest.trackVersionId=trackIdFor(jobId,trackFingerprint(manifest));const result=await publishTrack(p.store,jobId,proof,manifest);return result;
}
export async function runPipeline(p:Pipeline,jobId:string,runId:string){
  const indices=await claimPipeline(p,jobId,runId);if(!indices)return;
  let cursor=0;await Promise.all(Array.from({length:Math.min(4,indices.length)},async()=>{while(cursor<indices.length){const idx=indices[cursor++];if(await processStage(p,jobId,runId,idx,"meaning"))await processStage(p,jobId,runId,idx,"plan");}}));
  await finishPipeline(p,jobId,runId);return jobProgress(p.store,jobId);
}
