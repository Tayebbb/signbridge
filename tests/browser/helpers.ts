import {expect,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
export async function fakeEngine(page:Page,fault="none"){const source=await readFile("lib/player/fakeEngine.js","utf8");await page.route("https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/cwa/allcsa.js",route=>route.fulfill({contentType:"application/javascript",body:source.replace('const fault="none"',`const fault="${fault}"`)}));}
export async function create(page:Page,text="কক্সবাজার অতিথি আঙুল।",origin=""){
  await page.goto(origin||"/");await page.getByLabel("Clip title").fill("Technical playback fixture");await page.getByRole("checkbox",{name:"I have permission to use the clip and captions."}).check();await page.getByRole("button",{name:"Create a project",exact:true}).click();await expect(page).toHaveURL(/\/p\/[a-f0-9-]+$/u);
  await page.getByLabel("Source video",{exact:true}).setInputFiles("tests/fixtures/clip.mp4");await page.getByLabel("Bangla captions").fill(`1\n00:00:00,000 --> 00:00:02,000\n${text}`);await page.getByRole("checkbox",{name:"I have permission to use this clip and captions."}).check();await page.getByRole("button",{name:"Upload and preview captions"}).click();
  await expect(page.getByRole("button",{name:"Build signing companion"})).toBeVisible();await page.getByRole("button",{name:"Build signing companion"}).click();await expect(page.getByRole("region",{name:"Saved signing companion"})).toBeVisible({timeout:30000});
  await expect(page.getByTestId("player-state")).toHaveText("Ready",{timeout:60000});
}
