import {chromium,expect,type BrowserContext} from "@playwright/test";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {resolve,sep} from "node:path";
import {createHash} from "node:crypto";
import {PUBLIC_DEMOS} from "../lib/domain/publicDemoCatalog";
import {createDatabase} from "../lib/db/client";
import {operationsStatus} from "../lib/db/queries/operations";
import {OWNER_COOKIE_NAME} from "../lib/auth/ownerCookie";
if(!process.argv.includes("--live")){console.log("DRY RUN: --live checks approved production routes and saved replay, including a labelled browser-only dropped-callback fault; no model processing requested.");process.exit(0);}
async function main(){
 const origin=new URL(PUBLIC_DEMOS[0].href).origin,root=process.argv.find(arg=>arg.startsWith("--evidence-dir="))?.slice("--evidence-dir=".length)??"docs/evidence/final";
 const base=resolve("docs/evidence/final"),output=resolve(root);if(output!==base&&!output.startsWith(base+sep))throw Error("Final evidence must stay under docs/evidence/final");await mkdir(root,{recursive:true});
 const vars=parseEnv(await readFile(".data/production.env","utf8")),owner=JSON.parse(await readFile(".data/production-demo-state.json","utf8")) as {ownerToken:string;clips:Record<string,{projectId:string}>};
 const db=await createDatabase({url:vars.DATABASE_URL}),before=await operationsStatus(db.state),browser=await chromium.launch({executablePath:resolve(".data/chrome/chrome-win64/chrome.exe"),args:["--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
 const rows:object[]=[];
 async function capture(context:BrowserContext,name:string,url:string,expected=200){const page=await context.newPage();try{const r=await page.goto(url);expect(r?.status()).toBe(expected);const image=page.getByAltText("Official event sticker",{exact:true});await expect(image).toBeVisible();const box=await image.boundingBox();expect(box?.y).toBeLessThan(160);await expect(page.getByText("Awaiting official asset",{exact:true})).toHaveCount(0);if(/^\/(s|p)\//u.test(new URL(url).pathname))await expect(page.getByRole("region",{name:"Saved signing companion"})).toBeVisible({timeout:20000});await page.screenshot({path:`${root}/${name}.png`,fullPage:true});rows.push({name,path:new URL(url).pathname,status:r!.status(),officialStickerVisible:true,stickerTop:box?.y,screenshot:`${root}/${name}.png`});}finally{await page.close();}}
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:OWNER_COOKIE_NAME,value:owner.ownerToken,url:origin,httpOnly:true,secure:true,sameSite:"Lax"}]);
  try{await capture(context,"home",origin);await capture(context,"about",origin+"/about");await capture(context,"creator",`${origin}/p/${owner.clips["sample-a"].projectId}`);await capture(context,"renderer-spike",origin+"/renderer-spike");await capture(context,"not-found",origin+"/phase8-nonexistent-route",404);}finally{await context.close();}
  const portrait=await browser.newContext({viewport:{width:390,height:844}});try{await capture(portrait,"home-portrait",origin);}finally{await portrait.close();}
  const viewer=await browser.newContext({viewport:{width:1440,height:1000}});
  try{
   for(const demo of PUBLIC_DEMOS)await capture(viewer,demo.id==="sample-a"?"shared-a":"shared-b",demo.href);
   const page=await viewer.newPage();await page.goto(PUBLIC_DEMOS[0].href);const player=page.getByRole("region",{name:"Saved signing companion"});await expect(player).toBeVisible();await expect(page.getByTestId("player-state")).toHaveText("Ready",{timeout:60000});const hash=await player.getAttribute("data-manifest-hash");
   await page.getByRole("button",{name:"Play segment",exact:true}).click();await page.locator(".player-layout").scrollIntoViewIfNeeded();await expect(page.getByTestId("player-state")).toHaveText("SignPlaying",{timeout:30000});await page.locator(".player-layout").screenshot({path:`${root}/signing-source.png`});await expect(page.getByRole("heading",{name:"1 of 6 segments fully signed (experimental)",exact:true})).toBeVisible({timeout:60000});await page.reload();await expect(player).toHaveAttribute("data-manifest-hash",hash!);
   await page.goto(PUBLIC_DEMOS[1].href);await expect(page.getByTestId("player-state")).toHaveText("Ready",{timeout:60000});await page.getByRole("combobox",{name:/^Segment\b/u}).selectOption("1");await page.getByRole("button",{name:"Play segment",exact:true}).click();await expect(page.getByTestId("gap-card")).toBeVisible({timeout:30000});await page.getByTestId("gap-card").screenshot({path:`${root}/gap-card.png`});await page.screenshot({path:`${root}/unsupported.png`,fullPage:true});
   await page.close();
  }finally{await viewer.close();}
  const fault=await browser.newContext({viewport:{width:1440,height:1000}});
  try{
   await fault.addInitScript(()=>{const win=window as Window&{phase8DropIdle?:boolean};win.phase8DropIdle=true;window.addEventListener("message",event=>{if(win.phase8DropIdle&&event.data?.type==="animidle")event.stopImmediatePropagation();},true);});
   const page=await fault.newPage();await page.goto(PUBLIC_DEMOS[0].href);await expect(page.getByTestId("player-state")).toHaveText("Ready",{timeout:60000});await page.getByRole("button",{name:"Play segment",exact:true}).click();await expect(page.getByTestId("incomplete-card")).toBeVisible({timeout:60000});await page.screenshot({path:`${root}/incomplete-controlled.png`,fullPage:true});
   await page.evaluate(()=>{(window as Window&{phase8DropIdle?:boolean}).phase8DropIdle=false;});await page.getByRole("button",{name:"Retry signing",exact:true}).click();await expect(page.getByRole("heading",{name:"1 of 6 segments fully signed (experimental)",exact:true})).toBeVisible({timeout:60000});await page.screenshot({path:`${root}/recovered-controlled.png`,fullPage:true});
  }finally{await fault.close();}
  const healthResponse=await fetch(origin+"/api/health",{redirect:"error"});expect(healthResponse.status).toBe(200);const health=await healthResponse.json(),sticker=await fetch(origin+"/event-sticker.png",{redirect:"manual"});
  expect(sticker.status).toBe(200);const remote=Buffer.from(await sticker.arrayBuffer()),local=await readFile("public/event-sticker.png");expect(remote.equals(local)).toBe(true);
  const after=await operationsStatus(db.state);expect(after.stageAttemptCount).toBe(before.stageAttemptCount);expect(after.budgets).toEqual(before.budgets);
  const result={date:new Date().toISOString(),timezone:"Asia/Dhaka",origin,browser:browser.version(),routes:rows,health:{status:healthResponse.status,body:health},savedReplay:"PASS",manifestIdentityUnchanged:true,additionalModelCalls:0,controlledFault:{method:"Browser-only suppression of animidle; real UEA animation and unchanged saved manifest",incompleteVisible:true,retryRecovered:true,productionIncident:false},officialSticker:{status:"PASS",httpStatus:sticker.status,ownerAttestedOfficial:true,remoteBytesMatchOriginal:true,sha256:createHash("sha256").update(local).digest("hex")},environment:"Windows headless software WebGL",mobilePhysical:"NOT RUN",linguisticCorrectness:"NONE",userComprehension:"NONE"};
  await writeFile(`${root}/smoke.json`,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify({routes:rows.length,savedReplay:"PASS",controlledRecovery:"PASS",additionalModelCalls:0,officialSticker:"PASS"}));
 }finally{await browser.close();await db.close();}
}
main().catch(()=>{console.error("Final smoke failed; inspect local screenshots without exposing capabilities");process.exitCode=1;});
