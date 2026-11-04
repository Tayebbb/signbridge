import Link from "next/link";
import CreateProject from "./components/CreateProject";
import {publicOperationalNotice} from "@/lib/db/queries/operations";
import {PUBLIC_DEMOS} from "@/lib/domain/publicDemoCatalog";
export default async function Home() {
  const notice=await publicOperationalNotice();
  return <>{notice&&<p role="status" className="error-note">{notice}</p>}<div className="landing"><section><h1>A signing companion that shows its gaps.</h1><p>Pair a short clip with Bangla captions. Watch the source, hold the frame, then play an experimental sequence from corpus assets.</p><p className="notice">Experimental · not reviewed by a BdSL signer. Renderability does not establish BdSL correctness or comprehension.</p><p>Keep the source visible. See missing concepts before signs play. Reopen the same saved track without another model call.</p>
    <div className="button-row">{PUBLIC_DEMOS.map((demo,i)=><Link className={i===0?"action":"action secondary"} key={demo.id} href={demo.href}>{demo.label}</Link>)}</div><p className="field-note">Original synthetic source clips · technical playback only.</p>
    <p className="field-note"><Link href="/renderer-spike">Technical renderer experiment</Link></p></section><section className="create-section" aria-labelledby="create-heading"><h2 id="create-heading">Start with a short clip</h2><p className="field-note">MP4 or WebM · up to 90 seconds and 15 MB · SRT, VTT or timestamped captions</p><CreateProject /></section></div></>;
}
