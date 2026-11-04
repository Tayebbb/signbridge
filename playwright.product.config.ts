import {defineConfig} from "@playwright/test";
import workspace from "./playwright.workspace.config";
process.env.SIGNBRIDGE_EVIDENCE_PHASE??="6";
const evidenceRoot=process.env.SIGNBRIDGE_EVIDENCE_PHASE==="7"?"docs/evidence/phase-7/recheck":"docs/evidence/phase-6";
export default defineConfig(workspace,{testMatch:/.*\.spec\.ts/u,reporter:[["list"],["json",{outputFile:`${evidenceRoot}/browser-results.json`}]]});
