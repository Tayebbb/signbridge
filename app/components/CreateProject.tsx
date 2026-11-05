"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {apiRequest} from "./api";
import Link from "next/link";
import {useHydrated} from "./useHydrated";
export default function CreateProject(){const router=useRouter(),hydrated=useHydrated(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  return <form className="create-form" method="post" aria-busy={!hydrated||busy} onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);setError("");try{const {projectId}=await apiRequest<{projectId:string}>("/api/projects","POST",{title:String(data.get("title")),rightsAttested:data.get("rights")==="on"});router.push(`/p/${projectId}`);}catch(error){setError((error as Error).message);setBusy(false);}}}>
    {!hydrated&&<p role="status" className="field-note">Loading project controls…</p>}<noscript><p>Enable JavaScript to create a project.</p></noscript>
    <label htmlFor="project-title">Clip title</label><input id="project-title" name="title" maxLength={120} required disabled={!hydrated||busy} placeholder="A short lesson or announcement" />
    <label className="check"><input type="checkbox" name="rights" required disabled={!hydrated||busy} />I have permission to use the clip and captions.</label>
    <p className="field-note">Captions may contain personal data and are sent to OpenAI when real processing is enabled. Videos expire after 72 hours. Cleanup targets 96 hours when daily reconciliation runs; pinned demos are excluded.</p>
    <p className="field-note">Creator access is stored in this browser for 180 days. Save a recovery key from your workspace. <Link href="/recover">Restore existing creator access</Link>.</p>{error&&<p role="alert" className="error-note">{error}</p>}<button type="submit" disabled={!hydrated||busy}>{busy?"Creating workspace…":"Create a project"}</button>
  </form>;
}
