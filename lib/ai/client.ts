import type { z } from "zod";
export interface ModelRequest<T> { input: unknown; outputSchema: z.ZodType<T> }
export interface ModelClient { generate<T>(request: ModelRequest<T>): Promise<T> }
/** Explicit canned fixtures; never presented as model inference. */
export class FakeModelClient implements ModelClient {
  constructor(private readonly response: unknown) {}
  async generate<T>({ outputSchema }: ModelRequest<T>): Promise<T> {
    return outputSchema.parse(structuredClone(this.response));
  }
}
