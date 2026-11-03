import { z } from "zod";
export const conceptIdSchema = z.string().regex(/^c[0-9]{1,2}$/);
export const assetIdSchema = z.string().regex(/^ik2_[a-f0-9]{12}$/);
export const indexSchema = z.number().int().nonnegative();
export const technicalStatusSchema = z.enum(["ready", "partial_blocked", "no_signing", "failed"]);
export const strategySchema = z.enum(["exact_corpus_phrase", "composed_sequence", "no_signing_possible"]);
