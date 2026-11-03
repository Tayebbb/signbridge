import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
import {lockProject,StateError} from "./common";
import type {PlaybackManifest} from "../../contracts/manifest";
/** Deployment content only: pin a genuinely model-processed, current saved demo. */
export async function pinDemo(store:StateStore,input:{projectId:string;ownerId:string;sha256:string;expectUnsupported:boolean}){
  return store.transaction(async q=>{
    const p=await lockProject(q,input.projectId,true);if(!p||p.owner_id!==input.ownerId||!p.current_track_version_id)throw new StateError("demo_not_ready");
    const [track]=await q.query<{id:string;transcript_version_id:string;manifest:PlaybackManifest;manifest_hash:string;technical_status:string}>(sql`SELECT * FROM track_versions WHERE id=${p.current_track_version_id}`);
    if(!track||track.transcript_version_id!==p.current_transcript_version_id||track.manifest.media.contentSha256!==input.sha256)throw new StateError("demo_binding_mismatch");
    if(!track.manifest.provenance.modelProfile.startsWith("gpt-"))throw new StateError("demo_requires_real_model");
    const gaps=track.manifest.segments.some(s=>s.technicalStatus==="partial_blocked"||s.technicalStatus==="no_signing");
    if(input.expectUnsupported?!gaps:track.manifest.segments.some(s=>s.technicalStatus!=="ready"))throw new StateError("demo_coverage_mismatch");
    const rows=await q.query<{id:string}>(sql`UPDATE media SET pinned=true WHERE project_id=${p.id} AND status='ready' AND client_sha256=${input.sha256} RETURNING id`);
    if(!rows.length)throw new StateError("media_unavailable");
    return {projectId:p.id,trackVersionId:track.id,manifestHash:track.manifest_hash,technicalStatus:track.technical_status,pinnedMedia:rows.length};
  });
}
export async function demoBudgetSnapshot(store:StateStore){return store.query<{scope:string;cap_micros:string;spent_micros:string;reserved_micros:string}>(sql`SELECT scope,cap_micros,spent_micros,reserved_micros FROM spend_budgets ORDER BY scope`);}
