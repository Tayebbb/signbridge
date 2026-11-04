import { test, expect } from "@playwright/test";
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
