import {defineConfig} from "@playwright/test";
import workspace from "./playwright.workspace.config";
process.env.SIGNBRIDGE_EVIDENCE_PHASE="6";
export default defineConfig(workspace,{testMatch:/.*\.spec\.ts/u,reporter:[["list"],["json",{outputFile:"docs/evidence/phase-6/browser-results.json"}]]});
