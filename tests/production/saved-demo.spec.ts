import {test,expect,type BrowserContext} from "@playwright/test";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {createDatabase} from "../../lib/db/client";
import {deploymentSnapshot} from "../../lib/db/queries/deploymentVerification";
import {OWNER_COOKIE_NAME} from "../../lib/auth/ownerCookie";
import {currentTrackResponseSchema,playbackManifestSchema} from "../../lib/contracts/manifest";
import {sameEntityTag} from "../../lib/domain/entityTag";
const target=process.env.SIGNBRIDGE_REMOTE_TARGET;
if(!["preview","production","replay"].includes(target??""))throw Error("Select an approved remote target explicitly");
const dbTarget=target==="replay"?"preview":target!;
const deployment=JSON.parse(await readFile(`.data/${target}-deployment.json`,"utf8")),origin=new URL((deployment.deployment??deployment).url).origin;
const state=JSON.parse(await readFile(`.data/${dbTarget}-demo-state.json`,"utf8")) as {ownerToken:string;clips:Record<string,{projectId:string}>};
const bypass=(JSON.parse(await readFile(".data/automation-bypass.json","utf8")) as {secret:string}).secret;
const vars=parseEnv(await readFile(`.data/${dbTarget}.env`,"utf8"));
const headers={"x-vercel-protection-bypass":bypass};
async function protect(context:BrowserContext){
 // Never use global extraHTTPHeaders: the opaque renderer also loads third-party UEA scripts.
 await context.route("**/*",async route=>{
  if(new URL(route.request().url()).origin===origin)await route.continue({headers:{...route.request().headers(),...headers}});
  else await route.continue();
 });
}
test("T1/T2 deployed saved demo: real playback, reload/share identity, no additional model calls",async({page,context,browser},info)=>{
 await protect(context);await context.addCookies([{name:OWNER_COOKIE_NAME,value:state.ownerToken,url:origin,httpOnly:true,secure:true,sameSite:"Lax"}]);
 const db=await createDatabase({url:vars.DATABASE_URL}),projectId=state.clips["sample-a"].projectId,evidenceRoot=`docs/evidence/phase-7/${target}`;
 await mkdir(evidenceRoot,{recursive:true});
 const before=await deploymentSnapshot(db.state,projectId),job=before.jobs.at(-1)!;
 try{
  expect(job.driver).toBe("workflows");expect(job.run_claim).toBeTruthy();expect(["succeeded","partial"]).toContain(job.status);
  const currentResponse=await page.request.get(`${origin}/api/projects/${projectId}/track`,{headers});expect(currentResponse.status()).toBe(200);
  const current=currentTrackResponseSchema.parse(await currentResponse.json());expect(current.media.state).toBe("available");
  const manifestResponse=await page.request.get(`${origin}/api/tracks/${current.trackVersionId}/manifest`,{headers});expect(manifestResponse.status()).toBe(200);
  const manifest=playbackManifestSchema.parse(await manifestResponse.json());expect(manifest.segments).toHaveLength(6);expect(manifest.media.durationMs).toBe(45000);
  expect(manifest.segments.every(s=>s.technicalStatus==="ready"&&s.sigml.unitCount>0)).toBe(true);
  const attempts=before.attempts.filter(a=>a.job_id===job.id);
  for(const segment of manifest.segments){const rows=attempts.filter(a=>a.segment_idx===segment.idx);expect(rows.length).toBeGreaterThanOrEqual(2);expect(rows.length).toBeLessThanOrEqual(3);expect(rows.filter(a=>a.outcome.startsWith("repair_")).length).toBeLessThanOrEqual(1);for(const stage of ["meaning","plan"])expect(rows.some(a=>a.stage===stage&&a.provider==="openai"&&["completed","repair_completed"].includes(a.outcome)&&a.input_tokens!==null&&a.output_tokens!==null)).toBe(true);}
  const healthResponse=await page.request.get(`${origin}/api/health`,{headers});expect(healthResponse.status()).toBe(200);const health=await healthResponse.json();if(target==="replay")expect(health.processing).toBe("disabled");
  await page.goto(`${origin}/p/${projectId}`);const player=page.getByRole("region",{name:"Saved signing companion"});await expect(player).toHaveAttribute("data-manifest-hash",current.manifestHash);
  await expect(page.getByTestId("player-state")).toHaveText("Ready",{timeout:60000});
  const observations=[];
  if(target!=="replay")for(let idx=0;idx<6;idx++){
   await page.getByRole("combobox",{name:/^Segment\b/u}).selectOption(String(idx));await page.getByRole("button",{name:"Play segment",exact:true}).click();
   await page.locator(".player-layout").scrollIntoViewIfNeeded();
   if(idx===0){await expect(page.getByTestId("player-state")).toHaveText("SignPlaying",{timeout:30000});await page.screenshot({path:`${evidenceRoot}/signing-${info.project.name}.png`,fullPage:true});}
   await expect(page.getByRole("heading",{name:`${idx+1} of 6 segments fully signed (experimental)`,exact:true})).toBeVisible({timeout:60000});
   const seen=JSON.parse((await player.getAttribute("data-seen-units"))!),expected=JSON.parse((await player.getAttribute("data-expected-units"))!);expect(seen).toEqual(expected);expect(seen.length).toBe(manifest.segments[idx].sigml.unitCount);
   observations.push({idx,seen,expected,loaded:Number(await player.getAttribute("data-loaded-units"))});
  }
  await page.screenshot({path:`${evidenceRoot}/covered-${info.project.name}.png`,fullPage:true});
  await page.reload();await expect(player).toHaveAttribute("data-manifest-hash",current.manifestHash);
  const shareResponse=await page.request.post(`${origin}/api/projects/${projectId}/share`,{headers:{...headers,Origin:origin},data:{enable:true}});expect(shareResponse.status()).toBe(200);
  const shareUrl=(await shareResponse.json()).shareUrl as string;
  await writeFile(`.data/${target}-share-${info.project.name}.json`,JSON.stringify({projectId,shareUrl}),{mode:0o600});
  const viewer=await browser.newContext();try{await protect(viewer);const shared=await viewer.newPage();await shared.goto(shareUrl);await expect(shared.getByText("Shared view · experimental · not reviewed",{exact:true})).toBeVisible();await expect(shared.getByRole("region",{name:"Saved signing companion"})).toHaveAttribute("data-manifest-hash",current.manifestHash);}finally{await viewer.close();}
  const etag=manifestResponse.headers()["etag"];expect(sameEntityTag(etag,`"${current.manifestHash}"`)).toBe(true);expect(manifestResponse.headers()["cache-control"]).toContain("private, no-cache");
  const conditional=await page.request.get(`${origin}/api/tracks/${current.trackVersionId}/manifest`,{headers:{...headers,"If-None-Match":etag}});expect(conditional.status()).toBe(304);
  const range=await page.request.get(current.media.url!,{headers:{Range:"bytes=0-1023"}});expect(range.status()).toBe(206);expect(range.headers()["content-range"]).toMatch(/^bytes 0-1023\//u);
  const after=await deploymentSnapshot(db.state,projectId);expect(after.attempts).toEqual(before.attempts);expect(after.tracks).toEqual(before.tracks);
  await writeFile(`${evidenceRoot}/playback-${info.project.name}.json`,JSON.stringify({date:new Date().toISOString(),origin,browser:info.project.name,browserVersion:browser.version(),environment:"Windows headless software WebGL",status:"PASS",projectId,jobId:job.id,workflowRunId:job.run_claim,trackVersionId:current.trackVersionId,manifestHash:current.manifestHash,attempts,segments:manifest.segments.map(s=>({idx:s.idx,status:s.technicalStatus,units:s.sigml.unitCount})),observations,reloadShareSameHash:true,additionalModelCalls:0,etag,conditionalStatus:conditional.status(),rangeStatus:range.status(),processing:health.processing},null,2)+"\n");
 }finally{await db.close();}
});

test("Deployed deliberately unsupported segment blocks signing and retains its caption",async({page,context,browser},info)=>{
 await protect(context);await context.addCookies([{name:OWNER_COOKIE_NAME,value:state.ownerToken,url:origin,httpOnly:true,secure:true,sameSite:"Lax"}]);
 const projectId=state.clips["unsupported-b"].projectId,evidenceRoot=`docs/evidence/phase-7/${target}`;
 await mkdir(evidenceRoot,{recursive:true});await page.goto(`${origin}/p/${projectId}`);
 const player=page.getByRole("region",{name:"Saved signing companion"});await expect(player).toBeVisible();await expect(page.getByTestId("player-state")).toHaveText("Ready",{timeout:60000});
 await page.getByRole("combobox",{name:/^Segment\b/u}).selectOption("1");await page.getByRole("button",{name:"Play segment",exact:true}).click();
 await expect(page.getByTestId("gap-card")).toBeVisible({timeout:30000});await expect(page.getByTestId("gap-card")).toContainText("নেই");await expect(page.getByTestId("source-caption")).toContainText("দুধ নেই");
 await expect(page.getByRole("heading",{name:"0 of 2 segments fully signed (experimental)",exact:true})).toBeVisible();
 await page.screenshot({path:`${evidenceRoot}/unsupported-${info.project.name}.png`,fullPage:true});
 await writeFile(`${evidenceRoot}/unsupported-${info.project.name}.json`,JSON.stringify({date:new Date().toISOString(),origin,browser:info.project.name,browserVersion:browser.version(),status:"PASS",projectId,blockingGapBeforeSigning:true,captionVisible:true,technicalCompletionCount:0},null,2)+"\n");
});
