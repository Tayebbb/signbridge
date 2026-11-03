import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {FilesystemBlobStore,type BlobStore} from "./blob";
export interface SignedBlobs extends BlobStore {
  sign(pathname:string,operation:"get"|"put",expiresAt:Date,constraints?:{contentType:string;maximumSizeInBytes:number}):Promise<string>;
}
const capability=z.strictObject({pathname:z.string().max(200),operation:z.enum(["get","put"]),expires:z.number().int(),contentType:z.string().optional(),maximumSizeInBytes:z.number().int().positive().max(15_728_640).optional()});
const runtime=globalThis as typeof globalThis&{signbridgeLocalBlobKey?:Buffer};
/** Ephemeral local URL signing; restarting the server requires fetching a fresh URL. */
export class LocalSignedBlobs extends FilesystemBlobStore implements SignedBlobs {
  async head(pathname:string){return {...await super.head(pathname),contentType:pathname.endsWith(".webm")?"video/webm":pathname.endsWith(".jpg")?"image/jpeg":"video/mp4"};}
  private key(){return runtime.signbridgeLocalBlobKey??=randomBytes(32);}
  async sign(pathname:string,operation:"get"|"put",expiresAt:Date,constraints?:{contentType:string;maximumSizeInBytes:number}){
    const payload=Buffer.from(JSON.stringify(capability.parse({pathname,operation,expires:expiresAt.getTime(),...constraints}))).toString("base64url");
    return `/api/local-blob?cap=${payload}.${createHmac("sha256",this.key()).update(payload).digest("base64url")}`;
  }
  verify(value:string,operation:"get"|"put"){
    if(value.length>1500)throw Error("Invalid capability");const [payload,signature,...extra]=value.split(".");if(!payload||!signature||extra.length)throw Error("Invalid capability");
    const actual=Buffer.from(signature,"base64url"),expected=createHmac("sha256",this.key()).update(payload).digest();
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error("Invalid capability");
    const decoded=capability.parse(JSON.parse(Buffer.from(payload,"base64url").toString("utf8")));
    if(decoded.operation!==operation||decoded.expires<=Date.now())throw Error("Expired or foreign capability");return decoded;
  }
}
let local:LocalSignedBlobs|undefined;
export function localBlobs(){return local??=new LocalSignedBlobs(process.env.LOCAL_BLOB_DIR||".data/blob");}
export async function applicationBlobs():Promise<SignedBlobs>{
  if(process.env.BLOB_DRIVER==="vercel"){const {VercelBlobs}=await import("./vercel");return new VercelBlobs();}
  if(process.env.VERCEL)throw Error("Private production Blob adapter must be configured");return localBlobs();
}
