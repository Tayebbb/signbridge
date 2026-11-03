export const SOURCE_FORM_VERSION = "src-v1";
export const TEXT_FORMS_VERSION = "text-forms-v1";
const formattingTags = new Set(["b", "i", "u", "c", "v", "lang", "ruby", "rt", "font"]);
/** Unknown HTML, including script, remains literal plain text. */
export function sourceForm(text: string): string {
  return text.normalize("NFC").replace(/<[^<>]*>/gu, tag => {
    const name = tag.slice(1, -1).trim().replace(/^\//u, "").split(/[\s.]/u)[0].toLowerCase();
    return formattingTags.has(name) || /^\d{2}:\d{2}/u.test(name) ? "" : tag;
  }).replace(/\{\\[^{}]*\}/gu, "").replace(/\u09f7/gu, "।").replace(/\s+/gu, " ").trim();
}
export function phraseForm(text: string): string { return sourceForm(text).replace(/[\u200c\u200d]/gu, "").replace(/[।.]$/u, ""); }
export const INFLECTION_SUFFIXES = ["েছিলাম", "েছিল", "েছি", "িনি", "গুলো", "গুলি", "দের", "লাম", "ছি", "ছে", "বে", "নি", "টা", "টি", "টে", "রা", "কে", "তে", "এর", "র"] as const;
export function retrievalForm(text: string): string {
  const normalized = phraseForm(text).replace(/\u09a1\u09bc/gu, "ড়").replace(/\u09a2\u09bc/gu, "ঢ়").replace(/\u09af\u09bc/gu, "য়").replace(/[০-৯]/gu, digit => String(digit.charCodeAt(0) - 0x09e6)).replace(/[\p{P}\p{S}]/gu, " ").toLowerCase();
  return normalized.split(/\s+/u).filter(Boolean).map(word => {
    const suffix = INFLECTION_SUFFIXES.find(s => word.endsWith(s) && [...word.slice(0, -s.length)].length >= 2);
    return suffix ? word.slice(0, -suffix.length) : word;
  }).join(" ");
}
