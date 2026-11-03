"use client";
import { useState } from "react";
export default function EventSticker() {
  const [loaded, setLoaded] = useState(false);
  return <div className="sticker-slot" aria-label="Official event sticker slot">
    <img ref={node=>{if(!loaded&&node?.complete&&node.naturalWidth>0)setLoaded(true);}} src="/event-sticker.png" alt="Official event sticker" hidden={!loaded} width={160} height={90} loading="eager" decoding="async" onError={() => setLoaded(false)} onLoad={() => setLoaded(true)} />
    {!loaded && <span>Official event sticker<br /><strong>Awaiting official asset</strong></span>}
  </div>;
}
