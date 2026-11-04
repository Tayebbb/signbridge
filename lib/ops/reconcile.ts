import type {StateStore} from "../db/session";
import type {BlobStore} from "../storage/blob";
import type {Dispatcher} from "../jobs/dispatcher";
import {pendingDispatches,recordDispatchFailure} from "../db/queries/execution";
import {storageCleanupCandidates} from "../db/queries/storage";
import {stallFence} from "../db/queries/authority";
import {stalledJobs} from "../db/queries/maintenance";
import {sweepSpend} from "../db/queries/spend";
import {deletingProjects,sweepOrphanStages} from "../db/queries/purge";
import {sweepStorage} from "./storage";
import {purgeProject} from "./purge";
import {sweepOperations} from "../db/queries/operations";
export async function reconcile(store:StateStore,blobs:BlobStore,dispatcher:Pick<Dispatcher,"dispatch">,options:{now?:Date;projectId?:string;opportunistic?:boolean;onError?:(code:string,id:string)=>void}={}) {
  const now=options.now??new Date(),limit=options.opportunistic===false?100:5;
  const reportError=options.onError??((code:string,id:string)=>console.error(JSON.stringify({code,id})));
  const counters={redispatched:0,fenced:0,reservationsConverted:0,storageReleased:0,purged:0};
  await sweepOperations(store,now);
  for(const job of await pendingDispatches(store,now,options.projectId))try{await dispatcher.dispatch(job.id);counters.redispatched++;}catch{await recordDispatchFailure(store,job.id);reportError("dispatch_failed",job.id);}
  for(const job of await stalledJobs(store,now,options.projectId))counters.fenced+=Number(await stallFence(store,job.id,now));
  counters.reservationsConverted=await sweepSpend(store,now);
  // Drain successful batches, but stop on zero progress so an unavailable object cannot spin the cron.
  let released:number;
  do{released=await sweepStorage(store,blobs,now,limit,options.projectId,id=>reportError("storage_cleanup_failed",id));counters.storageReleased+=released;}while(released>0&&options.opportunistic===false&&(await storageCleanupCandidates(store,now,1,options.projectId)).length);
  let afterId:string|undefined;
  for(;;){const batch=await deletingProjects(store,limit,options.projectId,afterId);for(const project of batch)try{counters.purged+=Number(await purgeProject(store,blobs,project.id,now));}catch{reportError("purge_incomplete",project.id);}
    if(options.opportunistic!==false||batch.length<limit)break;afterId=batch.at(-1)!.id;}
  while(await sweepOrphanStages(store,now,limit)===limit&&options.opportunistic===false){/* Drain cron backlog; opportunistic work executes one bounded batch. */}
  return counters;
}
