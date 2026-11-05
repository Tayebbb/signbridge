import { expect, test } from "vitest";
import { detectSource } from "@/lib/domain/detectors";
import { validateMeaning } from "@/lib/domain/validators";
import { meaning } from "../fixtures/domain";

test.each(["৭০-৮০", "70-80", "৭০–৮০", "৭০ - ৮০"])("range endpoints are positive quantities: %s", text => {
  expect(detectSource(text).quantities.map(q => q.value)).toEqual([70, 80]);
  expect(detectSource(text).quantities[1].surface).toMatch(/^(৮০|80)$/u);
});

test("actual signed numbers remain signed, including negative range endpoints", () => {
  expect(detectSource("−২.৫–−১.৫ এবং -80 ও +3").quantities).toEqual([
    { surface: "−২.৫", value: -2.5 }, { surface: "−১.৫", value: -1.5 },
    { surface: "-80", value: -80 }, { surface: "+3", value: 3 },
  ]);
});

test.each(["পানি", "তিনি", "আপনি", "যিনি", "চিনি", "ধ্বনি", "কোম্পানি", "কাহিনি"])("ordinary word %s does not fabricate a negation", word => {
  expect(detectSource(word).negations).toEqual([]);
});

test.each(["করিনি", "কিনিনি", "আসেনি", "যায়নি"])("negative verb %s still requires negation", word => {
  expect(detectSource(word).negations).toEqual(["নি"]);
  expect(validateMeaning(meaning(), word).issues).toContainEqual(expect.objectContaining({ code: "M3", message: expect.stringContaining("negation") }));
});

test("range quantities validate without an invented negative endpoint, while omitted endpoints still fail", () => {
  const output = meaning();
  output.concepts = [70, 80].map((value, index) => ({
    id: `c${index + 1}`, role: "quantity" as const, surfaceBn: String(value), lemmaBn: String(value),
    numericValue: value, critical: true, referentId: null,
  }));
  output.propositions = [];
  expect(validateMeaning(output, "70-80").issues).toEqual([]);
  output.concepts.pop();
  expect(validateMeaning(output, "70-80").issues).toContainEqual(expect.objectContaining({ code: "M3", message: expect.stringContaining("80") }));
});
