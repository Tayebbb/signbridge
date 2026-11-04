import {test,expect} from "vitest";
import {randomUUID} from "node:crypto";
import {TrackStore} from "@/lib/player/store";
import {manifestHash} from "@/lib/domain/fingerprints";
import {trackFor} from "../race/support";
test("Saved polling revalidates the manifest, keeps the playing media URL stable, and rejects revoked manifests",async()=>{
  const manifest=trackFor({projectId:randomUUID(),jobId:randomUUID(),transcriptVersionId:randomUUID()}),hash=manifestHash(manifest),calls:{url:string;headers:Headers}[]=[];let round=0,revoked=false;
  const fetcher:typeof fetch=async(input,init)=>{const url=String(input);calls.push({url,headers:new Headers(init?.headers)});
    if(url.endsWith("/track")){round++;return Response.json({trackVersionId:manifest.trackVersionId,manifestHash:hash,overlays:{sourceChecks:[],review:{status:"unreviewed",validFor:null}},media:{state:"available",url:`/signed-${round}`,expiresAt:new Date(Date.now()+900000).toISOString(),reason:null}});}
    if(revoked)return new Response(null,{status:404});if(round===2)return new Response(null,{status:304,headers:{ETag:`"${hash}"`}});return Response.json(manifest,{headers:{ETag:`"${hash}"`}});
  };
  const store=new TrackStore(manifest.projectId,fetcher),first=await store.refresh(),second=await store.refresh();expect(second?.changed).toBe(false);expect(second?.manifest).toBe(first?.manifest);expect(second?.current.media.url).toBe("/signed-1");expect(calls[3].headers.get("if-none-match")).toBe(`"${hash}"`);
  const browserMerged304=await store.refresh();expect(browserMerged304?.manifest).toBe(first?.manifest);expect(browserMerged304?.current.media.url).toBe("/signed-1");
  revoked=true;await expect(store.refresh()).rejects.toThrow("no longer available");
});

test("Compressed edge responses retain manifest identity across weak and strong ETags",async()=>{
  const manifest=trackFor({projectId:randomUUID(),jobId:randomUUID(),transcriptVersionId:randomUUID()}),hash=manifestHash(manifest);let round=0;
  const fetcher:typeof fetch=async input=>{
    if(String(input).endsWith("/track")){round++;return Response.json({trackVersionId:manifest.trackVersionId,manifestHash:hash,overlays:{sourceChecks:[],review:{status:"unreviewed",validFor:null}},media:{state:"missing",url:null,expiresAt:null,reason:null}});}
    if(round===2)return new Response(null,{status:304,headers:{ETag:`W/"${hash}"`}});
    return Response.json(manifest,{headers:{ETag:round===1?`W/"${hash}"`:`"${hash}"`}});
  };
  const store=new TrackStore(manifest.projectId,fetcher),first=await store.refresh();
  expect((await store.refresh())?.manifest).toBe(first?.manifest);
  expect((await store.refresh())?.manifest).toBe(first?.manifest);
  const foreign:typeof fetch=async(input,init)=>String(input).endsWith("/manifest")?Response.json(manifest,{headers:{ETag:`W/"${"0".repeat(64)}"`}}):fetcher(input,init);
  await expect(new TrackStore(manifest.projectId,foreign).refresh()).rejects.toThrow("identity did not match");
});
