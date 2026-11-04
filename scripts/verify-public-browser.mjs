import {chromium,expect} from "@playwright/test";
import {mkdir,writeFile} from "node:fs/promises";

// Read-only public capability already published in README. Never creates jobs or rotates shares.
const origin="https://signbridge-mdtayebibne-4755s-projects.vercel.app";
const sample=origin+"/s/b0a2b6b2-fbab-4936-829e-620b0a937ed4?s=8EdVJxY2BO-DDccdy6bQu-M7r5Oq5aSyH4ma9NaE6Fg";
const root="docs/evidence/hardening-2026-11-05";
await mkdir(root,{recursive:true});
const results=[];
for(const mobile of [false,true]){
 const browser=await chromium.launch({headless:true,args:["--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
 const profile=mobile?"mobile":"desktop";
 try{
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1100},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();
  const healthResponse=await context.request.get(origin+"/api/health");
  expect(healthResponse.status()).toBe(200);const health=await healthResponse.json();expect(health.db).toBe("ok");expect(health.processing).toBe("enabled");
  const started=Date.now();await page.goto(sample,{waitUntil:"domcontentloaded"});
  const player=page.getByRole("region",{name:"Saved signing companion"});
  await expect(page.getByTestId("player-state")).toHaveText("Ready",{timeout:120000});
  const readyMs=Date.now()-started,manifestHash=await player.getAttribute("data-manifest-hash");expect(manifestHash).toMatch(/^[a-f0-9]{64}$/);
  const initialFrames=await page.locator(".renderer-area iframe").count();expect(initialFrames).toBe(1);
  const image=page.getByAltText("Official event sticker");await expect(image).toBeVisible();
  const imageUrl=await image.evaluate(el=>el.currentSrc);expect(new URL(imageUrl).pathname).toBe("/_next/image");
  const imageResponse=await context.request.get(imageUrl);expect(imageResponse.status()).toBe(200);const imageBytes=(await imageResponse.body()).byteLength;
  const observations=[];let visibleAvatarPixels=null;
  for(let idx=0;idx<(mobile?1:6);idx++){
   await page.getByRole("combobox",{name:/^Segment\b/u}).selectOption(String(idx));
   const play=page.getByRole("button",{name:"Play segment",exact:true});if(mobile)await play.tap();else await play.click();
   await expect(page.getByTestId("player-state")).toHaveText("SignPlaying",{timeout:45000});
   if(mobile){const rect=await page.locator(".renderer-area").boundingBox();expect(rect).not.toBeNull();visibleAvatarPixels=Math.max(0,Math.min(rect.y+rect.height,844)-Math.max(rect.y,0));expect(visibleAvatarPixels).toBeGreaterThan(200);}
   if(idx===0)await page.screenshot({path:`${root}/public-${profile}-signing.png`,fullPage:true});
   await expect(page.getByRole("heading",{name:`${idx+1} of 6 segments fully signed (experimental)`,exact:true})).toBeVisible({timeout:60000});
   const seen=JSON.parse(await player.getAttribute("data-seen-units")),expected=JSON.parse(await player.getAttribute("data-expected-units"));
   expect(expected.length).toBeGreaterThan(0);expect(seen).toEqual(expected);observations.push({segment:idx,seen,expected,loaded:Number(await player.getAttribute("data-loaded-units"))});
  }
  await expect(page.getByTestId("player-state")).toHaveText("Ready");
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});});
  await expect(page.getByTestId("player-state")).toHaveText("Ready");
  await expect(page.getByRole("heading",{name:`${mobile?1:6} of 6 segments fully signed (experimental)`,exact:true})).toBeVisible();
  await page.reload();await expect(player).toHaveAttribute("data-manifest-hash",manifestHash);
  results.push({profile:mobile?"Chromium mobile emulation + synthesized touch; not physical hardware":"Chromium desktop",browserVersion:browser.version(),health,readyMs,manifestHash,initialRendererFrames:initialFrames,optimizedImageBytes:imageBytes,visibleAvatarPixelsDuringSigning:visibleAvatarPixels,observations,idleVisibilityPreserved:true,reloadIdentityPreserved:true});
  await context.close();
 }catch(error){await writeFile(`${root}/public-browser-failure.json`,JSON.stringify({date:new Date().toISOString(),profile,error:String(error)},null,2)+"\n");throw error;}
 finally{await browser.close();}
}
await writeFile(root+"/public-browser.json",JSON.stringify({date:new Date().toISOString(),origin,status:"PASS",environment:"GitHub-hosted Linux headless software WebGL",results,scope:"Read-only saved production playback; no job creation or share mutation",linguisticEvidence:"NONE",comprehensionEvidence:"NONE"},null,2)+"\n");
console.log(JSON.stringify({status:"PASS",profiles:results.map(x=>x.profile),segments:results.map(x=>x.observations.length)}));
