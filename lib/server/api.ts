import {z,ZodError} from "zod";
import {timingSafeEqual} from "node:crypto";
import type {StateStore} from "../db/session";
import type {SignedBlobs} from "../storage/urls";
import type {Dispatcher} from "../jobs/dispatcher";
import * as q from "../db/queries/api";
import {StateError} from "../db/queries/common";
import {startJob,retryJob,cancelJob,submitTranscriptVersion,failJob,deleteProject} from "../db/queries/authority";
import {finalizeMedia,admitTransfer} from "../db/queries/storage";
import {budgetSignal} from "../db/queries/spend";
import {recordDispatchFailure} from "../db/queries/execution";
import {initMedia} from "../ops/storage";
import {reconcile} from "../ops/reconcile";
import {hash,sha256} from "../domain/fingerprints";
import {parseSrt} from "../domain/captions/parseSrt";
import {parseVtt} from "../domain/captions/parseVtt";
import {parsePasted} from "../domain/captions/parsePasted";
import {CaptionError} from "../domain/captions/shared";
import {editTranscript} from "../domain/transcriptEdits";
import {createOwnerCapability,hashOwnerToken,OWNER_COOKIE_NAME,ownerCookieHeader} from "../auth/ownerCookie";
import {requestOrigin} from "./origin";
import {accessibleProject,projectForDelete,setSharing} from "../db/queries/sharing";
import {createShareCapability,hashShareToken} from "../auth/share";
import {purgeProject} from "../ops/purge";
import {operationsStatus,applyErrorKillSwitch} from "../db/queries/operations";
export interface ApiDependencies {
  store:StateStore;blobs:SignedBlobs;processingEnabled:boolean;adminToken?:string;cronSecret?:string;
  dispatcher:()=>Promise<Dispatcher>;defer:(work:()=>Promise<void>)=>void;
}
export type Action="createProject"|"getProject"|"mediaInit"|"mediaFinalize"|"mediaUrl"|"transcripts"|"sourceCheck"|"startJob"|"getJob"|"retryJob"|"cancelJob"|"track"|"manifest"|"cron"|"telemetry"|"adminStatus"|"killSwitch"|"share"|"deleteProject";
const uuid=z.uuid(),idx=z.coerce.number().int().min(0).max(19),keySchema=z.string().min(8).max(120).regex(/^[A-Za-z0-9_.:-]+$/u);
const edit=z.strictObject({segmentIdx:z.number().int().min(0).max(19),text:z.string().min(1).max(65536).optional(),startMs:z.number().int().min(0).max(89999).optional(),endMs:z.number().int().min(1).max(90000).optional()});
const transcriptInput=z.union([
  z.strictObject({format:z.enum(["srt","vtt","pasted"]),text:z.string().min(1).max(65536),baseVersionId:uuid.optional()}),
  z.strictObject({baseVersionId:uuid,edits:z.array(edit).min(1).max(20)}),
  z.strictObject({baseVersionId:uuid,merge:z.tuple([z.number().int().nonnegative(),z.number().int().nonnegative()])}),
  z.strictObject({baseVersionId:uuid,split:z.strictObject({segmentIdx:z.number().int().min(0).max(19),atCueIdx:z.number().int().min(1).max(299)})}),
]);
const statuses:Record<string,number>={not_found:404,version_conflict:409,idempotency_conflict:409,retry_conflict:409,spend_cap:402,owner_quota:429,rate_limited:429,storage_cap:507,media_limits:422,segment_limit:422,reservation_expired:409,media_unavailable:410,transfer_cap:503,processing_disabled:503,forbidden_origin:403,unauthorized:401};
function json(value:unknown,status=200,headers:HeadersInit={}){const merged=new Headers(headers);if(!merged.has("Cache-Control"))merged.set("Cache-Control","no-store");return Response.json(value,{status,headers:merged});}
function ownerToken(r:Request){const text=r.headers.get("cookie")??"";return text.split(";").map(s=>s.trim()).find(s=>s.startsWith(`${OWNER_COOKIE_NAME}=`))?.slice(OWNER_COOKIE_NAME.length+1)??null;}
function bearer(r:Request,expected?:string){if(!expected)return false;const actual=Buffer.from(r.headers.get("authorization")??""),target=Buffer.from(`Bearer ${expected}`);return actual.length===target.length&&timingSafeEqual(actual,target);}
async function body(r:Request){const reader=r.body?.getReader();if(!reader)throw new StateError("invalid_json");let size=0;const chunks:Uint8Array[]=[];
  for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>262144){await reader.cancel();throw new StateError("request_too_large");}chunks.push(item.value);}try{return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;}catch{throw new StateError("invalid_json");}}
