import type {StateStore} from "../db/session";
import type {BlobStore} from "../storage/blob";
import {purgeSnapshot,finalizePurge} from "../db/queries/purge";
import {StateError} from "../db/queries/common";
export async function purgeProject(store:StateStore,blobs:BlobStore,projectId:string,now=new Date()) {
  const snapshot=await purgeSnapshot(store,projectId,now);if(!snapshot)return false;
  for(const prefix of [`v/${projectId}/`,`a/${projectId}/`]) {
    const files=await blobs.list(prefix);
    for(const file of files){if(!file.pathname.startsWith(prefix))throw new StateError("blob_path_scope");await blobs.remove(file.pathname);}
  }
  return finalizePurge(store,projectId,snapshot.epoch,now);
}
