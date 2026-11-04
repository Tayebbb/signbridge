import {applicationPipeline} from "./runtime";
import {claimPipeline,processStage,finishPipeline} from "./steps";
import {acknowledgeRun} from "../db/queries/execution";
export async function claimWorkflow(jobId:string,runId:string){
  "use step";
  const p=await applicationPipeline(),result=await claimPipeline(p,jobId,runId);if(result)await acknowledgeRun(p.store,jobId,runId);return result;
}
export async function meaningWorkflow(jobId:string,runId:string,idx:number){
  "use step";
  return processStage(await applicationPipeline(),jobId,runId,idx,"meaning");
}
export async function planWorkflow(jobId:string,runId:string,idx:number){
  "use step";
  return processStage(await applicationPipeline(),jobId,runId,idx,"plan");
}
export async function publishWorkflow(jobId:string,runId:string){
  "use step";
  return finishPipeline(await applicationPipeline(),jobId,runId);
}
