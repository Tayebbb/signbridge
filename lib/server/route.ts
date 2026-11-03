import {after} from "next/server";
import {makeApi,type Action} from "./api";
import {applicationStore} from "../db/queries/api";
import {applicationBlobs} from "../storage/urls";
export function route(action:Action){return async(request:Request,context:{params:Promise<Record<string,string>>})=>{
  const store=await applicationStore(),blobs=await applicationBlobs();
  const handle=makeApi({store,blobs,processingEnabled:process.env.PROCESSING_ENABLED==="true",adminToken:process.env.ADMIN_TOKEN,cronSecret:process.env.CRON_SECRET,defer:work=>after(work),dispatcher:async()=>{
    if(process.env.JOB_DRIVER==="workflows"){const {WorkflowDispatcher}=await import("../jobs/productionDispatcher");return new WorkflowDispatcher(store);}
    if(process.env.VERCEL)throw Error("Production dispatcher must be explicitly configured");
    const [{LocalPipelineDispatcher},{applicationPipeline}]=await Promise.all([import("../jobs/localDispatcher"),import("../jobs/runtime")]);return new LocalPipelineDispatcher(await applicationPipeline());
  }});
  return handle(request,action,await context.params);
};}
