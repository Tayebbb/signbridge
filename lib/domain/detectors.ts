import { sourceForm } from "./captions/textForms";
export const NUMBER_WORDS: Readonly<Record<string, number>> = { "শূন্য": 0, "এক": 1, "দুই": 2, "দুটো": 2, "দুটি": 2, "তিন": 3, "তিনটি": 3, "তিনটে": 3, "চার": 4, "চারটি": 4, "পাঁচ": 5, "ছয়": 6, "সাত": 7, "আট": 8, "নয়": 9, "দশ": 10 };
const questionWords = new Set(["কি", "কী", "কে", "কেন", "কোথায়", "কখন", "কত"].map(sourceForm));
export function detectSource(text: string) {
  const source = sourceForm(text), tokens = source.split(/[\s\p{P}\p{S}]+/u).filter(Boolean);
  const quantities: { surface: string; value: number }[] = [...source.matchAll(/[+−-]?[০-৯0-9]+(?:\.[০-৯0-9]+)?/gu)].map(match=>({surface:match[0],value:Number(match[0].replace(/−/gu,"-").replace(/[০-৯]/gu,d=>String(d.charCodeAt(0)-0x09e6)))}));
  const negations: string[] = [];
  for (const token of tokens) {
    if (Object.hasOwn(NUMBER_WORDS, token)) quantities.push({ surface: token, value: NUMBER_WORDS[token] });
    if (["না", "নি", "নয়", "নেই"].map(sourceForm).includes(token)) negations.push(token);
    else if (token.length > 2 && token.endsWith("নি")) negations.push("নি");
  }
  return { quantities, negations: [...new Set(negations)], question: source.includes("?") || tokens.some(t => questionWords.has(t)), whQuestion: tokens.some(t => questionWords.has(t) && !["কি", "কী"].includes(t)) };
}
