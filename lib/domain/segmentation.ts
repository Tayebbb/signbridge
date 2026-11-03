import { sourceForm } from "./captions/textForms";
import type { Cue } from "./captions/shared";
export const SEGMENTER_VERSION = "segmenter-v1";
export interface Segment { idx: number; startMs: number; endMs: number; cueFrom: number; cueTo: number; sourceText: string }
export function segmentCues(cues: readonly Cue[]): Segment[] {
  const result: Segment[] = []; let group: Cue[] = [];
  const flush = () => {
    if (!group.length) return;
    result.push({ idx: result.length, startMs: group[0].startMs, endMs: group.at(-1)!.endMs, cueFrom: group[0].idx, cueTo: group.at(-1)!.idx, sourceText: sourceForm(group.map(c => c.text).join(" ")) }); group = [];
  };
  for (const cue of cues) {
    const text = sourceForm([...group.map(c => c.text), cue.text].join(" "));
    if (group.length && (cue.endMs - group[0].startMs > 12_000 || text.split(" ").length > 25)) flush();
    group.push(cue);
    if ((/[।?!\.৷]$/u.test(sourceForm(cue.text)) && cue.endMs - group[0].startMs >= 1500) || cue.endMs - group[0].startMs > 12_000 || sourceForm(group.map(c => c.text).join(" ")).split(" ").length > 25) flush();
  } flush(); return result;
}
export function contextWindow(segments: readonly Segment[], index: number, title: string) {
  if (!Number.isInteger(index) || index < 0 || index >= segments.length) throw new Error("Segment index outside context window");
  return { before: segments.slice(Math.max(0, index - 2), index).map(s => s.sourceText), after: segments.slice(index + 1, index + 2).map(s => s.sourceText), title: sourceForm(title) };
}
