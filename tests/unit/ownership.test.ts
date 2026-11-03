import { test, expect } from "vitest";
import { ESLint } from "eslint";
test("P1-BOUNDARIES: lint rejects OpenAI, database transitions and CWASA outside owners", async () => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText("import OpenAI from 'openai';\nimport { getDatabase } from '@/lib/db/client';\nconst db = getDatabase(); db.update({}); window.CWASA.init();\nexport { OpenAI };", { filePath: "app/ownership-probe.ts" });
  expect(result.messages.filter(m => m.ruleId === "no-restricted-imports")).toHaveLength(2);
  expect(result.messages.filter(m => m.ruleId === "no-restricted-syntax")).toHaveLength(2);
  const [owned] = await eslint.lintText("import OpenAI from 'openai';\nexport { OpenAI };", { filePath: "lib/ai/ownership-probe.ts" });
  expect(owned.messages.filter(m => m.ruleId === "no-restricted-imports")).toEqual([]);
});
test("Phase 2: pure modules reject filesystem/network/environment imports while allowing CPU hashes",async()=>{
  const eslint=new ESLint();
  const [bad]=await eslint.lintText("import { readFile } from 'node:fs';\nexport const value = () => fetch(process.env.URL);\nexport { readFile };",{filePath:"lib/domain/purity-probe.ts"});
  expect(bad.messages.filter(m=>m.ruleId==="no-restricted-imports")).toHaveLength(1);
  expect(bad.messages.filter(m=>m.ruleId==="no-restricted-globals")).toHaveLength(2);
  const [cpu]=await eslint.lintText("import { createHash } from 'node:crypto';\nexport { createHash };",{filePath:"lib/domain/purity-probe.ts"});
  expect(cpu.messages.filter(m=>m.ruleId==="no-restricted-imports")).toEqual([]);
});
