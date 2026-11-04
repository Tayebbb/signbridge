import {NextRequest,NextResponse} from "next/server";
export function proxy(request:NextRequest){
  const nonce=Buffer.from(crypto.randomUUID()).toString("base64"),dev=process.env.NODE_ENV==="development";
  // Blob 2.8 presigned PUT URLs use this endpoint, rather than the object-storage hostname.
  const policy=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":""}`,`style-src 'self' 'nonce-${nonce}'`,"img-src 'self' blob: data:","font-src 'self'","connect-src 'self' https://*.blob.vercel-storage.com https://blob.vercel-storage.com https://vercel.com/api/blob/","media-src 'self' blob: https://*.blob.vercel-storage.com","frame-src 'self'","object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'"].join("; ");
  const headers=new Headers(request.headers);headers.set("x-nonce",nonce);headers.set("Content-Security-Policy",policy);
  const response=NextResponse.next({request:{headers}});response.headers.set("Content-Security-Policy",policy);return response;
}
export const config={matcher:["/((?!api|_next|\\.well-known/workflow|renderer\\.html|renderer-frame\\.js|renderer\\.css|fixtures|event-sticker\\.png|favicon\\.ico).*)"]};
