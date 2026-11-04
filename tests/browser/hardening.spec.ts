import {test,expect} from "@playwright/test";
import {mkdir} from "node:fs/promises";
import {fakeEngine,create} from "./helpers";
import AxeBuilder from "@axe-core/playwright";
test.use({hasTouch:true});
test("Narrow touch playback reveals the avatar and idle visibility preserves completion",async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await fakeEngine(page);await create(page);await expect(page.locator(".renderer-area iframe")).toHaveCount(1);
 await page.getByRole("button",{name:"Play segment",exact:true}).tap();await expect(page.getByTestId("player-state")).toHaveText(/SignPlaying|Ready/,{timeout:20000});
 const rect=await page.locator(".renderer-area").boundingBox();expect(rect).not.toBeNull();expect(Math.min(rect!.y+rect!.height,844)-Math.max(rect!.y,0)).toBeGreaterThan(200);
 await expect(page.getByRole("heading",{name:"1 of 1 segments fully signed (experimental)",exact:true})).toBeVisible({timeout:30000});
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});});await expect(page.getByTestId("player-state")).toHaveText("Ready");
 await mkdir("docs/evidence/hardening-2026-11-05",{recursive:true});await page.screenshot({path:`docs/evidence/hardening-2026-11-05/mobile-play-${info.project.name}.png`,fullPage:true});
});
test("Creator can download a recovery key and restore access in a fresh browser context",async({page,browser})=>{
 await fakeEngine(page);await create(page);const url=page.url();await page.getByText("Save creator recovery key",{exact:true}).click();await page.getByRole("button",{name:"Create recovery key",exact:true}).click();const key=await page.getByLabel("Recovery key",{exact:true}).inputValue();expect(key).toHaveLength(43);
 const context=await browser.newContext();try{const other=await context.newPage();await fakeEngine(other);await other.goto(new URL("/recover",url).href);await other.getByLabel("Recovery key",{exact:true}).fill(key);await other.getByRole("button",{name:"Restore access",exact:true}).click();await expect(other.getByText("Creator access restored.",{exact:false})).toBeVisible();await other.goto(url);await expect(other.getByRole("region",{name:"Saved signing companion"})).toBeVisible();await page.reload();await expect(page.getByText("Loading your project…")).toHaveCount(0);await expect(page.getByRole("region",{name:"Saved signing companion"})).toHaveCount(0);}finally{await context.close();}
});
test("Home, recovery and player controls pass selected WCAG scans with a keyboard bypass",async({page},info)=>{
 const results=[];for(const path of ["/","/recover"]){await page.goto(path);const scan=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(scan.violations).toEqual([]);results.push({path,violations:scan.violations,incomplete:scan.incomplete.map(r=>r.id)});}
 await page.goto("/");await page.keyboard.press("Tab");await expect(page.getByRole("link",{name:"Skip to content"})).toBeFocused();await page.keyboard.press("Enter");await expect(page.locator("main")).toBeFocused();
 await fakeEngine(page);await create(page);const scan=await new AxeBuilder({page}).exclude("iframe").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(scan.violations).toEqual([]);results.push({path:"/p/:id",violations:scan.violations,incomplete:scan.incomplete.map(r=>r.id)});
 await mkdir("docs/evidence/hardening-2026-11-05",{recursive:true});const {writeFile}=await import("node:fs/promises");await writeFile(`docs/evidence/hardening-2026-11-05/accessibility-${info.project.name}.json`,JSON.stringify({scope:"Selected parent-document checks; opaque rendering frame excluded; not WCAG certification or physical-device evidence",results},null,2));
 await page.screenshot({path:`docs/evidence/hardening-2026-11-05/workspace-${info.project.name}.png`,fullPage:true});
});
