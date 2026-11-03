import {localBlobs} from "../storage/urls";
import {requestOrigin} from "./origin";
export async function localBlob(request:Request){return handleLocalBlob(request,localBlobs());}
export async function handleLocalBlob(request:Request,blobs:ReturnType<typeof localBlobs>){
  if(process.env.VERCEL||process.env.BLOB_DRIVER==="vercel")return new Response(null,{status:404});
  try{const operation=request.method==="PUT"?"put":"get",cap=blobs.verify(new URL(request.url).searchParams.get("cap")??"",operation);
    if(operation==="put"){
      if(request.headers.get("origin")!==requestOrigin(request))return new Response(null,{status:403});
      if(request.headers.get("content-type")!==cap.contentType||!cap.maximumSizeInBytes)return new Response(null,{status:422});
      const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});let length=0;const chunks:Uint8Array[]=[];
      for(;;){const r=await reader.read();if(r.done)break;length+=r.value.byteLength;if(length>cap.maximumSizeInBytes){await reader.cancel();return new Response(null,{status:413});}chunks.push(r.value);}
      if(!length)return new Response(null,{status:422});
      try{await blobs.putOnce(cap.pathname,Buffer.concat(chunks));}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")return new Response(null,{status:409});throw error;}return new Response(null,{status:201});
    }
    const data=await blobs.get(cap.pathname),headers=new Headers({"Content-Type":(await blobs.head(cap.pathname)).contentType??"application/octet-stream","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Accept-Ranges":"bytes"});
    const range=request.headers.get("range");if(range){const match=/^bytes=(\d+)-(\d*)$/u.exec(range);if(!match)return new Response(null,{status:416});const start=Number(match[1]),end=match[2]?Number(match[2]):data.length-1;if(start>end||end>=data.length)return new Response(null,{status:416});headers.set("Content-Range",`bytes ${start}-${end}/${data.length}`);return new Response(data.slice(start,end+1),{status:206,headers});}
    return new Response(data as Uint8Array<ArrayBuffer>,{headers});
  }catch{return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});}
}
