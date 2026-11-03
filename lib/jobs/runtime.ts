import {applicationStore} from "../db/queries/api";
import type {Pipeline} from "./steps";
import {OpenAIModelClient} from "../ai/client";
import {deterministicFake} from "../ai/fakeFixtures";
export async function applicationPipeline():Promise<Pipeline>{
  const store=await applicationStore();
  if(process.env.MODEL_DRIVER==="openai"){
    if(!process.env.OPENAI_API_KEY)throw Error("OpenAI credential is not configured");
    return {store,model:new OpenAIModelClient(process.env.OPENAI_API_KEY)};
  }
  if(process.env.VERCEL)throw Error("Production model adapter must be explicitly configured");
  return {store,model:deterministicFake()};
}
