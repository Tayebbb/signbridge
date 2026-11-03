/** Next may normalize the internal URL hostname; Host describes the browser-facing request. */
export function requestOrigin(request:Request){
  if(process.env.APP_ORIGIN){const configured=new URL(process.env.APP_ORIGIN);if(!["http:","https:"].includes(configured.protocol)||configured.origin!==process.env.APP_ORIGIN)throw Error("APP_ORIGIN must be an exact HTTP origin");return configured.origin;}
  const url=new URL(request.url),host=request.headers.get("host");
  if(!host)return url.origin;
  if(!/^[A-Za-z0-9.:[\]-]+$/u.test(host))throw Error("Invalid request Host");
  return new URL(`${url.protocol}//${host}`).origin;
}
