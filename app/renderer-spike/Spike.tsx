"use client";
import { useEffect, useRef, useState } from "react";
import { attachRendererSpike, type RendererEvent } from "@/lib/player/rendererHost";
export default function Spike() {
  const frame = useRef<HTMLIFrameElement>(null);
  const host = useRef<ReturnType<typeof attachRendererSpike> | null>(null);
  const [events, setEvents] = useState<RendererEvent[]>([]);
  useEffect(() => {
    if (!frame.current) return;
    const active = attachRendererSpike(frame.current, event => setEvents(previous => [...previous.slice(-1199), event]));
    host.current = active;
    return () => { active.dispose(); host.current = null; };
  }, []);
  const ready = events.some(e => e.type === "avatarready");
  const started = events.some(e => e.type === "animactive" && e.gen === 1);
  async function play() {
    const response = await fetch("/fixtures/cross-file-case-1.sigml");
    if (!response.ok) throw new Error("Technical fixture missing");
    host.current?.play(await response.text());
  }
  return <><div className="spike-status" role="status" data-testid="engine-status">{ready ? "Avatar ready · technical rendering only" : "Loading remote avatar…"}</div>
    <p><button onClick={play} disabled={!ready || started}>Animate technical fixture</button>{" "}<button onClick={() => host.current?.probeHealth()} disabled={!ready}>Probe cookie isolation</button></p>
    <iframe ref={frame} title="Isolated CWASA renderer" sandbox="allow-scripts" />
    <details><summary>Technical hook events</summary><pre data-testid="renderer-events">{JSON.stringify(events)}</pre></details></>;
}
