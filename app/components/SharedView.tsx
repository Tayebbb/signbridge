"use client";
import {useEffect,useState} from "react";
import type {PlaybackManifest,CurrentTrackResponse} from "@/lib/contracts/manifest";
import {TrackStore} from "@/lib/player/store";
import Player from "./Player";
export default function SharedView({projectId,token}:{projectId:string;token?:string}){
  const [track,setTrack]=useState<{manifest:PlaybackManifest;current:CurrentTrackResponse}|null>(null),[title,setTitle]=useState("Shared project"),[error,setError]=useState("");
  useEffect(()=>{if(!token)return;const controller=new AbortController(),store=new TrackStore(projectId,undefined,token);let active=true,loading=false,titleLoaded=false;
    const load=async()=>{if(loading)return;loading=true;try{if(!titleLoaded){const r=await fetch(`/api/projects/${projectId}?s=${encodeURIComponent(token)}`,{cache:"no-store",signal:controller.signal});if(!r.ok)throw Error("This shared project is unavailable or the link has been revoked.");const details=await r.json();if(!active)return;setTitle(details.project.title);titleLoaded=true;}const current=await store.refresh(controller.signal);if(!active)return;if(!current)throw Error("No saved companion is available on this link.");setTrack({manifest:current.manifest,current:current.current});setError("");}catch(e){if(active){setTrack(null);setError((e as Error).message);}}finally{loading=false;}};
    void load();const timer=setInterval(()=>{if(!document.hidden)void load();},10000);return()=>{active=false;controller.abort();clearInterval(timer);};
  },[projectId,token]);
  return <><h1>{title}</h1><p className="shared-label">Shared view · experimental · not reviewed</p><p className="field-note">View-only. Anyone with this unlisted link can view the captions, source video and saved experimental track. The creator can revoke this link.</p>{!token?<p role="alert">This link is missing its viewing token.</p>:error?<p role="alert">{error}</p>:!track?<p role="status">Loading the saved companion…</p>:<><Player manifest={track.manifest} current={track.current} shareToken={token} /><details className="transcript-section"><summary>Read the transcript</summary>{track.manifest.segments.map(s=><p key={s.idx} lang="bn">{s.sourceTextBn}</p>)}</details></>}</>;
}
