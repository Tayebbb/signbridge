"use client";
import {useSyncExternalStore} from "react";
const subscribe=()=>()=>{};
const clientSnapshot=()=>true;
const serverSnapshot=()=>false;
/** Interactive form controls stay inert until their client handlers are committed. */
export function useHydrated(){return useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);}
