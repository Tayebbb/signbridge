import { z } from "zod";
import { conceptIdSchema } from "./common";
import { strictJsonSchema } from "./jsonSchema";
export const conceptRoleSchema = z.enum(["actor", "action", "object", "recipient", "location", "time", "quantity", "negation", "question", "modality", "attribute", "other"]);
const referentId = z.string().regex(/^r[0-9]{1,2}$/);
export const segmentMeaningSchema = z.strictObject({
  schemaVersion: z.literal("meaning-v2"), clauseType: z.enum(["statement", "yes_no_question", "wh_question", "command", "exclamation", "fragment"]), polarity: z.enum(["affirmative", "negative", "mixed"]),
  referents: z.array(z.strictObject({ id: referentId, surfaceBn: z.string().min(1), kind: z.enum(["person", "object", "place", "organization", "abstract"]), resolvedFrom: z.enum(["this_segment", "previous_context", "unresolved"]) })).max(99),
  concepts: z.array(z.strictObject({ id: conceptIdSchema, role: conceptRoleSchema, surfaceBn: z.string().min(1), lemmaBn: z.string().min(1), referentId: referentId.nullable(), numericValue: z.number().nullable(), critical: z.boolean() })).max(99),
  propositions: z.array(z.strictObject({ id: z.string().regex(/^p[0-9]{1,2}$/), predicateConceptId: conceptIdSchema, argumentConceptIds: z.array(conceptIdSchema), negated: z.boolean(), tense: z.enum(["past", "present", "future", "unspecified"]) })).max(99),
  ambiguities: z.array(z.strictObject({ conceptId: conceptIdSchema.nullable(), description: z.string().max(300), blocking: z.boolean() })),
});
export type ConceptRole = z.infer<typeof conceptRoleSchema>;
export type SegmentMeaning = z.infer<typeof segmentMeaningSchema>;
export const meaningJsonSchema = strictJsonSchema(segmentMeaningSchema);
