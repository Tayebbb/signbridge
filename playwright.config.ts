import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
const edgeAvailable = existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe") || existsSync("C:/Program Files/Microsoft/Edge/Application/msedge.exe");
export default defineConfig({
  testDir: "./tests/e2e", timeout: 120_000, workers: 1, retries: 0,
  reporter: [["list"], ["json", { outputFile: process.env.SIGNBRIDGE_EVIDENCE_PHASE==="8"?"docs/evidence/final/foundation-browser-results.json":process.env.SIGNBRIDGE_EVIDENCE_PHASE==="6"?"docs/evidence/phase-6/foundation-browser-results.json":"docs/evidence/playwright-results.json" }]],
  use: { baseURL: "http://127.0.0.1:43181", viewport: { width: 1400, height: 1100 },
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-webgl", "--enable-unsafe-swiftshader"] } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, ...(edgeAvailable ? [{ name: "msedge", use: { ...devices["Desktop Edge"], channel: "msedge" } }] : [])],
  webServer: { command: "npm run db:migrate && npm run build && npm run start -- --port 43181", url: "http://127.0.0.1:43181/api/health", reuseExistingServer: false, timeout: 180_000,env:{DATABASE_URL:"",PGLITE_DATA_DIR:".data/browser-phase8-foundation",PROCESSING_ENABLED:"false",MODEL_DRIVER:"fake",JOB_DRIVER:"in-process",BLOB_DRIVER:"filesystem",LOCAL_BLOB_DIR:".data/browser-phase8-foundation-blob",OPENAI_API_KEY:"",VERCEL:""} },
});
