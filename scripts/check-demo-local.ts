// Full local validation of generated clips through the real controllers and SQL, with labelled fake model output.
import {mkdtemp,rm,writeFile,readFile} from "node:fs/promises";
import {resolve,sep} from "node:path";
import {randomUUID} from "node:crypto";
import {prepareDemos} from "./seed-demo";
import {createDatabase} from "../lib/db/client";
import {applyCorpusSeed} from "../lib/db/queries/corpusSeed";
import {operationsStatus} from "../lib/db/queries/operations";
import {LocalSignedBlobs} from "../lib/storage/urls";
import {makeApi,type Action} from "../lib/server/api";
import {handleLocalBlob} from "../lib/server/localBlob";
import {LocalPipelineDispatcher} from "../lib/jobs/localDispatcher";
import {deterministicFake} from "../lib/ai/fakeFixtures";
import {playbackManifestSchema,currentTrackResponseSchema} from "../lib/contracts/manifest";
const demos=await prepareDemos("demo-input/demo.json"),db=await createDatabase(),root=await mkdtemp(resolve(".data/demo-check-"));
const blobs=new LocalSignedBlobs(root),model=deterministicFake(),deferred:(()=>Promise<void>)[]=[],projects:unknown[]=[];
const api=makeApi({store:db.state,blobs,processingEnabled:true,defer:work=>deferred.push(work),dispatcher:async()=>new LocalPipelineDispatcher({store:db.state,model})});
let cookie="";
async function request<T>(action:Action,path:string,method="GET",input?:unknown,params:Record<string,string>={},shared=false):Promise<T>{
  const response=await api(new Request(`http://localhost${path}`,{method,headers:{Origin:"http://localhost",Cookie:shared?"":cookie,"Content-Type":"application/json","Idempotency-Key":randomUUID()},...(input===undefined?{}:{body:JSON.stringify(input)})}),action,params);
  if(!response.ok)throw Error(`Local demo ${action} returned ${response.status}`);if(response.headers.has("set-cookie"))cookie=response.headers.get("set-cookie")!.split(";")[0];return response.json() as Promise<T>;
}
try{
  await db.migrate();await applyCorpusSeed(db.state,await readFile(".data/phase7-corpus/seed.sql","utf8"));
  for(const demo of demos){
    const {projectId}=await request<{projectId:string}>("createProject","/api/projects","POST",{title:demo.title,rightsAttested:true}),params={projectId},base=`/api/projects/${projectId}`;
    const init=await request<{mediaId:string;uploadUrl:string}>("mediaInit",base+"/media/init","POST",{contentType:demo.contentType,sizeBytes:demo.bytes.length,sha256:demo.sha256,durationMs:demo.durationMs,width:demo.width,height:demo.height},params);
    const upload=await handleLocalBlob(new Request(new URL(init.uploadUrl,"http://localhost"),{method:"PUT",headers:{Origin:"http://localhost","Content-Type":demo.contentType},body:demo.bytes}),blobs);if(!upload.ok)throw Error("Signed local upload failed");
    await request("mediaFinalize",base+"/media/finalize","POST",{mediaId:init.mediaId},params);
    const tv=await request<{transcriptVersion:{id:string}}>("transcripts",base+"/transcripts","POST",{format:demo.format,text:demo.text},params);
    await request("startJob",base+"/jobs","POST",{transcriptVersionId:tv.transcriptVersion.id},params);while(deferred.length)await deferred.shift()!();
    const pointer=currentTrackResponseSchema.parse(await request("track",base+"/track","GET",undefined,params)),manifest=playbackManifestSchema.parse(await request("manifest",`/api/tracks/${pointer.trackVersionId}/manifest`,"GET",undefined,{trackId:pointer.trackVersionId}));
    if(!manifest.provenance.modelProfile.startsWith("fake/")||manifest.segments.length!==demo.segments)throw Error("Local fixture provenance or segmentation mismatch");
    const blocked=manifest.segments.some(s=>s.technicalStatus==="partial_blocked"||s.technicalStatus==="no_signing");if(demo.expectUnsupported?!blocked:manifest.segments.some(s=>s.technicalStatus!=="ready")){await writeFile(".data/local-demo-failure.json",JSON.stringify({source:demo.id,segments:manifest.segments.map(s=>({idx:s.idx,technicalStatus:s.technicalStatus,criticalGaps:s.criticalGaps,ambiguities:s.ambiguities}))},null,2));throw Error("Unexpected local coverage; do not hand-edit the plan");}
    const before=await operationsStatus(db.state),calls=model.calls.length,share=await request<{shareUrl:string}>("share",base+"/share","POST",{enable:true},params),query=new URL(share.shareUrl).search;
    const shared=currentTrackResponseSchema.parse(await request("track",base+"/track"+query,"GET",undefined,params,true));await request("manifest",`/api/tracks/${pointer.trackVersionId}/manifest`+query,"GET",undefined,{trackId:pointer.trackVersionId},true);
    if(shared.manifestHash!==pointer.manifestHash||model.calls.length!==calls||(await operationsStatus(db.state)).stageAttemptCount!==before.stageAttemptCount)throw Error("Saved shared replay changed the artifact or called the model");
    projects.push({source:demo.id,production:false,manifestHash:pointer.manifestHash,modelProfile:manifest.provenance.modelProfile,segments:manifest.segments.map(s=>({idx:s.idx,technicalStatus:s.technicalStatus,units:s.sigml?.unitCount??0,criticalGaps:s.criticalGaps.map(g=>g.surfaceBn)})),sharedReplayUnchanged:true});
  }
  const result={status:"PASS",production:false,externalModelCalls:0,paidSpendUsd:0,fakeFixtureCalls:model.calls.length,projects};
  await writeFile("docs/evidence/phase-7/local-demo-check.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify({status:result.status,production:false,projects:projects.length,fakeFixtureCalls:model.calls.length,externalModelCalls:0,paidSpendUsd:0}));
}finally{await db.close();if(!root.startsWith(resolve(".data")+sep))throw Error("Unexpected local fixture cleanup path");await rm(root,{recursive:true,force:true});}
