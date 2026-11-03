import {playbackManifestSchema,currentTrackResponseSchema,type PlaybackManifest,type CurrentTrackResponse} from "../contracts/manifest";
export class TrackStore {
  manifest:PlaybackManifest|null=null;current:CurrentTrackResponse|null=null;stale=new Set<number>();
  private manifests=new Map<string,{etag:string;manifest:PlaybackManifest}>();
  constructor(private readonly projectId:string,private readonly fetcher:typeof fetch=(input,init)=>fetch(input,init)){}
  markStale(indices:number[]){indices.forEach(i=>this.stale.add(i));}
  async refresh(signal?:AbortSignal){
    const response=await this.fetcher(`/api/projects/${this.projectId}/track`,{cache:"no-store",signal});if(response.status===404)return null;if(!response.ok)throw Error("Saved track could not be loaded. Retry.");
    const current=currentTrackResponseSchema.parse(await response.json()),cached=this.manifests.get(current.trackVersionId);
    const manifestResponse=await this.fetcher(`/api/tracks/${current.trackVersionId}/manifest`,{cache:"no-cache",signal,headers:cached?{"If-None-Match":cached.etag}:{}});
    let manifest:PlaybackManifest;
    if(manifestResponse.status===304&&cached){if(cached.etag!==`"${current.manifestHash}"`)throw Error("Manifest identity did not match revalidation.");manifest=cached.manifest;}
    else{if(!manifestResponse.ok)throw Error("Saved track is no longer available.");const parsed=playbackManifestSchema.parse(await manifestResponse.json()),etag=manifestResponse.headers.get("etag");if(etag!==`"${current.manifestHash}"`)throw Error("Manifest identity did not match the current track.");
      // Browsers can merge a network 304 into a cached 200; preserve the immutable object identity too.
      manifest=cached?.etag===etag?cached.manifest:parsed;this.manifests.set(current.trackVersionId,{etag,manifest});}
    if(manifest.projectId!==this.projectId||manifest.trackVersionId!==current.trackVersionId)throw Error("Saved track binding did not match.");
    const changed=this.current?.manifestHash!==current.manifestHash;
    // Avoid reloading the source video on every pointer poll; its current signed URL is still valid.
    if(!changed&&this.current?.media.state==="available"&&current.media.state==="available"&&this.current.media.expiresAt&&Date.parse(this.current.media.expiresAt)>Date.now()+30000)current.media=this.current.media;
    this.current=current;this.manifest=manifest;if(changed)this.stale.clear();return {current,manifest,changed};
  }
}
