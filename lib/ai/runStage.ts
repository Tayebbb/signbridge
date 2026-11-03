import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import type {z} from "zod";
import type {StateStore} from "../db/session";
import type {RunProof} from "../db/queries/common";
import {StateError} from "../db/queries/common";
import {reserveModelCall,settleModelUsage} from "./spend";
import {settleAttempt} from "../db/queries/spend";
import {stageAttemptsFor,updateProgress,noteSolUnavailable} from "../db/queries/api";
import {cachedStage,writeStageResult} from "../db/queries/stages";
import {heartbeat} from "../db/queries/execution";
import {MODELS,PROMPT_VERSIONS,TOKEN_CAPS,type ModelId} from "./models";
import {responseBody} from "./client";
import {ModelFailure,type ModelClient,type ModelRequest} from "./protocol";
import {operationLog} from "../ops/log";
import {applyErrorKillSwitch} from "../db/queries/operations";
const prompts=new Map<string,Promise<string>>();
export function stagePrompt(stage:"meaning"|"plan"){let value=prompts.get(stage);if(!value){value=readFile(resolve(`lib/ai/prompts/${stage}.v1.md`),"utf8");prompts.set(stage,value);}return value;}
export class StageFailure extends Error {constructor(public readonly code:string){super(code);}}
export interface StageHooks {afterModel?:(stage:string,idx:number)=>Promise<void>;sleep?:(ms:number)=>Promise<void>}
export async function runStage<T>(store:StateStore,client:ModelClient,input:{processingEnabled?:()=>boolean;jobId:string;proof:RunProof;idx:number;stage:"meaning"|"plan";key:string;model:ModelId;ownerId:string;data:Record<string,unknown>;schema:z.ZodType<T>;jsonSchema:Record<string,unknown>;validate:(output:T,final:boolean)=>{value:T;issues:unknown[]}},hooks:StageHooks={}){
  const log=(outcome:string,latencyMs:number)=>operationLog({jobId:input.jobId,segmentIdx:input.idx,stage:input.stage,cacheKey:input.key,outcome,latencyMs});
  const hit=await cachedStage(store,input.jobId,input.proof,input.key,input.stage,input.idx);if(hit){log("cache_hit",0);await updateProgress(store,input.jobId,input.proof,input.idx,input.stage==="plan"?"validated":input.stage,"cache_hit");return input.schema.parse(hit.output);}
  let attempts=await stageAttemptsFor(store,input.jobId,input.idx,input.stage),ordinary=attempts.filter(a=>!a.outcome.startsWith("repair_")).length,repair=attempts.some(a=>a.outcome.startsWith("repair_"));
  // A reservation found without a cached result cannot safely be sent again under the same number.
  for(const a of attempts)if(a.reservation_id&&["reserved","repair_reserved"].includes(a.outcome))await settleAttempt(store,a.reservation_id,input.proof,"held_uncertain",0n,new Date(),undefined,"uncertain");
  let repairData:unknown=null,last:unknown=null,issues:unknown[]=[],wantRepair=false;
  const system=await stagePrompt(input.stage),sleep=hooks.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  while(ordinary<3||wantRepair&&!repair){
    if(input.processingEnabled?.()===false)throw new StateError("processing_disabled");
    if(client.kind==="openai")await applyErrorKillSwitch(store);
    if(!await heartbeat(store,input.jobId,input.proof))throw new StateError("fenced");
    const isRepair=wantRepair;if(isRepair&&repair)break;if(isRepair)repair=true;else if(++ordinary>3)break;
    const attemptNo=(attempts.at(-1)?.attempt_no??0)+1;if(attemptNo>4)break;
    const data={...input.data,...(isRepair?{repair:{previous_output:repairData,issues}}:{})};
    const request:ModelRequest<T>={stage:input.stage,model:input.model,system,ownerId:input.ownerId,input:data,outputSchema:input.schema,jsonSchema:input.jsonSchema};
    const reservation=await reserveModelCall(store,{jobId:input.jobId,proof:input.proof,segmentIdx:input.idx,stage:input.stage,cacheKey:input.key,attemptNo,repair:isRepair,provider:client.kind,requestJson:JSON.stringify(responseBody(request)),maxOutputTokens:TOKEN_CAPS[input.stage],prices:MODELS[input.model]});
    if(!reservation.created)throw new StageFailure("attempt_in_flight");
    await updateProgress(store,input.jobId,input.proof,input.idx,input.stage,isRepair||attemptNo>1?"retrying":"ok");
    let reply;const sentAt=Date.now();
    try{reply=await client.respond(request);}
    catch(error){const failure=error instanceof ModelFailure?error:new ModelFailure("model_network",true);
      await settleAttempt(store,reservation.id,input.proof,failure.sent?"held_uncertain":"released",0n,new Date(),undefined,failure.code);
      log(failure.code,Date.now()-sentAt);
      if(client.kind==="openai"&&input.model==="gpt-6.1-sol"&&["model_http_404","model_http_503"].includes(failure.code))await noteSolUnavailable(store);
      if(!failure.retryable||isRepair)throw new StageFailure(failure.code);
      await sleep(Math.max(failure.retryAfterMs,Math.min(4000,500*2**(attemptNo-1))));attempts=await stageAttemptsFor(store,input.jobId,input.idx,input.stage);continue;
    }
    if(reply.usage)await settleModelUsage(store,reservation.id,input.proof,reply.usage,MODELS[input.model],new Date(),reply.status);
    else await settleAttempt(store,reservation.id,input.proof,"held_uncertain",0n,new Date(),undefined,reply.status);
    log(reply.status,Date.now()-sentAt);
    // This is intentionally outside the model-error handler: process death leaves no stage output.
    await hooks.afterModel?.(input.stage,input.idx);
    if(reply.status==="refusal")throw new StageFailure("refusal");
    attempts=await stageAttemptsFor(store,input.jobId,input.idx,input.stage);
    if(reply.status==="incomplete"){if(isRepair)throw new StageFailure("incomplete");await sleep(500);continue;}
    const parsed=input.schema.safeParse(reply.output);
    if(!parsed.success){issues=[{code:"schema",message:"Output did not match the strict schema"}];repairData=reply.output;if(isRepair)throw new StageFailure("invalid_output");wantRepair=true;continue;}
    const checked=input.validate(parsed.data,isRepair);last=checked.value;issues=checked.issues;
    if(issues.length&&!isRepair){repairData=reply.output;wantRepair=true;continue;}
    const saved=await writeStageResult(store,input.jobId,input.proof,{cacheKey:input.key,stage:input.stage,schemaVersion:input.stage==="meaning"?"meaning-v2":"plan-v2",modelId:client.kind==="fake"?`fake/${input.model}`:input.model,promptVersion:PROMPT_VERSIONS[input.stage],output:checked.value,validation:{issues}});
    if(!saved)throw new StateError("fenced");await updateProgress(store,input.jobId,input.proof,input.idx,input.stage==="plan"?"validated":input.stage,"ok");return input.schema.parse(saved.output);
  }
  void last;throw new StageFailure("attempts_exhausted");
}
