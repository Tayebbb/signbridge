import { test, expect } from "@playwright/test";
import {mkdir} from "node:fs/promises";

for(const entry of [{path:"/",field:"Clip title",button:"Create a project"},{path:"/recover",field:"Recovery key",button:"Restore access"}]){
  test(`Hydration: ${entry.path} controls wait for their event handlers`,async({page},info)=>{
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route("**/_next/static/**",async route=>{if(route.request().resourceType()==="script")await gate;await route.continue();});
    try{
      await page.goto(entry.path,{waitUntil:"domcontentloaded"});
      await expect(page.getByLabel(entry.field,{exact:true})).toBeDisabled();
      await expect(page.getByRole("button",{name:entry.button,exact:true})).toBeDisabled();
      expect(new URL(page.url()).search).toBe("");
      await mkdir(".data/hydration-visual",{recursive:true});const image=`.data/hydration-visual/${info.project.name}-${entry.path==="/"?"create":"recover"}`;
      await page.screenshot({path:image+"-loading.png",fullPage:true});
      release();
      await expect(page.getByLabel(entry.field,{exact:true})).toBeEnabled();
      await expect(page.getByRole("button",{name:entry.button,exact:true})).toBeEnabled();
      await page.screenshot({path:image+"-ready.png",fullPage:true});await page.setViewportSize({width:390,height:844});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:image+"-mobile.png",fullPage:true});await page.setViewportSize({width:1400,height:1100});
      if(entry.path==="/"){
        await page.getByLabel("Clip title",{exact:true}).fill("Hydrated project creation");
        await page.getByRole("checkbox",{name:"I have permission to use the clip and captions.",exact:true}).check();
        await page.getByRole("button",{name:entry.button,exact:true}).click();
        await expect(page).toHaveURL(/\/p\/[a-f0-9-]+$/u);
      }
    }finally{release();await page.unrouteAll({behavior:"wait"});}
  });
}
test("P1-HEALTH: live DB round trip and honest global banner/footer", async ({ page, request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ db: "ok", processing: "disabled", renderer: "remote" });
  for (const path of ["/", "/about", "/p/foundation", "/s/foundation"]) {
    await page.goto(path);
    await expect(page.getByText("Experimental · not reviewed by BdSL signers", { exact: true })).toBeVisible();
    await expect(page.getByAltText("Official event sticker")).toBeVisible();
    await expect(page.locator("footer")).toContainText("IsharaKotha v2");
    await expect(page.locator("footer")).toContainText("UEA CWASA");
  }
});

test("Browser CSP permits the presigned Blob upload endpoint and blocks unrelated Vercel APIs",async({page})=>{
  const uploads:string[]=[],unrelated:string[]=[];
  // Intercept transport only. The document's real production CSP still decides if a request is sent.
  await page.route("https://vercel.com/**",async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(request.method()!=="OPTIONS"){if(path==="/api/blob/")uploads.push(path);else unrelated.push(path);}
    await route.fulfill({status:request.method()==="OPTIONS"?204:201,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"PUT,GET,OPTIONS","Access-Control-Allow-Headers":"content-type"},body:""});
  });
  await page.goto("/");
  const result=await page.evaluate(async()=>{
    const upload=await fetch("https://vercel.com/api/blob/?fixture=presigned-upload",{method:"PUT",headers:{"Content-Type":"video/mp4"},body:new Uint8Array([0,1])}).then(r=>r.status).catch(()=>0);
    const other=await fetch("https://vercel.com/api/unrelated-test").then(r=>r.status).catch(()=>0);
    return {upload,other};
  });
  expect(result.upload).toBe(201);expect(result.other).toBe(0);
  expect(uploads).toEqual(["/api/blob/"]);expect(unrelated).toEqual([]);
});
