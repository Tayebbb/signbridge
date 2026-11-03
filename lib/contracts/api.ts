import { z } from "zod";
import { strictJsonSchema } from "./jsonSchema";
export const apiErrorSchema = z.strictObject({ error: z.strictObject({ code: z.string(), message: z.string(), retryable: z.boolean() }) });
export type ApiError = z.infer<typeof apiErrorSchema>;
export const apiErrorJsonSchema = strictJsonSchema(apiErrorSchema);
