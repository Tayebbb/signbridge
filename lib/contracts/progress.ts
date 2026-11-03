import { z } from "zod";
import { strictJsonSchema } from "./jsonSchema";
export const jobProgressSchema = z.strictObject({
  jobId: z.string(), status: z.enum(["queued", "running", "succeeded", "partial", "failed", "cancelled", "superseded"]), transcriptVersionId: z.string(),
  segments: z.array(z.strictObject({ idx: z.number().int().nonnegative(), stage: z.enum(["pending", "meaning", "plan", "validated", "published"]), state: z.enum(["ok", "cache_hit", "retrying", "partial_blocked", "failed"]), errorCode: z.string().nullable() })), trackVersionId: z.string().nullable(), retryable: z.boolean(), message: z.string().nullable(),
});
export type JobProgress = z.infer<typeof jobProgressSchema>;
export const progressJsonSchema = strictJsonSchema(jobProgressSchema);