export function makeApi(d:ApiDependencies){return async function handle(r:Request,action:Action,params:Record<string,string>={}){
  let projectId:string|undefined;
  try{
    const mutation=!["GET","HEAD"].includes(r.method);
    if(mutation&&r.headers.get("origin")!==requestOrigin(r))throw new StateError("forbidden_origin");
    const isAdmin=["adminStatus","killSwitch"].includes(action),isCron=action==="cron";
    if(isAdmin&&!bearer(r,d.adminToken)||isCron&&!bearer(r,d.cronSecret))throw new StateError("unauthorized");
    let ownerId:string|null=null;const token=ownerToken(r);if(token){try{ownerId=await q.ownerForToken(d.store,hashOwnerToken(token));}catch{/* An invalid capability never authorizes access. */}}
    let shareHash:Buffer|null=null;try{const share=new URL(r.url).searchParams.get("s");if(share)shareHash=hashShareToken(share);}catch{/* Invalid share tokens grant no access. */}
    if(mutation){const ip=process.env.VERCEL?r.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown":"local",scope=action==="telemetry"?"render":"mutation";await q.consumeRate(d.store,[`${scope}:ip:${sha256(ip)}`,...(ownerId?[`${scope}:owner:${ownerId}`]:[])],action==="telemetry"?60:120);}
    if(params.projectId)projectId=uuid.parse(params.projectId);
    if(params.jobId)projectId=await q.jobProjectId(d.store,uuid.parse(params.jobId))??undefined;
    let track:Awaited<ReturnType<typeof q.trackRow>>|null=null;
    if(action==="manifest"){track=await q.trackRow(d.store,uuid.parse(params.trackId));projectId=track?.project_id;}
    if(action==="telemetry"){
      const input=z.strictObject({trackVersionId:uuid,segmentIdx:z.number().int().min(0).max(19),kind:z.enum(["played_complete","played_incomplete","renderer_error","renderer_timeout","stale_message_dropped","retry","skip","skipped","engine_load_failed"]),detail:z.record(z.string().max(40),z.union([z.string().max(200),z.number().finite(),z.boolean(),z.null()])),uaClass:z.string().max(60)}).parse(await body(r));
      track=await q.trackRow(d.store,input.trackVersionId);if(!track)throw new StateError("not_found");await accessibleProject(d.store,track.project_id,ownerId,shareHash);if(!track.manifest.segments.some(s=>s.idx===input.segmentIdx))throw new StateError("not_found");
      await q.recordRenderEvent(d.store,input);return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
    }
    const sharedRead=["getProject","track","manifest","mediaUrl"].includes(action);
    const p=projectId?(action==="deleteProject"?await projectForDelete(d.store,projectId,ownerId):sharedRead?await accessibleProject(d.store,projectId,ownerId,shareHash):await q.ownedProject(d.store,projectId,ownerId)):null;
    if(!p&&!["createProject","cron","adminStatus","killSwitch"].includes(action))throw new StateError("not_found");
    const requireKey=()=>keySchema.parse(r.headers.get("idempotency-key"));
    const canProcess=async()=>{await applyErrorKillSwitch(d.store);if(!await q.processingAllowed(d.store,d.processingEnabled))throw new StateError("processing_disabled");const signal=await budgetSignal(d.store);if(signal.closed)throw new StateError("spend_cap");};
    const dispatch=(jobId:string)=>d.defer(async()=>{try{await (await d.dispatcher()).dispatch(jobId);}catch(error){await recordDispatchFailure(d.store,jobId);console.error(JSON.stringify({code:"dispatch_interrupted",jobId,error:error instanceof StateError?error.code:"internal"}));}});
    if(action==="createProject"){
      const input=z.strictObject({title:z.string().trim().min(1).max(120),rightsAttested:z.literal(true)}).parse(await body(r)),key=requireKey();
      const capability=ownerId?null:createOwnerCapability();ownerId??=await q.ensureOwner(d.store,capability!.tokenHash);
      return json(await q.createProject(d.store,ownerId,input.title,key),201,capability?{"Set-Cookie":ownerCookieHeader(capability.token)}:{});
    }
    if(action==="getProject")return json(await q.projectDetails(d.store,p!,p!.owner_id===ownerId));
    if(action==="share"){const {enable}=z.strictObject({enable:z.boolean()}).parse(await body(r)),cap=enable?createShareCapability():null;await setSharing(d.store,p!.id,cap?.tokenHash??null);return json({shareUrl:cap?`${requestOrigin(r)}/s/${p!.id}?s=${encodeURIComponent(cap.token)}`:null});}
    if(action==="deleteProject"){await deleteProject(d.store,p!.id);d.defer(async()=>{await purgeProject(d.store,d.blobs,p!.id);});return json({status:"deleting"},202);}
    if(action==="mediaInit"){
      const input=z.strictObject({contentType:z.enum(["video/mp4","video/webm"]),sizeBytes:z.number().int().positive().max(15_728_640),sha256:z.string().regex(/^[a-f0-9]{64}$/u),durationMs:z.number().int().positive().max(90000),width:z.number().int().positive().max(8192),height:z.number().int().positive().max(8192)}).parse(await body(r));
      const media=await initMedia(d.store,d.blobs,{projectId:p!.id,declaredBytes:input.sizeBytes,contentType:input.contentType,clientSha256:input.sha256,clientDurationMs:input.durationMs});
      return json({mediaId:media.id,uploadUrl:await d.blobs.sign(media.pathname,"put",media.tokenExpiresAt,{contentType:input.contentType,maximumSizeInBytes:input.sizeBytes}),method:"PUT",expiresAt:media.tokenExpiresAt.toISOString()});
    }
    if(action==="mediaFinalize"){
      const input=z.strictObject({mediaId:uuid}).parse(await body(r)),row=await q.mediaRow(d.store,input.mediaId,p!.id);if(!row)throw new StateError("not_found");
      let head;try{head=await d.blobs.head(row.blob_pathname);}catch{throw new StateError("not_uploaded");}
      const result=await finalizeMedia(d.store,row.id,{size:head.size,contentType:head.contentType??"application/octet-stream"});
      if(result.status==="rejected"){await d.blobs.remove(row.blob_pathname);return json({error:{code:"media_mismatch",message:"Uploaded size or type does not match",retryable:false}},422);}return json({media:await q.mediaRow(d.store,row.id,p!.id)});
    }
    if(action==="transcripts"){
      const input=transcriptInput.parse(await body(r)),key=requireKey(),base="baseVersionId" in input?input.baseVersionId??null:null;
      const replay=await q.transcriptRequestExists(d.store,p!.id,key);
      if(base!==p!.current_transcript_version_id&&!replay)throw new StateError("version_conflict");
      if(base&&(await q.transcript(d.store,base))?.project_id!==p!.id)throw new StateError("version_conflict");
      let cues,layout,source:"srt"|"vtt"|"pasted"="pasted";
      if("format" in input){source=input.format;cues=source==="pasted"?parsePasted(input.text,(await q.readyMedia(d.store,p!.id))?.client_duration_ms??90000):({srt:parseSrt,vtt:parseVtt}[source])(input.text);}
      else{const tv=await q.transcript(d.store,input.baseVersionId);if(!tv)throw new StateError("version_conflict");try{({cues,layout}=editTranscript(tv.cues,await q.transcriptSegments(d.store,tv.id),input));}catch{throw new StateError("invalid_edit");}}
      const autoStart=Boolean(p!.current_track_version_id||p!.active_job_id);if(autoStart&&!replay)await canProcess();
      const before=base?await q.transcriptSegments(d.store,base):[];
      const version=await submitTranscriptVersion(d.store,{projectId:p!.id,baseVersionId:base,idempotencyKey:key,cues,layout,source,autoStart});
      const segments=await q.transcriptSegments(d.store,version.transcriptVersionId),oldKeys=new Set(before.map(s=>s.segmentKey));
      if(version.id)dispatch(version.id);
      return json({transcriptVersion:await q.transcript(d.store,version.transcriptVersionId),segments,staleSegments:segments.filter(s=>!oldKeys.has(s.segmentKey)).map(s=>s.idx),jobId:version.id||null},201);
    }
    if(action==="sourceCheck"){const input=z.strictObject({transcriptVersionId:uuid,state:z.enum(["creator_confirmed","unconfirmed"])}).parse(await body(r));await q.setSourceCheck(d.store,p!.id,input.transcriptVersionId,idx.parse(params.idx),input.state);return json({state:input.state});}
    if(action==="startJob"||action==="retryJob"){
      const key=requireKey();if(!await q.jobRequestExists(d.store,p!.id,key))await canProcess();const result=action==="startJob"?await startJob(d.store,{projectId:p!.id,transcriptVersionId:z.strictObject({transcriptVersionId:uuid}).parse(await body(r)).transcriptVersionId,idempotencyKey:key}):await retryJob(d.store,{jobId:params.jobId,idempotencyKey:key});
      // The output-only lower bound already exceeds a one-cent budget. Full request bounds are reserved before every call.
      const {jobCanFitMinimum}=await import("../db/queries/admission");if(!await jobCanFitMinimum(d.store,result.id)){await failJob(d.store,result.id,"spend_cap");throw new StateError("spend_cap");}
      dispatch(result.id);return json({jobId:result.id},202);
    }
    if(action==="getJob"){
      d.defer(async()=>{await reconcile(d.store,d.blobs,await d.dispatcher(),{projectId:p!.id});});
      const progress=await q.jobProgress(d.store,params.jobId),etag=`"${hash(progress)}"`;return r.headers.get("if-none-match")===etag?new Response(null,{status:304,headers:{ETag:etag,"Cache-Control":"private, no-cache",Vary:"Cookie"}}):json(progress,200,{ETag:etag,"Cache-Control":"private, no-cache",Vary:"Cookie"});
    }
    if(action==="cancelJob"){await cancelJob(d.store,params.jobId);return json({status:(await q.jobProgress(d.store,params.jobId)).status});}
    if(action==="manifest"){
      if(!track)throw new StateError("not_found");const headers={ETag:`"${track.manifest_hash}"`,"Cache-Control":"private, no-cache",Vary:"Cookie"};return r.headers.get("if-none-match")===headers.ETag?new Response(null,{status:304,headers}):json(track.manifest,200,headers);
    }
    if(action==="track"||action==="mediaUrl"){
      const saved=action==="track"&&p!.current_track_version_id?await q.trackRow(d.store,p!.current_track_version_id):null;if(action==="track"&&!saved)throw new StateError("not_found");
      const media=await q.readyMedia(d.store,p!.id,saved?.manifest.media.contentSha256);let state:"available"|"expired"|"missing"=media?"available":await q.expiredMediaExists(d.store,p!.id,saved?.manifest.media.contentSha256)?"expired":"missing",mediaUrl:string|null=null,expiresAt:string|null=null,reason:"transfer_cap"|"storage_unavailable"|null=null;
      if(media){if(!media.pinned&&new Date(media.expires_at)<=new Date())state="expired";else{try{await admitTransfer(d.store,media.id);expiresAt=new Date(Date.now()+900000).toISOString();mediaUrl=await d.blobs.sign(media.blob_pathname,"get",new Date(expiresAt));}catch(error){if(action==="mediaUrl")throw error;state="missing";expiresAt=null;reason=error instanceof StateError&&error.code==="transfer_cap"?"transfer_cap":"storage_unavailable";}}}
      if(action==="mediaUrl"){if(!mediaUrl)throw new StateError("media_unavailable");return json({url:mediaUrl,expiresAt});}
      return json({trackVersionId:saved!.id,manifestHash:saved!.manifest_hash,overlays:await q.trackOverlays(d.store,saved!.transcript_version_id),media:{state,url:mediaUrl,expiresAt,reason}});
    }
    if(action==="cron")return json(await reconcile(d.store,d.blobs,await d.dispatcher(),{opportunistic:false}));
    if(action==="killSwitch"){const input=z.strictObject({processing:z.boolean()}).parse(await body(r));await q.setProcessing(d.store,input.processing);return json({processing:await q.processingAllowed(d.store,d.processingEnabled)});}
    if(action==="adminStatus")return json({processing:await q.processingAllowed(d.store,d.processingEnabled),...await operationsStatus(d.store)});
    throw new StateError("not_found");
  }catch(error){
    if(error instanceof ZodError)return json({error:{code:"validation",message:"Request does not match the required shape",retryable:false}},400);
    if(error instanceof CaptionError)return json({error:{code:error.code,message:error.message,retryable:false}},400);
    if(error instanceof StateError){const headers:Record<string,string>={};let currentVersionId:string|null=null;
      if(error.code==="version_conflict"&&projectId){try{currentVersionId=(await q.ownedProject(d.store,projectId,await ownerIdForRequest(d.store,r))).current_transcript_version_id;}catch{}}
      return json({error:{code:error.code,message:error.code.replaceAll("_"," "),retryable:["spend_cap","storage_cap","transfer_cap","not_uploaded","processing_disabled"].includes(error.code)},...(currentVersionId?{currentVersionId}:{})},statuses[error.code]??(error.code==="not_uploaded"?409:400),headers);
    }
    console.error(JSON.stringify({code:"api_internal",action}));return json({error:{code:"internal",message:"Request could not be completed",retryable:true}},500);
  }
};}
async function ownerIdForRequest(store:StateStore,r:Request){try{const token=ownerToken(r);return token?await q.ownerForToken(store,hashOwnerToken(token)):null;}catch{return null;}}
