import type {z} from "zod";
import type {ModelId} from "./models";
export interface Usage {inputTokens:number;outputTokens:number;reasoningTokens?:number}
export interface ModelRequest<T> {
  input:unknown;outputSchema:z.ZodType<T>;jsonSchema:Record<string,unknown>;
  stage:"meaning"|"plan";model:ModelId;system:string;ownerId:string;
}
export type ModelReply={status:"completed"|"incomplete"|"refusal";output:unknown;usage?:Usage};
export interface ModelClient {readonly kind:"fake"|"openai";respond<T>(request:ModelRequest<T>):Promise<ModelReply>}
export class ModelFailure extends Error {
  constructor(public readonly code:string,public readonly retryable:boolean,public readonly retryAfterMs=0,public readonly sent=true){super(code);}
}
