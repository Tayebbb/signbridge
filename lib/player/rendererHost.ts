import { z } from "zod";
const envelope = { instanceId: z.uuid(), gen: z.number().int().nonnegative() };
export const rendererEventSchema = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("avatarready"), payload: z.null() }),
  z.object({ ...envelope, type: z.literal("sigmlloaded"), payload: z.object({ s: z.number().int().nonnegative(), f: z.number().int().nonnegative() }) }),
  z.object({ ...envelope, type: z.enum(["animactive", "animidle"]), payload: z.null() }),
  z.object({ ...envelope, type: z.literal("avatarsign"), payload: z.object({ g: z.string(), s: z.number().int(), f: z.number().int() }) }),
  z.object({ ...envelope, type: z.literal("avatarframe"), payload: z.object({ s: z.number().int(), f: z.number().int() }) }),
  z.object({ ...envelope, type: z.literal("cspviolation"), payload: z.object({ directive: z.string(), blockedURI: z.string() }) }),
  z.object({ ...envelope, type: z.literal("engineerror"), payload: z.object({ message: z.string() }) }),
  z.object({ ...envelope, type: z.literal("healthprobe"), payload: z.object({ settled: z.boolean(), readable: z.boolean() }) }),
]);
export type RendererEvent = z.infer<typeof rendererEventSchema>;
export function validateRendererEvent(event: Pick<MessageEvent, "source" | "data">, source: MessageEventSource | null, instanceId: string): RendererEvent | null {
  if (!source || event.source !== source) return null;
  const result = rendererEventSchema.safeParse(event.data);
  return result.success && result.data.instanceId === instanceId ? result.data : null;
}
/** Phase-1 spike host only. TODO(phase-5): scheduler, cancellation and standby instances. */
export function attachRendererSpike(frame: HTMLIFrameElement, onEvent: (event: RendererEvent) => void) {
  const instanceId = crypto.randomUUID();
  const receive = (event: MessageEvent) => {
    const valid = validateRendererEvent(event, frame.contentWindow, instanceId);
    if (valid) onEvent(valid);
  };
  window.addEventListener("message", receive);
  frame.src = `/renderer.html?instanceId=${instanceId}&parentOrigin=${encodeURIComponent(location.origin)}`;
  return {
    play(sigml: string) { frame.contentWindow?.postMessage({ instanceId, gen: 1, type: "play", sigml }, "*"); },
    probeHealth() { frame.contentWindow?.postMessage({ instanceId, type: "probe-health" }, "*"); },
    dispose() { window.removeEventListener("message", receive); frame.removeAttribute("src"); },
  };
}
