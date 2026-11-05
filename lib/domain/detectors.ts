import { sourceForm } from "./captions/textForms";
export const NUMBER_WORDS: Readonly<Record<string, number>> = { "শূন্য": 0, "এক": 1, "দুই": 2, "দুটো": 2, "দুটি": 2, "তিন": 3, "তিনটি": 3, "তিনটে": 3, "চার": 4, "চারটি": 4, "পাঁচ": 5, "ছয়": 6, "সাত": 7, "আট": 8, "নয়": 9, "দশ": 10 };
const questionWords = new Set(["কি", "কী", "কে", "কেন", "কোথায়", "কখন", "কত"].map(sourceForm));
// These whole words end in the same letters as the negative suffix. This is a
// bounded lexical exception list, not a general Bangla morphological analyzer.
const nonNegativeNiWords = new Set(["পানি", "তিনি", "আপনি", "যিনি", "চিনি", "ধ্বনি", "কোম্পানি", "কাহিনি", "অমনি", "এমনি", "তেমনি", "খনি", "মনি", "মণি"].map(sourceForm));
export function detectSource(text: string) {
  const source = sourceForm(text), tokens = source.split(/[\s\p{P}\p{S}]+/u).filter(Boolean);
  const quantities: { surface: string; value: number }[] = [...source.matchAll(/[+−-]?[০-৯0-9]+(?:\.[০-৯0-9]+)?/gu)].map(match => {
    // An ASCII hyphen immediately after a number separates range endpoints.
    // Preserve real minus signs and hyphens introducing a standalone number.
    const surface = match[0].startsWith("-") && /[০-৯0-9]\s*$/u.test(source.slice(0, match.index)) ? match[0].slice(1) : match[0];
    return { surface, value: Number(surface.replace(/−/gu, "-").replace(/[০-৯]/gu, d => String(d.charCodeAt(0) - 0x09e6))) };
  });
  const negations: string[] = [];
  for (const token of tokens) {
    if (Object.hasOwn(NUMBER_WORDS, token)) quantities.push({ surface: token, value: NUMBER_WORDS[token] });
    if (["না", "নি", "নয়", "নেই"].map(sourceForm).includes(token)) negations.push(token);
    else if (token.length > 2 && token.endsWith("নি") && !nonNegativeNiWords.has(token)) negations.push("নি");
  }
  return { quantities, negations: [...new Set(negations)], question: source.includes("?") || tokens.some(t => questionWords.has(t)), whQuestion: tokens.some(t => questionWords.has(t) && !["কি", "কী"].includes(t)) };
}
