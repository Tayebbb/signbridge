import { z } from "zod";
export type JsonSchema = Record<string, unknown>;
export function strictJsonSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { target: "draft-7", reused: "inline" }) as JsonSchema;
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "$schema").map(([key, child]) => [key === "oneOf" ? "anyOf" : key, visit(child)]));
  }
  return visit(json) as JsonSchema;
}
