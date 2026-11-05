"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Meeting } from "@/lib/khpos/ops/meetings";

type CallApi = { dispose: () => void; addListener: (event: string, callback: () => void) => void };
type CallConstructor = new (domain: string, options: Record<string, unknown>) => CallApi;

export function MeetingCallPanel({ meeting, organisationId, onJoined }: { meeting: Meeting; organisationId: string; onJoined?: () => void }) {
 const panel = useRef<HTMLElement>(null);
 const joined = useRef(onJoined);
 useEffect(() => { joined.current = onJoined; }, [onJoined]);
 const [expanded, setExpanded] = useState(false);
 useEffect(() => {
  if (!expanded || ["closed", "cancelled"].includes(meeting.status)) return;
  const overflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
  document.addEventListener("keydown", escape);
  return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", escape); };
 }, [expanded, meeting.status]);
 useEffect(() => {
  const changed = () => { if (!document.fullscreenElement) setExpanded(false); };
  document.addEventListener("fullscreenchange", changed);
  return () => document.removeEventListener("fullscreenchange", changed);
 }, []);
 async function toggleFullScreen() {
  if (expanded) {
   setExpanded(false);
   if (document.fullscreenElement === panel.current) await document.exitFullscreen().catch(() => {});
  } else {
   setExpanded(true);
   // Phones without the Fullscreen API still get the full-window layout.
   await panel.current?.requestFullscreen?.().catch(() => {});
  }
 }
 const container = useRef<HTMLDivElement>(null);
 const api = useRef<CallApi | null>(null);
 const pending = useRef(false);
 const [session, setSession] = useState<{ roomName: string; jwt: string } | null>(null);
 const [ready, setReady] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 const closed = ["closed", "cancelled"].includes(meeting.status);
 useEffect(() => {
  if ((!session || closed) && panel.current && document.fullscreenElement === panel.current) {
   void document.exitFullscreen().catch(() => {});
  }
 }, [session, closed]);
 useEffect(() => {
  if (!session || !ready || closed || !container.current) return;
  // Defer SDK startup until the container is committed, and cancel on unmount.
  let call: CallApi | null = null;
  const startup = window.setTimeout(() => {
   const Constructor = (window as Window & { JitsiMeetExternalAPI?: CallConstructor }).JitsiMeetExternalAPI;
   if (!Constructor) { setSession(null); setExpanded(false); setError("The call could not load. Try joining again."); return; }
   try {
    call = new Constructor("8x8.vc", { ...session, parentNode: container.current, width: "100%", height: "100%",
     configOverwrite: { startWithAudioMuted: true, startWithVideoMuted: true, prejoinConfig: { enabled: true }, disableDeepLinking: true,
      toolbarButtons: ["microphone", "camera", "desktop", "tileview", "participants-pane", "settings", "hangup"], subject: meeting.title } });
    api.current = call;
    call.addListener("readyToClose", () => { setSession(null); setExpanded(false); });
    call.addListener("videoConferenceJoined", () => joined.current?.());
   } catch { setSession(null); setExpanded(false); setError("The call could not open. Try joining again."); }
  }, 0);
  return () => { window.clearTimeout(startup); call?.dispose(); if (api.current === call) api.current = null; };
 }, [session, ready, closed, meeting.title]);
 const generation = useRef(0);
 useEffect(() => () => { generation.current++; }, []);
 async function join() {
  if (pending.current) return;
  pending.current = true; setBusy(true); setError("");
  const attempt = generation.current;
  try {
   const auth = await createBrowserSupabaseClient()?.auth.getSession();
   const token = auth?.data.session?.access_token;
   if (!token) throw new Error("Sign in to join this meeting.");
   const response = await fetch(`/api/khpos/ops/meetings/${organisationId}/call?meeting=${meeting.id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || "Could not join the call.");
   if (attempt === generation.current) setSession(result);
  } catch (e) { if (attempt === generation.current) setError(e instanceof Error ? e.message : "Could not join the call."); }
  finally { pending.current = false; if (attempt === generation.current) setBusy(false); }
 }
 if (closed) return null;
 return <section ref={panel} aria-label="Voice and video call" className={expanded ? "fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white" : "space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4"}>
  {!session && <>
   <h3 className="text-lg font-bold">Voice and video</h3>
  </>}
  {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
  {session ? <>
   <Script src="https://8x8.vc/external_api.js" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => { setSession(null); setExpanded(false); setError("The calling service could not load. Check your connection and try again."); }} />
   <div className={expanded ? "flex shrink-0 justify-end bg-slate-950 px-2 pt-[env(safe-area-inset-top)]" : "flex justify-end"}>
    <button type="button" aria-pressed={expanded} aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen" : "Full screen"} onClick={() => void toggleFullScreen()} className={expanded ? "grid size-8 place-items-center rounded text-lg leading-none text-white hover:bg-white/15" : "rounded-lg border bg-white px-3 py-2 text-sm text-slate-900"}>{expanded ? <span aria-hidden="true">×</span> : "Full screen"}</button>
   </div>
   {!ready && <p role="status">Loading the call…</p>}
   <div ref={container} className={expanded ? "min-h-0 flex-1 w-full overflow-hidden bg-slate-950 pb-[env(safe-area-inset-bottom)]" : "h-[70dvh] min-h-[400px] w-full overflow-hidden rounded-xl bg-slate-950"} />
  </> : <button type="button" disabled={busy} onClick={() => void join()} className="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Preparing call…" : "Join call"}</button>}
 </section>;
}
