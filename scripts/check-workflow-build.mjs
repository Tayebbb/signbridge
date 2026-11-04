import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const manifest=JSON.parse(await readFile(".next/diagnostics/workflows-manifest.json","utf8"));
const ids=Object.values(manifest.steps??{}).flatMap(file=>Object.values(file).map(step=>step.stepId));
const expected=["claimWorkflow","meaningWorkflow","planWorkflow","publishWorkflow"];
const missing=expected.filter(name=>!ids.includes(`step//./lib/jobs/workflowSteps//${name}`));
console.log(JSON.stringify({registeredSteps:ids.length,requiredApplicationSteps:expected.length,missing,status:missing.length?"FAIL":"PASS"}));
assert.equal(missing.length,0,"Built Workflow must register every application step before deployment");
