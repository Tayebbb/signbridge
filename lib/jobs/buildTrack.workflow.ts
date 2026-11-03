import {getWorkflowMetadata} from "workflow";
import {claimWorkflow,meaningWorkflow,planWorkflow,publishWorkflow} from "./workflowSteps";
/** Only identifiers cross durable boundaries; captions remain in Postgres. */
export async function buildTrack(jobId:string){
  "use workflow";
  const {workflowRunId}=getWorkflowMetadata(),indices=await claimWorkflow(jobId,workflowRunId);if(!indices)return;
  // Four segments at a time, with independently persisted M and P step boundaries.
  for(let offset=0;offset<indices.length;offset+=4)await Promise.all(indices.slice(offset,offset+4).map(async idx=>{
    if(await meaningWorkflow(jobId,workflowRunId,idx))await planWorkflow(jobId,workflowRunId,idx);
  }));
  await publishWorkflow(jobId,workflowRunId);
}
