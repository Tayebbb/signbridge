import { z } from "zod";
import { assetIdSchema, conceptIdSchema, indexSchema, strategySchema, technicalStatusSchema } from "./common";
import { strictJsonSchema } from "./jsonSchema";
export const manifestSegmentSchema = z.strictObject({
  idx: indexSchema, startMs: indexSchema, endMs: indexSchema, sourceTextBn: z.string(), holdFrameMs: indexSchema,
  technicalStatus: technicalStatusSchema, strategy: strategySchema, meaningResultKey: z.string(), planResultKey: z.string(),
  criticalGaps: z.array(z.strictObject({ conceptId: z.string(), role: z.string(), surfaceBn: z.string(), reason: z.string() })), ambiguities: z.array(z.strictObject({ description: z.string(), blocking: z.boolean() })),
  timeline: z.array(z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("asset"), assetId: assetIdSchema, labelBn: z.string(), derivedSha256: z.string(), unitRange: z.strictObject({ first: indexSchema, count: indexSchema }), conceptIds: z.array(conceptIdSchema) }),
    z.strictObject({ kind: z.literal("gap"), conceptIds: z.array(conceptIdSchema), surfaceBn: z.string(), reason: z.string() }),
  ])),
  sigml: z.strictObject({ text: z.string(), sha256: z.string(), unitCount: indexSchema, unitGlossIds: z.array(z.string().regex(/^s[0-9]+a[0-9]+u[0-9]+$/)) }),
});
export const playbackManifestSchema = z.strictObject({
  schemaVersion: z.literal("manifest-v2"), trackVersionId: z.string(), projectId: z.string(), transcriptVersion: z.strictObject({ id: z.string(), versionNo: indexSchema, textHash: z.string() }), media: z.strictObject({ contentSha256: z.string(), sizeBytes: indexSchema, durationMs: indexSchema }),
  renderer: z.strictObject({ profile: z.literal("cwasa-vhg2026/anna/speed0"), engineUrl: z.literal("https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/cwa/allcsa.js"), jasBase: z.literal("https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/"), avatar: z.literal("anna"), remoteDependency: z.literal(true) }),
  provenance: z.strictObject({ corpusReleaseId: z.literal("ik2-mendeley-v2"), corpusLicense: z.literal("CC-BY-4.0"), corpusAttribution: z.string(), sourceFormVersion: z.string(), sigmlBuilderVersion: z.string(), modelProfile: z.string(), promptVersions: z.strictObject({ meaning: z.string(), plan: z.string() }), validatorVersion: z.string() }),
  segments: z.array(manifestSegmentSchema), anchors: z.array(z.strictObject({ anchorId: z.string(), frameMs: indexSchema, segmentIdx: indexSchema, labelBn: z.string().nullable() })),
});
export const currentTrackResponseSchema = z.strictObject({
  trackVersionId: z.string(), manifestHash: z.string(), overlays: z.strictObject({ sourceChecks: z.array(z.strictObject({ idx: indexSchema, state: z.enum(["unconfirmed", "creator_confirmed"]),confirmedAt:z.string().nullable() })), review: z.strictObject({ status: z.enum(["unreviewed", "reviewed_acceptable", "reviewed_needs_changes", "reviewed_unacceptable"]), validFor: z.string().nullable() }) }),
  media: z.strictObject({ state: z.enum(["available", "expired", "missing"]), url: z.string().nullable(), expiresAt: z.string().nullable(),reason:z.enum(["transfer_cap","storage_unavailable"]).nullable() }),
});
export type ManifestSegment = z.infer<typeof manifestSegmentSchema>;
export type PlaybackManifest = z.infer<typeof playbackManifestSchema>;
export type CurrentTrackResponse = z.infer<typeof currentTrackResponseSchema>;
export const manifestJsonSchema = strictJsonSchema(playbackManifestSchema);
export const currentTrackJsonSchema = strictJsonSchema(currentTrackResponseSchema);
