"use client";
import { useState } from "react";
import {getImageProps} from "next/image";
export default function EventSticker() {
  const [loaded, setLoaded] = useState(false);
  const {props}=getImageProps({src:"/event-sticker.png",alt:"Official event sticker",width:2000,height:710,sizes:"(max-width:700px) 124px, 218px",loading:"eager"});
  return <div className="sticker-slot" aria-label="Official event sticker slot">
    {/* CSS owns presentation; omit Next's default inline color style under the nonce-only CSP. */}
    <img {...props} alt="Official event sticker" style={undefined} ref={node=>{if(!loaded&&node?.complete&&node.naturalWidth>0)setLoaded(true);}} hidden={!loaded} onError={() => setLoaded(false)} onLoad={() => setLoaded(true)} />
    {!loaded && <span>Official event sticker<br /><strong>Awaiting official asset</strong></span>}
  </div>;
}
