import {defineConfig,devices} from "@playwright/test";
import {resolve} from "node:path";
const args=["--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"];
export default defineConfig({
 testDir:"./tests/production",timeout:360000,workers:1,retries:0,
 reporter:[["list"],["json",{outputFile:".data/remote-browser-results.json"}]],outputDir:".data/remote-test-results",
 use:{viewport:{width:1440,height:1100},video:"on",trace:"off",actionTimeout:15000},
 projects:[
  {name:"chrome",use:{...devices["Desktop Chrome"],launchOptions:{executablePath:resolve(".data/chrome/chrome-win64/chrome.exe"),args}}},
  {name:"msedge",use:{...devices["Desktop Edge"],channel:"msedge",launchOptions:{args}}},
 ],
});
