import { test, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { scanText, marker } from "../../scripts/check-secrets.mjs";
test("P1-BOUNDARIES: scanner rejects new markers even inside baseline documents", async () => {
  expect(scanText("lib/example.ts", `const key='${marker}synthetic-test'`)).toEqual(["lib/example.ts:1"]);
  const design = await readFile("SYSTEM-DESIGN.md", "utf8");
  expect(scanText("SYSTEM-DESIGN.md", design)).toEqual([]);
  expect(scanText("SYSTEM-DESIGN.md", design + `\n${marker}synthetic-test`)).toHaveLength(1);
});
