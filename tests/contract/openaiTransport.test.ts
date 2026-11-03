import {test,expect} from "vitest";
import {OpenAIModelClient} from "@/lib/ai/client";
import {segmentMeaningSchema,meaningJsonSchema} from "@/lib/contracts/meaning";
import type {ModelRequest} from "@/lib/ai/protocol";
const request:ModelRequest<unknown>={stage:"meaning",model:"gpt-6.1-sol",system:"Fixture instruction",ownerId:"fixture-owner",input:{segment:{text:"Untrusted fixture"}},outputSchema:segmentMeaningSchema,jsonSchema:meaningJsonSchema};
test("Real SDK transport: maxRetries zero, bounded AbortSignal, strict JSON, no storage or tools",async()=>{
  let calls=0;
  const transport:typeof fetch=async (_url,init)=>{calls++;expect(init?.signal).toBeInstanceOf(AbortSignal);const body=JSON.parse(init!.body as string);
    expect(body).toMatchObject({store:false,max_output_tokens:4000,reasoning:{effort:"medium"},text:{format:{type:"json_schema",strict:true}}});expect(body.safety_identifier).toMatch(/^[a-f0-9]{64}$/u);expect(body).not.toHaveProperty("tools");
    return Response.json({error:{message:"Fixture retryable response",type:"rate_limit_error"}},{status:429,headers:{"retry-after":"2"}});
  };
  await expect(new OpenAIModelClient("fixture-no-real-credential",transport).respond(request)).rejects.toMatchObject({code:"model_http_429",retryable:true,retryAfterMs:2000});expect(calls).toBe(1);
});
test("Real SDK transport preserves incomplete usage including reasoning within output",async()=>{
  const transport:typeof fetch=async()=>Response.json({id:"resp_fixture",object:"response",status:"incomplete",output:[],incomplete_details:{reason:"max_output_tokens"},usage:{input_tokens:11,output_tokens:23,output_tokens_details:{reasoning_tokens:17}}});
  expect(await new OpenAIModelClient("fixture-no-real-credential",transport).respond(request)).toMatchObject({status:"incomplete",usage:{inputTokens:11,outputTokens:23,reasoningTokens:17}});
});
