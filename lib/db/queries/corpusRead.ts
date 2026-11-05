import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
import type {SignAsset, SignAssetMetadata} from "../../domain/retrieval";

const metadataColumns=sql`a.id,a.kind,a.label_bn AS "labelBn",a.label_phrase_form AS "labelPhraseForm",a.derived_sha256 AS "derivedSha256",a.unit_count AS "unitCount",a.eligible,coalesce((a.render_evidence->>'frames')::float*40,a.unit_count*3000) AS "estimatedDurationMs",coalesce(array_agg(x.alias_norm ORDER BY x.alias_norm) FILTER(WHERE x.alias_norm IS NOT NULL),'{}') AS aliases`;

/** Planning needs labels, provenance hashes and bounds, never motion XML. */
export function eligibleAssetMetadata(store:StateStore):Promise<SignAssetMetadata[]>{
  return store.query<SignAssetMetadata>(sql`SELECT ${metadataColumns} FROM sign_assets a LEFT JOIN asset_aliases x ON x.asset_id=a.id WHERE a.eligible=true AND a.render_state='rendered_ok' GROUP BY a.id ORDER BY a.id`);
}

/** Hydrate only selected assets at publication. Unspecified IDs retain the offline inspection API. */
export function eligibleAssets(store:StateStore, selectedIds?:readonly string[]):Promise<SignAsset[]>{
  const ids=selectedIds===undefined?undefined:[...new Set(selectedIds)];
  if(ids?.length===0)return Promise.resolve([]);
  if(ids&&ids.length>480)throw new RangeError("Selected corpus assets exceed 20 segments × 24 steps");
  const selected=ids?sql`AND a.id IN (${sql.join(ids.map(id=>sql`${id}`),sql`,`)})`:sql``;
  return store.query<SignAsset>(sql`SELECT ${metadataColumns},a.derived_sigml AS "derivedSigml" FROM sign_assets a LEFT JOIN asset_aliases x ON x.asset_id=a.id WHERE a.eligible=true AND a.render_state='rendered_ok' ${selected} GROUP BY a.id ORDER BY a.id`);
}
