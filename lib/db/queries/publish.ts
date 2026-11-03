import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
import {lockJob,hasAuthority,validProof,StateError,type RunProof} from "./common";
import {playbackManifestSchema,type PlaybackManifest} from "../../contracts/manifest";
import {manifestHash,trackFingerprint,trackIdFor} from "../../domain/fingerprints";
import {deriveTrackStatus} from "../../domain/manifest";
export async function publishTrack(store:StateStore,jobId:string,proof:RunProof,input:PlaybackManifest,now=new Date()) {
  const manifest=playbackManifestSchema.parse(input),fingerprint=trackFingerprint(manifest);
  return store.transaction(async q=>{
    const locked=await lockJob(q,jobId);if(!locked)return {status:"fenced" as const};const {project,job}=locked;
    if(["succeeded","partial"].includes(job.status)&&job.result_track_version_id)return {status:"published" as const,trackVersionId:job.result_track_version_id};
    if(!hasAuthority(project,job)||job.status!=="running"||!validProof(job,proof,now)) {
      if(!hasAuthority(project,job))await q.query(sql`UPDATE jobs SET status=CASE WHEN status IN ('queued','running') THEN 'superseded'::job_status ELSE status END,finished_at=coalesce(finished_at,${now}) WHERE id=${jobId}`);
      return {status:"fenced" as const};
    }
    if(manifest.projectId!==project.id||manifest.transcriptVersion.id!==job.transcript_version_id||manifest.trackVersionId!==trackIdFor(jobId,fingerprint))throw new StateError("manifest_binding");
    const technical=deriveTrackStatus(manifest.segments);
    await q.query(sql`INSERT INTO track_versions(id,project_id,transcript_version_id,media_content_sha256,track_fingerprint,manifest,manifest_hash,technical_status,created_by_job_id,created_at) VALUES (${manifest.trackVersionId},${project.id},${job.transcript_version_id},${manifest.media.contentSha256},${fingerprint},${JSON.stringify(manifest)}::jsonb,${manifestHash(manifest)},${technical},${jobId},${now}) ON CONFLICT(project_id,track_fingerprint) DO NOTHING`);
    const row=(await q.query<{id:string}>(sql`SELECT id FROM track_versions WHERE project_id=${project.id} AND track_fingerprint=${fingerprint}`))[0];
    await q.query(sql`UPDATE projects SET current_track_version_id=${row.id},active_job_id=NULL WHERE id=${project.id}`);
    await q.query(sql`UPDATE jobs SET status=${technical==="complete"?"succeeded":"partial"},result_track_version_id=${row.id},finished_at=${now},updated_at=${now} WHERE id=${jobId}`);
    const progress=manifest.segments.map(s=>({idx:s.idx,stage:"published",state:s.technicalStatus==="ready"?"ok":s.technicalStatus==="failed"?"failed":"partial_blocked",errorCode:s.technicalStatus==="failed"?"stage_failed":null}));
    await q.query(sql`UPDATE jobs SET progress=jsonb_set(progress,'{segments}',${JSON.stringify(progress)}::jsonb) WHERE id=${jobId}`);
    return {status:"published" as const,trackVersionId:row.id};
  });
}
