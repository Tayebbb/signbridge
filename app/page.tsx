import Link from "next/link";
export default function Home() {
  return <><p className="eyebrow">Phase 1 · Foundation</p><h1>A foundation for an experimental signing companion.</h1><p>This build tests the database, local adapters, and the technical isolation of a remote avatar renderer.</p><p className="notice">Technical renderability is the only evidence this prototype can produce today. It has not been reviewed for correct BdSL or evaluated for comprehension.</p><Link className="action" href="/renderer-spike">Open renderer experiment</Link></>;
}
