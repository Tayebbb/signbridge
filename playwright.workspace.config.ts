import {defineConfig,devices} from "@playwright/test";
import {existsSync} from "node:fs";
const evidenceRoot=process.env.SIGNBRIDGE_EVIDENCE_PHASE==="7"?"docs/evidence/phase-7/recheck":process.env.SIGNBRIDGE_EVIDENCE_PHASE==="6"?"docs/evidence/phase-6":"docs/evidence/phase-5";
const edgeAvailable=existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")||existsSync("C:/Program Files/Microsoft/Edge/Application/msedge.exe")||existsSync("/opt/microsoft/msedge/msedge");
export default defineConfig({
  testDir:"./tests/browser",testMatch:"workspace.spec.ts",timeout:120000,workers:1,retries:0,
  reporter:[["list"],["json",{outputFile:`${evidenceRoot}/browser-results.json`}]],
  use:{baseURL:"http://127.0.0.1:43182",viewport:{width:1440,height:1100},launchOptions:{args:["--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]}},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}},...(edgeAvailable?[{name:"msedge",use:{...devices["Desktop Edge"],channel:"msedge"}}]:[])],
  webServer:{command:`npx tsx scripts/reset-browser.ts && npm run db:seed:local && ${process.env.SIGNBRIDGE_PRODUCT_PREBUILT==="true"?"":"npm run build && "}npm run start -- --port 43182`,url:"http://127.0.0.1:43182/api/health",reuseExistingServer:false,timeout:180000,env:{DATABASE_URL:"",PGLITE_DATA_DIR:".data/browser-phase5",PROCESSING_ENABLED:"true",MODEL_DRIVER:"fake",JOB_DRIVER:"in-process",BLOB_DRIVER:"filesystem",LOCAL_BLOB_DIR:".data/browser-phase5-blobs",OPENAI_API_KEY:"",ADMIN_TOKEN:"browser-fixture-admin",CRON_SECRET:"",APP_ORIGIN:""}},
});
