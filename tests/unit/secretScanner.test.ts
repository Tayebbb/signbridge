import { test, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { scanText, scanBytes, marker } from "../../scripts/check-secrets.mjs";
test("P1-BOUNDARIES: scanner rejects new markers even inside baseline documents", async () => {
  expect(scanText("lib/example.ts", `const key='${marker}synthetic-test'`)).toEqual(["lib/example.ts:1"]);
  const design = await readFile("SYSTEM-DESIGN.md", "utf8");
  expect(scanText("SYSTEM-DESIGN.md", design)).toEqual([]);
  expect(scanText("SYSTEM-DESIGN.md", design + `\n${marker}synthetic-test`)).toHaveLength(1);
});
test("Binary artifacts permit incidental marker bytes but reject embedded credential tokens", () => {
  const prefix=Buffer.from([137,80,78,71,13,10,26,10,0]);
  expect(scanBytes("render.png",Buffer.concat([prefix,Buffer.from(marker),Buffer.from([255,0])]))).toEqual([]);
  const credential=marker+"synthetic".repeat(8);
  expect(scanBytes("render.png",Buffer.concat([prefix,Buffer.from(credential)]))).toEqual(["render.png:byte 9"]);
  expect(scanBytes("deck.pdf",Buffer.from("%PDF-1.4\n"+credential))).toEqual(["deck.pdf:byte 9"]);
});
test("Byte-based entry point preserves strict text markers and the immutable design baseline", async () => {
  expect(scanBytes("notes.md",Buffer.from(marker+"short"))).toEqual(["notes.md:1"]);
  const design=await readFile("SYSTEM-DESIGN.md");
  expect(scanBytes("SYSTEM-DESIGN.md",design)).toEqual([]);
  expect(scanBytes("SYSTEM-DESIGN.md",Buffer.concat([design,Buffer.from("\n"+marker+"short")]))).toHaveLength(1);
});
