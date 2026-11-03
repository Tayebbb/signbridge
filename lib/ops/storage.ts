import type {StateStore} from "../db/session";
import type {BlobStore} from "../storage/blob";
import {storageCleanupCandidates,markStorageCleanup,releaseStorage,reserveMedia,type MediaInit} from "../db/queries/storage";
export async function sweepStorage(store:StateStore,blobs:BlobStore,now=new Date(),limit=5,projectId?:string) {
  const candidates=await storageCleanupCandidates(store,now,limit,projectId);let released=0;
  for(const item of candidates)if(await markStorageCleanup(store,item,now)){await blobs.remove(item.pathname);released+=Number(await releaseStorage(store,item,now));}return released;
}
/** Opportunistic retention precedes admission; all accounting remains in SQL transactions. */
export async function initMedia(store:StateStore,blobs:BlobStore,input:MediaInit,now=new Date()) {await sweepStorage(store,blobs,now,5);return reserveMedia(store,input,now);}
