import type { SegmentMeaning } from "../contracts/meaning";
import { phraseForm, retrievalForm } from "./captions/textForms";
import { NUMBER_WORDS } from "./detectors";
export interface SignAssetMetadata {
  id: string; kind: "lexical" | "sentence"; labelBn: string; labelPhraseForm: string; aliases: string[];
  derivedSha256: string; unitCount: number; eligible: boolean; estimatedDurationMs: number;
}
export interface SignAsset extends SignAssetMetadata { derivedSigml: string }
export interface Candidate<Asset extends SignAssetMetadata = SignAsset> { asset: Asset; conceptIds: string[]; exactPhrase: boolean; score: number }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const exactAlias = (text: string) => phraseForm(text).toLowerCase().replace(/[০-৯]/gu, d => String(d.charCodeAt(0) - 0x09e6));
export function retrieveCandidates<Asset extends SignAssetMetadata>(sourceText: string, meaning: SegmentMeaning, assets: readonly Asset[]): Candidate<Asset>[] {
  const found = new Map<string, Candidate<Asset>>();
  const eligible = assets.filter(a => a.eligible).slice().sort((a,b) => compare(a.id,b.id));
  const add = (asset: Asset, conceptIds: string[], exactPhrase: boolean, score: number) => {
    const existing = found.get(asset.id);
    found.set(asset.id, { asset, conceptIds: [...new Set([...(existing?.conceptIds ?? []), ...conceptIds])].sort(compare), exactPhrase: exactPhrase || !!existing?.exactPhrase, score: Math.max(score, existing?.score ?? 0) });
  };
  for (const asset of eligible) if (asset.kind === "sentence" && phraseForm(sourceText) === asset.labelPhraseForm) add(asset, meaning.concepts.map(c => c.id), true, 4);
  for (const concept of meaning.concepts) {
    const keys = [concept.lemmaBn, concept.surfaceBn];
    if (concept.numericValue !== null) { keys.push(String(concept.numericValue)); for (const [word,value] of Object.entries(NUMBER_WORDS)) if (value === concept.numericValue) keys.push(word); }
    const stems = keys.map(retrievalForm).filter(Boolean), exact = keys.map(exactAlias);
    const scored = eligible.filter(a => a.kind === "lexical").map(asset => {
      let score = 0;
      for (const alias of [asset.labelBn, ...asset.aliases]) {
        const stem = retrievalForm(alias);
        if (exact.includes(exactAlias(alias))) score = Math.max(score, 3);
        else if (stems.includes(stem) && stem) score = Math.max(score, 2);
        else if ([...stem].length >= 3 && stems.some(k => [...k].length >= 3 && (stem.startsWith(k) || k.startsWith(stem)))) score = Math.max(score, 1);
      }
      return { asset, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score-a.score || compare(a.asset.id,b.asset.id)).slice(0,8);
    for (const {asset,score} of scored) add(asset,[concept.id],false,score);
  }
  return [...found.values()].sort((a,b) => b.score-a.score || compare(a.asset.id,b.asset.id)).slice(0,150);
}
