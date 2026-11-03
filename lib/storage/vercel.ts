import {put,get,head,del,list,issueSignedToken,presignUrl} from "@vercel/blob";
import type {SignedBlobs} from "./urls";
export class VercelBlobs implements SignedBlobs {
  async put(pathname:string,bytes:Uint8Array){await put(pathname,new Blob([bytes as Uint8Array<ArrayBuffer>]),{access:"private",addRandomSuffix:false,allowOverwrite:false});}
  async get(pathname:string){const r=await get(pathname,{access:"private",useCache:false});if(!r?.stream)throw Error("Blob unavailable");return new Uint8Array(await new Response(r.stream).arrayBuffer());}
  async head(pathname:string){const r=await head(pathname);return {size:r.size,contentType:r.contentType};}
  async remove(pathname:string){await del(pathname);}
  async list(prefix:string){const result:{pathname:string;size:number}[]=[];let cursor:string|undefined;
    do{const page=await list({prefix,cursor});result.push(...page.blobs.map(b=>({pathname:b.pathname,size:b.size})));cursor=page.hasMore?page.cursor:undefined;}while(cursor);return result;
  }
  async sign(pathname:string,operation:"get"|"put",expiresAt:Date,constraints?:{contentType:string;maximumSizeInBytes:number}){
    const allowedContentTypes=constraints?[constraints.contentType]:undefined,maximumSizeInBytes=constraints?.maximumSizeInBytes;
    const token=await issueSignedToken({pathname,operations:[operation],validUntil:expiresAt.getTime(),allowedContentTypes,maximumSizeInBytes});
    const result=await presignUrl(token,{pathname,operation,access:"private",validUntil:expiresAt.getTime(),...(operation==="put"?{allowedContentTypes,maximumSizeInBytes,addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:0}:{useCache:false})});
    return result.presignedUrl;
  }
}
