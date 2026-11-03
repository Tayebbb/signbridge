import OpenAI from "openai";
import {sha256} from "../domain/fingerprints";
import {TOKEN_CAPS} from "./models";
import {ModelFailure,type ModelClient,type ModelRequest,type ModelReply} from "./protocol";
export type {ModelClient,ModelRequest} from "./protocol";
/** Exactly this body is metered, including instructions, schema and repair data. No tools. */
export function responseBody<T>(r:ModelRequest<T>){return {
  model:r.model,store:false as const,safety_identifier:sha256(r.ownerId),
  reasoning:{effort:"medium" as const},max_output_tokens:TOKEN_CAPS[r.stage],
  input:[{role:"system" as const,content:r.system},{role:"user" as const,content:JSON.stringify(r.input)}],
  text:{format:{type:"json_schema" as const,name:r.stage,strict:true,schema:r.jsonSchema}},
};}
export class OpenAIModelClient implements ModelClient {
  readonly kind="openai";
  private readonly sdk:OpenAI;
  constructor(key:string,fetcher?:typeof fetch){this.sdk=new OpenAI({apiKey:key,maxRetries:0,timeout:90_000,fetch:fetcher});}
  async respond<T>(request:ModelRequest<T>):Promise<ModelReply>{
    try{
      const r=await this.sdk.responses.create(responseBody(request),{signal:AbortSignal.timeout(90_000)});
      const usage=r.usage?{inputTokens:r.usage.input_tokens,outputTokens:r.usage.output_tokens,reasoningTokens:r.usage.output_tokens_details?.reasoning_tokens}:undefined;
      if(r.output.some(item=>item.type==="message"&&item.content.some(c=>c.type==="refusal")))return {status:"refusal",output:null,usage};
      let output:unknown=null;
      try{output=JSON.parse(r.output_text);}catch{/* Invalid or incomplete output can still be billed. */}
      return {status:r.status==="completed"?"completed":"incomplete",output,usage};
    }catch(error){
      if(error instanceof OpenAI.APIError){const status=error.status??0,retry=Number(error.headers?.get("retry-after"));
        throw new ModelFailure(status===400?"schema_error":`model_http_${status}`,[408,409,429].includes(status)||status>=500||!status,Number.isFinite(retry)?Math.max(0,retry*1000):0);}
      throw new ModelFailure("model_network",true);
    }
  }
}
/** Explicit canned fixtures or a deterministic handler; never presented as inference. */
export class FakeModelClient implements ModelClient {
  readonly kind="fake";
  calls:ModelRequest<unknown>[]=[];
  constructor(private readonly response:unknown,private readonly delayMs=0){}
  async generate<T>({outputSchema}:Pick<ModelRequest<T>,"input"|"outputSchema">):Promise<T>{return outputSchema.parse(structuredClone(this.response));}
  async respond<T>(r:ModelRequest<T>):Promise<ModelReply>{
    this.calls.push(r as ModelRequest<unknown>);
    if(this.delayMs)await new Promise(resolve=>setTimeout(resolve,this.delayMs));
    const output=typeof this.response==="function"?await this.response(r,this.calls.length):structuredClone(this.response);
    if(output instanceof ModelFailure)throw output;
    if(output&&typeof output==="object"&&"status" in output)return output as ModelReply;
    return {status:"completed",output,usage:{inputTokens:100,outputTokens:100}};
  }
}
