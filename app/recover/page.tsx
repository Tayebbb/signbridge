"use client";
import {useState} from "react";
import Link from "next/link";
import {apiRequest} from "../components/api";
import {useHydrated} from "../components/useHydrated";
export default function Recover(){
  const hydrated=useHydrated(),[key,setKey]=useState(""),[error,setError]=useState(""),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
  return <section><h1>Restore creator access</h1><p>Use your saved recovery key. Restoring signs out other creator sessions. Saved projects and share links stay unchanged.</p>
    {done?<p role="status">Creator access restored. Open your saved creator project URL, or <Link href="/">create a project</Link>.</p>:<form method="post" aria-busy={!hydrated||busy} onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{await apiRequest("/api/owner/recover","POST",{recoveryKey:key.trim()});setKey("");setDone(true);}catch{setError("Access could not be restored. Check the recovery key and try again.");}finally{setBusy(false);}}}>
      {!hydrated&&<p role="status" className="field-note">Loading recovery controls…</p>}<noscript><p>Enable JavaScript to restore creator access.</p></noscript>
      <label>Recovery key<input type="password" required disabled={!hydrated||busy} value={key} autoComplete="off" minLength={43} maxLength={43} onChange={e=>setKey(e.target.value)} /></label>
      <label>Or open your downloaded recovery file<input type="file" disabled={!hydrated||busy} accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>4096)throw Error();const data=JSON.parse(await file.text());if(typeof data.recoveryKey!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(data.recoveryKey))throw Error();setKey(data.recoveryKey);setError("");}catch{setError("Choose a valid SignBridge recovery file.");}}} /></label>
      <button type="submit" disabled={!hydrated||busy}>{busy?"Restoring…":"Restore access"}</button>{error&&<p role="alert">{error}</p>}
    </form>}<p>Without a saved key or a browser that still has creator access, ownership cannot be recovered.</p>
  </section>;
}
