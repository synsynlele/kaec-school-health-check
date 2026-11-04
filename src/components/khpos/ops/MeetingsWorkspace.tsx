"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { MeetingCallPanel } from "./MeetingCallPanel";
import { meetingEnd } from "@/lib/khpos/ops/call-plan";
import type { MeetingWorkspace } from "@/lib/khpos/ops/meetings";

const field = "w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900";
const button = "rounded-xl bg-blue-700 px-4 py-3 text-white disabled:opacity-50";
function date(value: string) { return new Date(value).toLocaleString(); }
export function MeetingsWorkspace({organisationId,initialMeeting=""}:{organisationId:string;initialMeeting?:string}) {
 const supabase = useMemo(()=>createBrowserSupabaseClient(),[]);
 const [data,setData] = useState<MeetingWorkspace|null>(null);
 const [selected,setSelected] = useState(initialMeeting); const selectedRef = useRef(initialMeeting);
 const [error,setError] = useState(""); const [readError,setReadError]=useState(""); const [busy,setBusy] = useState(false);
 const [showCreate,setShowCreate] = useState(false); const [search,setSearch] = useState("");
 const [title,setTitle]=useState(""); const [agenda,setAgenda]=useState("");
 const [starts,setStarts]=useState(""); const [hours,setHours]=useState(1);

 const [invitees,setInvitees]=useState<string[]>([]); const [message,setMessage]=useState("");
 const [decision,setDecision]=useState(""); const [action,setAction]=useState(""); const [owner,setOwner]=useState(""); const [due,setDue]=useState("");
 const pendingRef = useRef(false); const mounted = useRef(true);
 const request = useCallback(async (input?:Record<string,unknown>, roomId=selectedRef.current) => {
  const session = await supabase?.auth.getSession(); const token=session?.data.session?.access_token;
  if (!token) throw new Error("Sign in to view your private meetings.");
  const response = await fetch(`/api/khpos/ops/meetings/${organisationId}${!input&&roomId?`?meeting=${roomId}`:""}`, {
   method:input?"POST":"GET",headers:{Authorization:`Bearer ${token}`, ...(input?{"Content-Type":"application/json"}:{})},
   ...(input?{body:JSON.stringify(input)}:{}),cache:"no-store"
  });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load meetings.");
  if (mounted.current && roomId===selectedRef.current) setData(previous=>({...result.workspace,people:result.workspace.people.length?result.workspace.people:previous?.people??[]}));
  return result.workspace as MeetingWorkspace;
 },[organisationId,supabase]);
 useEffect(()=>{
  mounted.current=true; selectedRef.current=selected;
  let stopped=false; let timer:ReturnType<typeof setTimeout>;
  async function refresh() {
   if (!stopped&&!pendingRef.current&&document.visibilityState==="visible") {
    try { await request(undefined,selected); if(!stopped)setReadError(""); }
    catch(e) { if(!stopped) { setReadError(e instanceof Error?e.message:"Could not refresh meetings."); setData(null); } }
   }
   if(!stopped)timer=setTimeout(refresh,30000);
  }
  let resumeTimer:ReturnType<typeof setTimeout>;
  const resume=()=>{
   clearTimeout(resumeTimer);
   resumeTimer=setTimeout(()=>{if(!stopped&&!pendingRef.current&&document.visibilityState==="visible")void request(undefined,selected).catch(e=>setReadError(e.message));},50);
  };
  document.addEventListener("visibilitychange",resume);window.addEventListener("focus",resume);
  void refresh();
  return ()=>{stopped=true;clearTimeout(timer);clearTimeout(resumeTimer);document.removeEventListener("visibilitychange",resume);window.removeEventListener("focus",resume);mounted.current=false;};
 },[selected,request]);
 useEffect(()=>{
  if(!supabase||!selected)return;
  const channel=supabase.channel(`meeting:${selected}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"khpos_meeting_messages",filter:`meeting_id=eq.${selected}`},()=>{
   if(document.visibilityState==="visible"&&!pendingRef.current)void request().catch(e=>setReadError(e.message));
  }).on("postgres_changes",{event:"UPDATE",schema:"public",table:"khpos_meetings",filter:`id=eq.${selected}`},()=>{
   if(document.visibilityState==="visible"&&!pendingRef.current)void request().catch(e=>setReadError(e.message));
  }).subscribe();
  return ()=>{void supabase.removeChannel(channel);};
 },[supabase,selected,request]);
 useEffect(()=>{
  const subscription=supabase?.auth.onAuthStateChange(event=>{
   if(event==="SIGNED_OUT"){setData(null);setSelected("");selectedRef.current="";}
  });
  return ()=>subscription?.data.subscription.unsubscribe();
 },[supabase]);
 async function save(input:Record<string,unknown>, done:()=>void) {
  if(pendingRef.current)return; pendingRef.current=true;setBusy(true);setError("");
  try { const updated=await request(input); if(input.mode==="create"&&updated.room){selectedRef.current=updated.room.meeting.id;setSelected(updated.room.meeting.id);setData(previous=>({...updated,people:previous?.people??[]}));} done(); }
  catch(e){setError(e instanceof Error?e.message:"Could not save.");}
  finally{pendingRef.current=false;setBusy(false);}
 }
 const visibleError=error||readError;
 const room=data?.room; const host=!!room&&room.meeting.created_by===data?.userId&&data.canCreate;
 const writable=!!room&&!["closed","cancelled"].includes(room.meeting.status);
 return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-900">
  <Link href={`/khpos/${organisationId}/work`} className="text-blue-700">← Today</Link>
  <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Private meetings</h1><p className="mt-2 text-slate-600">Discuss. Agree. Assign. Follow through.</p></div>
  {data?.canCreate&&<button className={button} onClick={()=>setShowCreate(!showCreate)}>Schedule a meeting</button>}</header>
  {visibleError&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{visibleError}</p>}
  {!data&&!visibleError&&<p role="status">Loading your meetings…</p>}
  {showCreate&&<form className="space-y-4 rounded-2xl border bg-white p-5" onSubmit={e=>{e.preventDefault();void save({mode:"create",title,agenda,startsAt:new Date(starts).toISOString(),endsAt:meetingEnd(starts,hours),callUrl:"",callParts:[],participants:invitees},()=>{setShowCreate(false);setTitle("");setAgenda("");setInvitees([]);setHours(1);});}}>
   <h2 className="text-xl font-semibold">Plan a private meeting</h2>
   <label className="block">Meeting title<input required maxLength={160} className={field} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label className="block">Agenda<textarea required maxLength={4000} className={field} value={agenda} onChange={e=>setAgenda(e.target.value)} placeholder="What must we discuss and decide?"/></label>
   <div className="grid gap-4 sm:grid-cols-2"><label>Starts (your local time)<input required type="datetime-local" className={field} value={starts} onChange={e=>setStarts(e.target.value)}/></label><label>Meeting length<select className={field} value={hours} onChange={e=>setHours(Number(e.target.value))}>{[1,2,3,4,5,6].map(h=><option key={h} value={h}>{h} {h===1?"hour":"hours"}</option>)}</select></label></div>
   {starts&&<p className="text-sm">Planned end: {date(meetingEnd(starts,hours))}</p>}
   <p className="rounded-xl bg-blue-50 p-4 text-sm">Voice and video calls open inside this meeting room. You can join with your camera off for an audio meeting. Text discussions and follow-ups remain available here.</p>
   <fieldset><legend className="font-semibold">Invite people — only these people can view this room</legend><div className="mt-2 max-h-60 overflow-y-auto rounded-xl border p-3">{data?.people.filter(p=>p.id!==data.userId).map(p=><label key={p.id} className="flex gap-3 py-2"><input type="checkbox" checked={invitees.includes(p.id)} onChange={e=>setInvitees(e.target.checked?[...invitees,p.id]:invitees.filter(id=>id!==p.id))}/>{p.name}</label>)}</div></fieldset>
   <button disabled={busy||!invitees.length} className={button}>Save meeting</button>
  </form>}
  <div className="grid gap-5 lg:grid-cols-[280px_1fr]"><aside className="space-y-3"><label className="block">Find a meeting<input type="search" className={field} value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {data?.meetings.filter(m=>m.title.toLowerCase().includes(search.toLowerCase())).map(m=><button key={m.id} onClick={()=>{if(!busy){setData(d=>d?{...d,room:null}:d);setSelected(m.id);}}} className={`w-full rounded-xl border p-4 text-left ${selected===m.id?"border-blue-700 bg-blue-50":"bg-white"}`}><strong className="block">{m.title}</strong><span className="block text-sm">{date(m.starts_at)}</span><span className="text-sm capitalize">{m.status}</span></button>)}
   {data&&!data.meetings.length&&<p className="rounded-xl bg-slate-100 p-4">No meetings yet. Your invitations will appear here.</p>}
  </aside>
  {room?<section className="space-y-5 rounded-2xl border bg-white p-5">
   <div><p className="text-sm capitalize text-blue-700">{room.meeting.status}</p><h2 className="text-2xl font-bold">{room.meeting.title}</h2><p>{date(room.meeting.starts_at)} – {date(room.meeting.ends_at)}</p><p className="mt-3 whitespace-pre-wrap">{room.meeting.agenda}</p></div>
   <button className="text-blue-700 underline" onClick={()=>void navigator.clipboard.writeText(`${window.location.origin}/khpos/${organisationId}/meetings?meeting=${selected}`).catch(()=>setError("Could not copy the link. Open this meeting using its invitation."))}>Copy meeting link</button>
   <details><summary>Invited people ({room.participants.length})</summary><ul className="mt-2 space-y-1">{room.participants.map(p=><li key={p.user_id}>{p.name}</li>)}</ul></details>
   <MeetingCallPanel key={room.meeting.id} meeting={room.meeting} organisationId={organisationId} />
   {host&&writable&&<div className="flex flex-wrap gap-2">{room.meeting.status==="scheduled"&&<button disabled={busy} className={button} onClick={()=>void save({mode:"status",meetingId:selected,status:"live"},()=>{})}>Start meeting</button>}<button disabled={busy} className="rounded-xl border p-3" onClick={()=>{if(window.confirm("Close this meeting? Its discussion and outcomes will become read-only. Today tasks remain active."))void save({mode:"status",meetingId:selected,status:"closed"},()=>{});}}>Close meeting</button><button disabled={busy} className="rounded-xl border p-3" onClick={()=>{if(window.confirm("Cancel this meeting? Existing Today tasks will remain active."))void save({mode:"status",meetingId:selected,status:"cancelled"},()=>{});}}>Cancel meeting</button></div>}
   <div><h3 className="text-lg font-bold">Discussion</h3><p className="text-sm text-slate-500">Latest 100 messages. Live updates while connected; checks again every 30 seconds.</p><div className="my-3 max-h-96 space-y-3 overflow-y-auto" role="log" aria-label="Meeting discussion">{room.messages.map(m=><article key={m.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">{m.author_name} · {date(m.created_at)}</p><p className="whitespace-pre-wrap break-words">{m.body}</p></article>)}{!room.messages.length&&<p>No messages yet.</p>}</div>
   {writable&&<form onSubmit={e=>{e.preventDefault();void save({mode:"message",meetingId:selected,id:crypto.randomUUID(),body:message},()=>setMessage(""));}} className="space-y-2"><label className="block">Your message<textarea required maxLength={4000} value={message} onChange={e=>setMessage(e.target.value)} className={field}/></label><button disabled={busy||!message.trim()} className={button}>Send</button></form>}</div>
   <div><h3 className="text-lg font-bold">Agreed decisions</h3><ul className="my-3 space-y-2">{room.decisions.map(d=><li key={d.id} className="whitespace-pre-wrap rounded-xl bg-blue-50 p-3">{d.body}</li>)}</ul>
   {host&&writable&&<form className="space-y-2" onSubmit={e=>{e.preventDefault();void save({mode:"decision",meetingId:selected,id:crypto.randomUUID(),body:decision},()=>setDecision(""));}}><label className="block">Record a decision<textarea required maxLength={4000} className={field} value={decision} onChange={e=>setDecision(e.target.value)}/></label><button disabled={busy||!decision.trim()} className={button}>Save decision</button></form>}</div>
   <div><h3 className="text-lg font-bold">Assigned follow-ups</h3><p className="text-sm text-slate-600">Actions appear in the responsible person’s Today queue. Completion evidence is recorded there.</p><ul className="my-3 space-y-2">{room.actions.map(a=><li className="rounded-xl border p-3" key={a.id}><strong>{a.title}</strong><p>{a.owner_name} · Due {date(a.due_at)}</p><p className="capitalize">{a.status.replaceAll("_"," ")}</p></li>)}</ul>
   {host&&writable&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void save({mode:"action",meetingId:selected,id:crypto.randomUUID(),title:action,ownerId:owner,dueAt:new Date(due).toISOString()},()=>{setAction("");setOwner("");setDue("");});}}><label className="block">What needs to happen?<input required maxLength={160} className={field} value={action} onChange={e=>setAction(e.target.value)}/></label><label className="block">Who is responsible?<select required className={field} value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Choose an invited school staff member</option>{room.participants.map(p=><option key={p.user_id} value={p.user_id}>{p.name}</option>)}</select></label><label className="block">Deadline<input required type="datetime-local" className={field} value={due} onChange={e=>setDue(e.target.value)}/></label><button disabled={busy} className={button}>Assign in Today</button></form>}</div>
  </section>:<section className="rounded-2xl bg-slate-50 p-6"><h2 className="text-xl font-semibold">A clear record of every commitment</h2><p className="mt-2">Open an invited meeting to discuss the agenda, see decisions and check follow-ups.</p></section>}
  </div>
 </main>;
}
