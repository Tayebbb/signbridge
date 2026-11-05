import { createHash } from "node:crypto";
import { SOURCE_FORM_VERSION, TEXT_FORMS_VERSION, sourceForm } from "./captions/textForms";
import { SEGMENTER_VERSION } from "./segmentation";
export const RETRIEVAL_VERSION = "retrieval-v2", CORPUS_RELEASE_ID = "ik2-mendeley-v2", VALIDATOR_VERSION = "validator-v2";
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(item: unknown): string {
    if (item === null) return "null";
    if (typeof item === "string") return JSON.stringify(item.normalize("NFC"));
    if (typeof item === "boolean") return String(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== "object" || !item || (Object.getPrototypeOf(item) !== Object.prototype && !Array.isArray(item) && Object.getPrototypeOf(item) !== null)) throw new Error("Canonical JSON requires finite JSON values");
    if (ancestors.has(item)) throw new Error("Canonical JSON rejects cycles");
    ancestors.add(item); let result: string;
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length) throw new Error("Canonical JSON rejects sparse arrays");
      result = `[${item.map(encode).join(",")}]`;
    } else {
      const keys = Object.keys(item).map(original => ({ original, normalized: original.normalize("NFC") })).sort((a, b) => a.normalized < b.normalized ? -1 : a.normalized > b.normalized ? 1 : 0);
      if (new Set(keys.map(k => k.normalized)).size !== keys.length) throw new Error("NFC object key collision");
      result = `{${keys.map(k => `${JSON.stringify(k.normalized)}:${encode((item as Record<string, unknown>)[k.original])}`).join(",")}}`;
    } ancestors.delete(item); return result;
  } return encode(value);
}
export const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const hash = (value: unknown) => sha256(canonicalJson(value));
export function segmentKey(segment: { sourceText: string }, context: { before: readonly string[]; after: readonly string[]; title: string }) {
  return `s2:${hash({ sourceForm: SOURCE_FORM_VERSION, segmenter: SEGMENTER_VERSION, text: sourceForm(segment.sourceText), before: context.before.slice(-2).map(sourceForm), after: context.after.slice(0, 1).map(sourceForm), title: sourceForm(context.title) })}`;
}
export interface ModelKeyConfig { model: string; effort: string; promptVersion: string; validatorVersion: string }
export function meaningKey(segmentKey: string, config: ModelKeyConfig) { return `m2:${hash({ segmentKey, stage: "meaning", ...config, schemaVersion: "meaning-v2" })}`; }
export function candidatesHash(candidates: readonly { id: string; derivedSha256: string }[], versions = { retrieval: RETRIEVAL_VERSION, textForms: TEXT_FORMS_VERSION, corpus: CORPUS_RELEASE_ID }) {
  return `c1:${hash({ ...versions, assets: candidates.map(a => [a.id, a.derivedSha256]).sort() })}`;
}
export function planKey(meaningOutputHash: string, candidatesHash: string, config: ModelKeyConfig) { return `p2:${hash({ meaningOutputHash, candidatesHash, stage: "plan", ...config, schemaVersion: "plan-v2" })}`; }
export const manifestHash = (manifest: unknown) => hash(manifest);
export function trackFingerprint(manifest: { trackVersionId: string; [key: string]: unknown }) { const copy = { ...manifest }; Reflect.deleteProperty(copy, "trackVersionId"); return `t2:${hash(copy)}`; }
/** Deterministic custom UUID (version 8), allocated before embedding the track identity. */
export function trackIdFor(jobId:string,fingerprint:string) {const bytes=hash({jobId,fingerprint}).slice(0,32).split("");bytes[12]="8";bytes[16]=((parseInt(bytes[16],16)&3)|8).toString(16);const hex=bytes.join("");return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
