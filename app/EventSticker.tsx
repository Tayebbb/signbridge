"use client";
import { useState } from "react";
import Image from "next/image";
export default function EventSticker() {
  const [missing, setMissing] = useState(false);
  return <div className="sticker-slot" aria-label="Official event sticker slot">
    {!missing && <Image src="/event-sticker.png" alt="Official event sticker" width={160} height={90} unoptimized onError={() => setMissing(true)} onLoad={() => setMissing(false)} />}
    {missing && <span>Official event sticker<br /><strong>Awaiting official asset</strong></span>}
  </div>;
}
