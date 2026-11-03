import {test,expect} from "vitest";
import {meaningJsonSchema,segmentMeaningSchema} from "@/lib/contracts/meaning";
import {planJsonSchema,createPlanSchema} from "@/lib/contracts/plan";
import {manifestJsonSchema,currentTrackJsonSchema,playbackManifestSchema,currentTrackResponseSchema} from "@/lib/contracts/manifest";
import {progressJsonSchema,jobProgressSchema} from "@/lib/contracts/progress";
import {apiErrorJsonSchema,apiErrorSchema} from "@/lib/contracts/api";
import {meaning,plan,asset} from "../fixtures/domain";
const maximumCandidates=Array.from({length:150},(_,i)=>asset("fixture",i).id);
test.each(Object.entries({meaning:meaningJsonSchema,plan:planJsonSchema(maximumCandidates),emptyPlan:planJsonSchema([]),manifest:manifestJsonSchema,current:currentTrackJsonSchema,progress:progressJsonSchema,error:apiErrorJsonSchema}))("T11: %s generated JSON Schema satisfies the current strict subset",(_,schema)=>{
  expect(schema.type).toBe("object");expect(schema).not.toHaveProperty("anyOf");
  let enums=0,properties=0,strings=0,maxDepth=0;
  const forbidden=["oneOf","allOf","not","if","then","else","dependentRequired","dependentSchemas","patternProperties"];
  function inspect(node:unknown,depth:number) {
    if(!node||typeof node!=="object"||Array.isArray(node))return;
    const s=node as Record<string,unknown>;
    for(const key of forbidden)expect(s).not.toHaveProperty(key);
    const next=depth+(s.type==="object"||s.type==="array"?1:0);maxDepth=Math.max(maxDepth,next);
    if(s.type==="object"){
      expect(s.additionalProperties).toBe(false);
      const keys=Object.keys(s.properties as object);expect([...(s.required as string[])].sort()).toEqual([...keys].sort());
      properties+=keys.length;strings+=keys.join("").length;
      for(const value of Object.values(s.properties as object))inspect(value,next);
    }
    if(Array.isArray(s.enum)){enums+=s.enum.length;strings+=s.enum.filter(x=>typeof x==="string").join("").length;if(s.enum.length>250)expect(s.enum.join("").length).toBeLessThanOrEqual(15_000);}
    if(typeof s.const==="string")strings+=s.const.length;
    if(s.items)inspect(s.items,next);
    if(Array.isArray(s.anyOf))s.anyOf.forEach(value=>inspect(value,next));
  }
  inspect(schema,0);expect(maxDepth).toBeLessThanOrEqual(10);expect(properties).toBeLessThanOrEqual(5000);expect(strings).toBeLessThanOrEqual(120_000);expect(enums).toBeLessThanOrEqual(1000);
});
test("T11: dynamic asset enum is bounded and rejects foreign IDs, duplicate candidates and overflow",()=>{
  const ids=[asset("fixture",1).id,asset("fixture",2).id];
  expect(createPlanSchema(ids).parse(plan())).toEqual(plan());
  const bad=plan();bad.steps[0].assetId=asset("foreign",99).id;expect(()=>createPlanSchema(ids).parse(bad)).toThrow();
  expect(()=>createPlanSchema([...maximumCandidates,asset("overflow",151).id])).toThrow();expect(()=>createPlanSchema([ids[0],ids[0]])).toThrow();
  expect(()=>createPlanSchema([]).parse(plan())).toThrow();
});
test("All contracts reject missing/unknown fields and stage outputs never accept segmentIdx",()=>{
  expect(()=>segmentMeaningSchema.parse({...meaning(),segmentIdx:3})).toThrow();expect(()=>segmentMeaningSchema.parse({...meaning(),polarity:undefined})).toThrow();
  expect(()=>createPlanSchema(maximumCandidates).parse({...plan(),segmentIdx:3})).toThrow();
  expect(apiErrorSchema.parse({error:{code:"test",message:"safe",retryable:false}})).toBeTruthy();
  expect(()=>apiErrorSchema.parse({error:{code:"test",message:"safe"}})).toThrow();
  expect(()=>jobProgressSchema.parse({})).toThrow();expect(()=>playbackManifestSchema.parse({})).toThrow();expect(()=>currentTrackResponseSchema.parse({})).toThrow();
});
