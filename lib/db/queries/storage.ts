import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import type {StateStore,SqlSession} from "../session";
import {lockProject,StateError} from "./common";
import {STORAGE_CAP,TRANSFER_CAP,ANCHOR_BOUND,dayScope} from "../../domain/limits";
interface Ledger {committed_bytes:string;pending_bytes:string;cap_bytes:string;est_transfer_bytes:string;transfer_cap_bytes:string;transfer_month:string}
export async function ledgerLocked(q:SqlSession,now:Date) {
  const month=dayScope(now).slice(4,11);
  await q.query(sql`INSERT INTO storage_ledger(id,cap_bytes,transfer_cap_bytes,transfer_month) VALUES (1,${STORAGE_CAP.toString()},${TRANSFER_CAP.toString()},${month}) ON CONFLICT DO NOTHING`);
  const row=(await q.query<Ledger>(sql`SELECT * FROM storage_ledger WHERE id=1 FOR UPDATE`))[0];
  if(row.transfer_month>month)throw new StateError("clock_regressed");
  if(row.transfer_month<month){await q.query(sql`UPDATE storage_ledger SET transfer_month=${month},est_transfer_bytes=0 WHERE id=1`);row.transfer_month=month;row.est_transfer_bytes="0";}
  return row;
}
async function allocate(q:SqlSession,bytes:number,now:Date) {await ledgerLocked(q,now);const rows=await q.query(sql`UPDATE storage_ledger SET pending_bytes=pending_bytes+${bytes} WHERE id=1 AND committed_bytes+pending_bytes+${bytes}<=cap_bytes RETURNING id`);if(!rows.length)throw new StateError("storage_cap");}
export interface MediaInit {projectId:string;declaredBytes:number;contentType:"video/mp4"|"video/webm";clientSha256:string;clientDurationMs:number;pinned?:boolean}
export async function reserveMedia(store:StateStore,input:MediaInit,now=new Date()) {
  if(!Number.isInteger(input.declaredBytes)||input.declaredBytes<1||input.declaredBytes>15728640||!["video/mp4","video/webm"].includes(input.contentType)||!Number.isInteger(input.clientDurationMs)||input.clientDurationMs<=0||input.clientDurationMs>90000||!/^[a-f0-9]{64}$/u.test(input.clientSha256))throw new StateError("media_limits");
  return store.transaction(async q=>{await lockProject(q,input.projectId,true);await allocate(q,input.declaredBytes,now);
    await q.query(sql`UPDATE media SET status='rejected' WHERE project_id=${input.projectId} AND status='pending_upload'`);
    const id=randomUUID(),pathname=`v/${input.projectId}/${id}.${input.contentType==="video/mp4"?"mp4":"webm"}`;
    await q.query(sql`INSERT INTO media(id,project_id,blob_pathname,content_type,declared_bytes,client_sha256,client_duration_ms,reservation_expires_at,expires_at,pinned,created_at) VALUES (${id},${input.projectId},${pathname},${input.contentType},${input.declaredBytes},${input.clientSha256},${input.clientDurationMs},${new Date(now.getTime()+900_000)},${new Date(now.getTime()+259_200_000)},${input.pinned??false},${now})`);
    return {id,pathname,maximumSizeInBytes:input.declaredBytes,tokenExpiresAt:new Date(now.getTime()+600_000)};});
}
interface MediaRow {id:string;project_id:string;blob_pathname:string;content_type:string;declared_bytes:number;size_bytes:number|null;status:string;storage_charge:string;pinned:boolean;reservation_expires_at:Date|string;expires_at:Date|string}
export async function finalizeMedia(store:StateStore,id:string,head:{size:number;contentType:string},now=new Date()) {
  const ref=(await store.query<{project_id:string}>(sql`SELECT project_id FROM media WHERE id=${id}`))[0];if(!ref)throw new StateError("not_found");
  return store.transaction(async q=>{await lockProject(q,ref.project_id,true);const row=(await q.query<MediaRow>(sql`SELECT * FROM media WHERE id=${id} FOR UPDATE`))[0];if(!row)throw new StateError("not_found");
    if(row.status==="ready")return {status:"ready" as const,size:row.size_bytes!};
    if(row.status!=="pending_upload"||new Date(row.reservation_expires_at)<=now)throw new StateError("reservation_expired");
    if(!Number.isInteger(head.size)||head.size<1||head.size>row.declared_bytes||head.contentType!==row.content_type){await q.query(sql`UPDATE media SET status='rejected' WHERE id=${id}`);return {status:"rejected" as const,pathname:row.blob_pathname};}
    await ledgerLocked(q,now);await q.query(sql`UPDATE storage_ledger SET pending_bytes=pending_bytes-${row.declared_bytes},committed_bytes=committed_bytes+${head.size} WHERE id=1`);
    await q.query(sql`UPDATE media SET size_bytes=${head.size},status='ready',storage_charge='committed' WHERE id=${id}`);return {status:"ready" as const,size:head.size};});
}
export async function admitTransfer(store:StateStore,mediaId:string,now=new Date()) {
  return store.transaction(async q=>{const ref=(await q.query<{project_id:string}>(sql`SELECT project_id FROM media WHERE id=${mediaId}`))[0];if(!ref)throw new StateError("not_found");await lockProject(q,ref.project_id,true);
    const row=(await q.query<MediaRow>(sql`SELECT * FROM media WHERE id=${mediaId} FOR UPDATE`))[0];if(!row||row.status!=="ready"||!row.pinned&&new Date(row.expires_at)<=now)throw new StateError("media_unavailable");
    await ledgerLocked(q,now);const updated=await q.query(sql`UPDATE storage_ledger SET est_transfer_bytes=est_transfer_bytes+${row.size_bytes} WHERE id=1 AND est_transfer_bytes+${row.size_bytes}<=transfer_cap_bytes RETURNING id`);if(!updated.length)throw new StateError("transfer_cap");
    return {pathname:row.blob_pathname,size:row.size_bytes!};});
}
export async function transferClosed(store:StateStore,size:number){const [ledger]=await store.query<{closed:boolean}>(sql`SELECT est_transfer_bytes+${size}>transfer_cap_bytes AND transfer_month=to_char(now() AT TIME ZONE 'Asia/Dhaka','YYYY-MM') AS closed FROM storage_ledger WHERE id=1`);return ledger?.closed??false;}
export async function reserveAnchor(store:StateStore,input:{projectId:string;declaredBytes:number;frameMs:number;segmentStartMs:number;segmentEndMs:number;mediaSha256:string;labelBn:string|null},now=new Date()) {
  if(!Number.isInteger(input.declaredBytes)||input.declaredBytes<1||BigInt(input.declaredBytes)>ANCHOR_BOUND)throw new StateError("anchor_limits");
  return store.transaction(async q=>{await lockProject(q,input.projectId,true);const [count]=await q.query<{n:number}>(sql`SELECT count(*)::int AS n FROM visual_anchors WHERE project_id=${input.projectId}`);if(count.n>=3)throw new StateError("anchor_limits");await allocate(q,input.declaredBytes,now);
    const id=randomUUID(),pathname=`a/${input.projectId}/${id}.jpg`;
    await q.query(sql`INSERT INTO visual_anchors(id,project_id,media_content_sha256,frame_ms,image_pathname,label_bn,segment_start_ms,segment_end_ms,created_at) VALUES (${id},${input.projectId},${input.mediaSha256},${input.frameMs},${pathname},${input.labelBn},${input.segmentStartMs},${input.segmentEndMs},${now})`);
    await q.query(sql`INSERT INTO anchor_storage(anchor_id,declared_bytes,reservation_expires_at) VALUES (${id},${input.declaredBytes},${new Date(now.getTime()+900_000)})`);return {id,pathname,maximumSizeInBytes:input.declaredBytes};});
}
export async function finalizeAnchor(store:StateStore,id:string,head:{size:number;contentType:string},now=new Date()) {
  const ref=(await store.query<{project_id:string}>(sql`SELECT project_id FROM visual_anchors WHERE id=${id}`))[0];if(!ref)throw new StateError("not_found");
  return store.transaction(async q=>{await lockProject(q,ref.project_id,true);const row=(await q.query<{declared_bytes:number;size_bytes:number|null;state:string;reservation_expires_at:Date|string}>(sql`SELECT * FROM anchor_storage WHERE anchor_id=${id} FOR UPDATE`))[0];if(!row)throw new StateError("not_found");if(row.state==="ready")return true;
    if(row.state!=="pending_upload"||new Date(row.reservation_expires_at)<=now)throw new StateError("reservation_expired");
    if(!Number.isInteger(head.size)||head.size<1||head.size>row.declared_bytes||head.contentType!=="image/jpeg"){await q.query(sql`UPDATE anchor_storage SET state='deleting' WHERE anchor_id=${id}`);return false;}
    await ledgerLocked(q,now);await q.query(sql`UPDATE storage_ledger SET pending_bytes=pending_bytes-${row.declared_bytes},committed_bytes=committed_bytes+${head.size} WHERE id=1`);await q.query(sql`UPDATE anchor_storage SET size_bytes=${head.size},state='ready' WHERE anchor_id=${id}`);return true;});
}
export interface CleanupItem {id:string;projectId:string;pathname:string;kind:"media"|"anchor"}
export async function storageCleanupCandidates(store:StateStore,now:Date,limit=5,projectId?:string) {
  return store.query<CleanupItem>(sql`SELECT * FROM (
    SELECT m.id,m.project_id AS "projectId",m.blob_pathname AS pathname,'media' AS kind FROM media m JOIN projects p ON p.id=m.project_id WHERE p.status='active' AND m.storage_charge<>'released' AND ((m.status='pending_upload' AND m.reservation_expires_at<=${now}) OR (m.status='ready' AND NOT m.pinned AND m.expires_at<=${now}) OR m.status='expired' OR m.status='rejected' AND m.reservation_expires_at<=${now}) ${projectId?sql`AND m.project_id=${projectId}`:sql``}
    UNION ALL SELECT a.id,a.project_id AS "projectId",a.image_pathname AS pathname,'anchor' AS kind FROM visual_anchors a JOIN anchor_storage s ON s.anchor_id=a.id JOIN projects p ON p.id=a.project_id WHERE p.status='active' AND s.state IN ('deleting','pending_upload') AND s.reservation_expires_at<=${now} ${projectId?sql`AND a.project_id=${projectId}`:sql``}
  ) items ORDER BY id LIMIT ${limit}`);
}
export async function markStorageCleanup(store:StateStore,item:CleanupItem,now:Date) {
  return store.transaction(async q=>{const p=await lockProject(q,item.projectId);if(!p||p.status!=="active")return false;
    const rows=item.kind==="media"?await q.query(sql`UPDATE media SET status=CASE WHEN status='rejected' THEN status ELSE 'expired'::media_status END WHERE id=${item.id} AND storage_charge<>'released' AND ((status='pending_upload' AND reservation_expires_at<=${now}) OR (status='ready' AND NOT pinned AND expires_at<=${now}) OR status='expired' OR status='rejected' AND reservation_expires_at<=${now}) RETURNING id`):await q.query(sql`UPDATE anchor_storage SET state='deleting' WHERE anchor_id=${item.id} AND state IN ('deleting','pending_upload') AND reservation_expires_at<=${now} RETURNING anchor_id`);return rows.length===1;});
}
export async function releaseStorage(store:StateStore,item:CleanupItem,now:Date) {
  return store.transaction(async q=>{const p=await lockProject(q,item.projectId);if(!p||p.status!=="active")return false;let pending=0,committed=0;
    if(item.kind==="media"){const row=(await q.query<MediaRow>(sql`SELECT * FROM media WHERE id=${item.id} AND status IN ('expired','rejected') FOR UPDATE`))[0];if(!row||row.storage_charge==="released")return false;pending=row.storage_charge==="pending"?row.declared_bytes:0;committed=row.storage_charge==="committed"?row.size_bytes!:0;await q.query(sql`UPDATE media SET storage_charge='released' WHERE id=${item.id}`);}
    else {const row=(await q.query<{declared_bytes:number;size_bytes:number|null}>(sql`SELECT * FROM anchor_storage WHERE anchor_id=${item.id} AND state='deleting' FOR UPDATE`))[0];if(!row)return false;pending=row.size_bytes===null?row.declared_bytes:0;committed=row.size_bytes??0;await q.query(sql`DELETE FROM visual_anchors WHERE id=${item.id}`);}
    await ledgerLocked(q,now);await q.query(sql`UPDATE storage_ledger SET pending_bytes=pending_bytes-${pending},committed_bytes=committed_bytes-${committed} WHERE id=1`);return true;});
}
