import { sourceForm } from "./textForms";
export interface Cue { idx: number; startMs: number; endMs: number; text: string }
export type CaptionErrorCode = "caption_too_large" | "too_many_cues" | "caption_duration_exceeded" | "invalid_timestamp" | "invalid_cue" | "empty_caption";
export class CaptionError extends Error {
  constructor(public readonly code: CaptionErrorCode, message: string, public readonly line: number, public readonly cue: number | null = null) { super(message); this.name = "CaptionError"; }
}
export function captionLines(input: string): string[] {
  if (typeof input !== "string") throw new CaptionError("invalid_cue", "Caption input must be text", 1);
  if (input.length > 65_536 || new TextEncoder().encode(input).length > 65_536) throw new CaptionError("caption_too_large", "Captions exceed 64 KB", 1);
  return input.replace(/^\ufeff/u, "").replace(/\r\n?/gu, "\n").split("\n");
}
export function timestamp(value: string, line: number, cue: number): number {
  const match = /^(?:(\d{2}):)?(\d{2}):(\d{2})[.,](\d{3})$/u.exec(value);
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) throw new CaptionError("invalid_timestamp", "Invalid caption timestamp", line, cue);
  return ((Number(match[1] ?? 0) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000 + Number(match[4]);
}
export function validateCues(cues: Cue[], lines: number[]): Cue[] {
  if (!cues.length) throw new CaptionError("empty_caption", "No caption cues found", 1);
  if (cues.length > 300) throw new CaptionError("too_many_cues", "Captions exceed 300 cues", lines[300], 300);
  return cues.map((cue, idx) => {
    if (cue.endMs > 90_000) throw new CaptionError("caption_duration_exceeded", "Caption extends past 90 seconds", lines[idx], idx);
    if (cue.endMs <= cue.startMs || cue.startMs < 0 || (idx > 0 && cue.startMs < cues[idx - 1].startMs)) throw new CaptionError("invalid_cue", "Invalid or unordered cue range", lines[idx], idx);
    const text = sourceForm(cue.text);
    if (!text) throw new CaptionError("invalid_cue", "Caption cue is empty", lines[idx], idx);
    return { ...cue, idx, text };
  });
}
export function timedBlocks(input: string, mode: "srt" | "vtt"): Cue[] {
  const lines = captionLines(input); let cursor = 0;
  if (mode === "vtt") {
    if (!/^WEBVTT(?:[ \t].*)?$/u.test(lines[0])) throw new CaptionError("invalid_cue", "WEBVTT header missing", 1);
    cursor = 1; while (cursor < lines.length && lines[cursor].trim()) cursor++;
  }
  const cues: Cue[] = [], sourceLines: number[] = [];
  while (cursor < lines.length) {
    while (cursor < lines.length && !lines[cursor].trim()) cursor++;
    if (cursor === lines.length) break;
    const start = cursor; while (cursor < lines.length && lines[cursor].trim()) cursor++;
    const block = lines.slice(start, cursor);
    if (mode === "vtt" && /^(NOTE(?:\s|$)|STYLE$|REGION$)/u.test(block[0])) continue;
    if (cues.length === 300) throw new CaptionError("too_many_cues", "Captions exceed 300 cues", start + 1, 300);
    const timeOffset = block[0].includes("-->") ? 0 : 1;
    if (mode === "srt" && (timeOffset !== 1 || !/^\d+$/u.test(block[0]))) throw new CaptionError("invalid_cue", "SRT cue number missing", start + 1, cues.length);
    const timing = block[timeOffset]?.trim().split(/\s+/u);
    if (!timing || timing[1] !== "-->" || !timing[2] || (mode === "srt" && timing.length !== 3)) throw new CaptionError("invalid_cue", "Cue timestamp range missing", start + timeOffset + 1, cues.length);
    if (mode === "srt" && (!/^\d{2}:\d{2}:\d{2},\d{3}$/u.test(timing[0]) || !/^\d{2}:\d{2}:\d{2},\d{3}$/u.test(timing[2]))) throw new CaptionError("invalid_timestamp", "SRT timestamps require HH:MM:SS,mmm", start + timeOffset + 1, cues.length);
    if (mode === "vtt" && (!/^(?:\d{2}:)?\d{2}:\d{2}\.\d{3}$/u.test(timing[0]) || !/^(?:\d{2}:)?\d{2}:\d{2}\.\d{3}$/u.test(timing[2]))) throw new CaptionError("invalid_timestamp", "VTT timestamps require a decimal point", start + timeOffset + 1, cues.length);
    const startMs = timestamp(timing[0], start + timeOffset + 1, cues.length), endMs = timestamp(timing[2], start + timeOffset + 1, cues.length);
    sourceLines.push(start + 1); cues.push({ idx: cues.length, startMs, endMs, text: block.slice(timeOffset + 1).join(" ") });
  }
  return validateCues(cues, sourceLines);
}
