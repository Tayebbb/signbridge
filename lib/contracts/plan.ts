import { z } from "zod";
import { assetIdSchema, conceptIdSchema, strategySchema } from "./common";
import { strictJsonSchema } from "./jsonSchema";
const fields = { schemaVersion: z.literal("plan-v2"), strategy: strategySchema, uncoveredConceptIds: z.array(conceptIdSchema), notes: z.string().max(300) };
const step = { kind: z.enum(["asset", "gap"]), conceptIds: z.array(conceptIdSchema).max(6), gapReason: z.enum(["no_candidate", "candidate_meaning_mismatch", "ambiguous_source"]).nullable() };
export const segmentPlanSchema = z.strictObject({ ...fields, steps: z.array(z.strictObject({ ...step, assetId: assetIdSchema.nullable() })).max(24) });
export function createPlanSchema(candidateIds: readonly string[]) {
  if (candidateIds.length > 150 || new Set(candidateIds).size !== candidateIds.length) throw new Error("Candidate IDs must be unique and bounded to 150");
  candidateIds.forEach(id => assetIdSchema.parse(id));
  const assetId = candidateIds.length ? z.enum(candidateIds as [string, ...string[]]).nullable() : z.null();
  return z.strictObject({ ...fields, steps: z.array(z.strictObject({ ...step, assetId })).max(24) });
}
export type SegmentPlan = z.infer<typeof segmentPlanSchema>;
export const planJsonSchema = (candidateIds: readonly string[]) => strictJsonSchema(createPlanSchema(candidateIds));
