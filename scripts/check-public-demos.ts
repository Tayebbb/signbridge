import {chromium,expect} from "@playwright/test";
import {writeFile,mkdir,readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {PUBLIC_DEMOS} from "../lib/domain/publicDemoCatalog";
if(!process.argv.includes("--live")){console.log("DRY RUN: --live checks intentionally public synthetic demo links on desktop/mobile layouts; no owner/admin/model credential is used.");process.exit(0);}
const origin=new URL(PUBLIC_DEMOS[0].href).origin;
const browser=await chromium.launch({executablePath:resolve(".data/chrome/chrome-win64/chrome.exe"),args:["--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
await mkdir("docs/evidence/phase-7/public",{recursive:true});
try{
 const layouts=[];
 for(const [name,viewport]of [["desktop",{width:1440,height:1000}],["portrait",{width:390,height:844}]] as const){
  const context=await browser.newContext({viewport}),page=await context.newPage();
  try{const response=await page.goto(origin);expect(response?.status()).toBe(200);for(const demo of PUBLIC_DEMOS)await expect(page.getByRole("link",{name:demo.label,exact:true})).toHaveAttribute("href",demo.href);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`docs/evidence/phase-7/public/home-${name}.png`,fullPage:true});layouts.push({name,viewport,overflow:false});}finally{await context.close();}
 }
 const expected=JSON.parse(await readFile("docs/evidence/phase-7/production/playback-chrome.json","utf8")) as {manifestHash:string};
 const views=[];
 for(const demo of PUBLIC_DEMOS){const context=await browser.newContext(),page=await context.newPage();try{const response=await page.goto(demo.href);expect(response?.status()).toBe(200);await expect(page.getByText("Shared view · experimental · not reviewed",{exact:true})).toBeVisible();const player=page.getByRole("region",{name:"Saved signing companion"});await expect(player).toBeVisible();if(demo.id==="sample-a")await expect(player).toHaveAttribute("data-manifest-hash",expected.manifestHash);views.push({id:demo.id,status:response!.status(),readOnly:true,manifestHash:await player.getAttribute("data-manifest-hash")});}finally{await context.close();}}
 const result={date:new Date().toISOString(),origin,status:"PASS",browser:browser.version(),layouts,views,credentialFree:true,mobileLayoutOnly:true,physicalDevices:"NOT RUN",modelProcessingRequested:false};
 await writeFile("docs/evidence/phase-7/public/checks.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
}finally{await browser.close();}
