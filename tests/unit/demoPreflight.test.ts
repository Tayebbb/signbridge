import {test,expect} from "vitest";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,sep} from "node:path";
import {demoConfigSchema,prepareDemos} from "../../scripts/seed-demo";
const clip={id:"covered",title:"Synthetic configuration fixture",video:resolve("tests/fixtures/clip.mp4"),captions:"fixture.srt",durationMs:4000,width:320,height:240,expectUnsupported:false};
test("Demo preflight requires attested rights, unique IDs and a deliberately unsupported clip",()=>{
 const config={rightsAttested:true,clips:[clip,{...clip,id:"gap",expectUnsupported:true}]};expect(demoConfigSchema.safeParse(config).success).toBe(true);
 for(const invalid of [{...config,rightsAttested:false},{...config,clips:[clip,clip]},{...config,clips:[clip,{...clip,id:"second"}]}])expect(demoConfigSchema.safeParse(invalid).success).toBe(false);
});
test("Demo dry preparation binds real file bytes and deterministic segmentation, and rejects timing beyond the clip",async()=>{
 const root=await mkdtemp(resolve(".data/demo-preflight-"));try{
  await writeFile(resolve(root,"fixture.srt"),"1\n00:00:00,000 --> 00:00:02,000\nপরীক্ষা।\n\n2\n00:00:02,000 --> 00:00:04,000\nপরীক্ষা।");
  const config={rightsAttested:true,clips:[clip,{...clip,id:"gap",expectUnsupported:true}]};const path=resolve(root,"demo.json");await writeFile(path,JSON.stringify(config));
  const demos=await prepareDemos(path);expect(demos[0].segments).toBe(2);expect(demos[0].sha256).toBe(demos[1].sha256);expect(demos[0].bytes.length).toBeGreaterThan(0);
  await writeFile(path,JSON.stringify({...config,clips:config.clips.map(c=>({...c,durationMs:1000}))}));await expect(prepareDemos(path)).rejects.toThrow("timing/segment limits");
 }finally{if(!root.startsWith(resolve(".data")+sep))throw Error("Unexpected fixture cleanup path");await rm(root,{recursive:true,force:true});}
});
