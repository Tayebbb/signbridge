import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
import {lockProject,StateError} from "./common";
import {ledgerLocked} from "./storage";
export async function deletingProjects(store:StateStore,limit=5,projectId?:string,afterId?:string) {return store.query<{id:string}>(sql`SELECT id FROM projects WHERE status='deleting' ${projectId?sql`AND id=${projectId}`:sql``} ${afterId?sql`AND id>${afterId}`:sql``} ORDER BY id LIMIT ${limit}`);}
export async function purgeSnapshot(store:StateStore,projectId:string,now:Date) {return store.transaction(async q=>{const p=await lockProject(q,projectId);if(p?.status!=="deleting")return null;
  const issued=await q.query(sql`SELECT id FROM media WHERE project_id=${projectId} AND reservation_expires_at>${now} UNION ALL SELECT a.id FROM visual_anchors a JOIN anchor_storage s ON s.anchor_id=a.id WHERE a.project_id=${projectId} AND s.reservation_expires_at>${now}`);
  return issued.length?null:{projectId:p.id,epoch:BigInt(p.processing_epoch)};});}
export async function finalizePurge(store:StateStore,projectId:string,epoch:bigint,now=new Date()) {
  return store.transaction(async q=>{const p=await lockProject(q,projectId);if(!p)return false;if(p.status!=="deleting"||BigInt(p.processing_epoch)!==epoch)throw new StateError("purge_fenced");
    const refs=await q.query<{cache_key:string}>(sql`SELECT s.cache_key FROM stage_results s JOIN stage_result_refs r ON r.cache_key=s.cache_key WHERE r.project_id=${projectId} ORDER BY s.cache_key FOR UPDATE OF s`);
    for(const ref of refs)await q.query(sql`DELETE FROM stage_results s WHERE s.cache_key=${ref.cache_key} AND NOT EXISTS (SELECT 1 FROM stage_result_refs r WHERE r.cache_key=s.cache_key AND r.project_id<>${projectId})`);
    const [media]=await q.query<{pending:string;committed:string}>(sql`SELECT coalesce(sum(CASE WHEN storage_charge='pending' THEN declared_bytes ELSE 0 END),0)::text AS pending,coalesce(sum(CASE WHEN storage_charge='committed' THEN size_bytes ELSE 0 END),0)::text AS committed FROM media WHERE project_id=${projectId}`);
    const [anchors]=await q.query<{pending:string;committed:string}>(sql`SELECT coalesce(sum(CASE WHEN s.size_bytes IS NULL THEN s.declared_bytes ELSE 0 END),0)::text AS pending,coalesce(sum(s.size_bytes),0)::text AS committed FROM anchor_storage s JOIN visual_anchors a ON a.id=s.anchor_id WHERE a.project_id=${projectId}`);
    await ledgerLocked(q,now);await q.query(sql`UPDATE storage_ledger SET pending_bytes=pending_bytes-${(BigInt(media.pending)+BigInt(anchors.pending)).toString()},committed_bytes=committed_bytes-${(BigInt(media.committed)+BigInt(anchors.committed)).toString()} WHERE id=1`);
    await q.query(sql`DELETE FROM projects WHERE id=${projectId}`);return true;});
}
export async function sweepOrphanStages(store:StateStore,now=new Date(),limit=5) {
  return store.transaction(async q=>{const rows=await q.query<{cache_key:string}>(sql`SELECT s.cache_key FROM stage_results s WHERE s.created_at<${new Date(now.getTime()-30*86_400_000)} AND NOT EXISTS(SELECT 1 FROM stage_result_refs r WHERE r.cache_key=s.cache_key) ORDER BY s.cache_key FOR UPDATE SKIP LOCKED LIMIT ${limit}`);let removed=0;
    for(const row of rows)removed+=(await q.query(sql`DELETE FROM stage_results s WHERE s.cache_key=${row.cache_key} AND NOT EXISTS(SELECT 1 FROM stage_result_refs r WHERE r.cache_key=s.cache_key) RETURNING cache_key`)).length;return removed;});
}
export async function visibleProject(store:StateStore,id:string) {return (await store.query(sql`SELECT * FROM projects WHERE id=${id} AND status='active'`))[0]??null;}
export async function visibleTrack(store:StateStore,id:string) {return (await store.query(sql`SELECT t.* FROM track_versions t JOIN projects p ON p.id=t.project_id WHERE t.id=${id} AND p.status='active'`))[0]??null;}
export async function visibleMedia(store:StateStore,id:string) {return (await store.query(sql`SELECT m.* FROM media m JOIN projects p ON p.id=m.project_id WHERE m.id=${id} AND p.status='active'`))[0]??null;}
