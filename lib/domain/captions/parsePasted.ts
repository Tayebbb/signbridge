import { CaptionError, captionLines, timestamp, validateCues, type Cue } from "./shared";
/** Next timestamp closes a cue; the caller supplies the final clip boundary. */
export function parsePasted(input: string, durationMs = 90_000): Cue[] {
  if (!Number.isInteger(durationMs) || durationMs <= 0 || durationMs > 90_000) throw new CaptionError("caption_duration_exceeded", "Clip duration must be within 90 seconds", 1);
  const lines = captionLines(input), cues: Cue[] = [], sourceLines: number[] = [];
  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    if (cues.length === 300) throw new CaptionError("too_many_cues", "Captions exceed 300 cues", idx + 1, 300);
    const match = /^\[(\d{2}:\d{2}\.\d{3})\]\s+(.+)$/u.exec(line);
    if (!match) throw new CaptionError("invalid_cue", "Expected [mm:ss.mmm] text", idx + 1, cues.length);
    const startMs = timestamp(match[1], idx + 1, cues.length);
    if (cues.length) cues[cues.length - 1].endMs = startMs;
    sourceLines.push(idx + 1); cues.push({ idx: cues.length, startMs, endMs: durationMs, text: match[2] });
  }); return validateCues(cues, sourceLines);
}
