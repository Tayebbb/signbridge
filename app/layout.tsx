import type { Metadata } from "next";
import Link from "next/link";
import EventSticker from "./EventSticker";
import "./globals.css";
export const metadata: Metadata = { title: "SignBridge · Experimental prototype", description: "Technical rendering prototype. No BdSL correctness or comprehension evidence." };
export const dynamic="force-dynamic";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <header><EventSticker /><div><Link className="wordmark" href="/">SignBridge</Link><p className="label">Experimental · not reviewed by BdSL signers</p></div><Link href="/about">About &amp; limitations</Link></header>
    <main>{children}</main>
    <footer>Sign data: IsharaKotha v2 · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Renderer: <a href="https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/">UEA CWASA vhg2026</a>, Anna · unmodified remote engine.</footer>
  </body></html>;
}
