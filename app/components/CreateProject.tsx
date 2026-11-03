"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {apiRequest} from "./api";
export default function CreateProject(){const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  return <form className="create-form" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);setError("");try{const {projectId}=await apiRequest<{projectId:string}>("/api/projects","POST",{title:String(data.get("title")),rightsAttested:data.get("rights")==="on"});router.push(`/p/${projectId}`);}catch(error){setError((error as Error).message);setBusy(false);}}}>
    <label htmlFor="project-title">Clip title</label><input id="project-title" name="title" maxLength={120} required placeholder="A short lesson or announcement" />
    <label className="check"><input type="checkbox" name="rights" required />I have permission to use the clip and captions.</label>
    <p className="field-note">Captions may contain personal data and are sent to OpenAI when real processing is enabled. Videos expire after 72 hours, with cleanup within 96 hours; pinned demos are excluded.</p>
    {error&&<p role="alert" className="error-note">{error}</p>}<button disabled={busy}>{busy?"Creating workspace…":"Create a project"}</button>
  </form>;
}
