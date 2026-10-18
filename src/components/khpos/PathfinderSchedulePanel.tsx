"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {CalendarCheck2,CheckCircle2,ClipboardCheck,Clock3,MapPin,Video,AlertTriangle} from "lucide-react";
import {createBrowserSupabaseClient} from "@/lib/supabase/client";
import type {SchoolEngagement,SchoolDeskSnapshot} from "@/lib/khpos/hq-schools";
import type {SessionDesk,PathfinderSession} from "@/lib/khpos/hq-sessions";
const ctrl="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950";
const lbl="block space-y-1 text-xs font-bold text-slate-700";
function showDate(value:string|null){return value?new Date(value).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"Not recorded";}
function toLocalDate(iso:string){const d=new Date(iso);return d.toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"});}
export function PathfinderSchedulePanel({engagement,viewer,members}:{
 engagement:SchoolEngagement;viewer:SchoolDeskSnapshot["viewer"];members:SchoolDeskSnapshot["members"];}){
 const client=useMemo(()=>createBrowserSupabaseClient(),[]);
 const [desk,setDesk]=useState<SessionDesk|null>(null),[error,setError]=useState("");
 const [busy,setBusy]=useState(false),[showSchedule,setShowSchedule]=useState(false);
 const [mode,setMode]=useState("virtual"),[title,setTitle]=useState(""),[objective,setObjective]=useState("");
 const [start,setStart]=useState(""),[end,setEnd]=useState("");
 const [acting,setActing]=useState<{id:string;action:string}|null>(null);
 const [outcome,setOutcome]=useState(""),[issues,setIssues]=useState(""),[resolution,setResolution]=useState("");
 const [evidence,setEvidence]=useState(""),[nextAction,setNextAction]=useState("");
 const [reviewNote,setReviewNote]=useState(""),[cancelReason,setCancelReason]=useState("");
 const load=useCallback(async()=>{
  if(!client)return;
  try{
   const {data}=await client.auth.getSession();
   if(!data.session?.access_token){setError("Sign in again to view Pathfinder schedules.");return;}
   const response=await fetch("/api/khpos/hq/pathfinder-sessions",{cache:"no-store",headers:{Authorization:"Bearer "+data.session.access_token}});
   const parsed=await response.json() as {ok?:boolean;desk?:SessionDesk;error?:string};
   if(!response.ok||!parsed.ok||!parsed.desk)throw new Error(parsed.error??"Could not load activities.");
   setDesk(parsed.desk);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Could not load supervision sessions.");}
 },[client]);
 useEffect(()=>{const id=window.setTimeout(()=>{void load();},0);return ()=>window.clearTimeout(id);},[load]);
 async function act(action:string,args:Record<string,unknown>){
  if(!client)return false;
  setBusy(true);setError("");
  try{
   const {data}=await client.auth.getSession();
   const token=data.session?.access_token;
   if(!token)throw new Error("Sign in again.");
   const res=await fetch("/api/khpos/hq/pathfinder-sessions",{method:"POST",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({action,...args})});
   const parsed=await res.json() as {ok?:boolean;desk?:SessionDesk;error?:string};
   if(!res.ok||!parsed.ok||!parsed.desk)throw new Error(parsed.error??"Could not save activity.");
   setDesk(parsed.desk);setActing(null);return true;
  }catch(e){setError(e instanceof Error?e.message:"Activity could not be saved.");return false;}
  finally{setBusy(false);}
 }
 const sessions=(desk?.sessions??[]).filter(s=>s.engagement_id===engagement.id);
 const now=desk?.generated_at??"";
 const missed=sessions.filter(s=>s.status==="scheduled"&&!!now&&s.scheduled_start_at<now);
 const verified=sessions.filter(s=>s.status==="completed"&&!!s.reviewed_at);
 const resolved=verified.filter(s=>s.resolution_note.trim().length>=15);
 const lead=["vision_custodian","alliance_catalyst"].includes(viewer.role);
 const reviewer=["vision_custodian","alliance_catalyst","system_steward"].includes(viewer.role);
 const assigned=viewer.userId===engagement.representative_user_id;
 const name=(id:string)=>members.find(m=>m.user_id===id)?.display_name??"Assigned corporate representative";
 function actionFor(s:PathfinderSession,action:string){
  setActing({id:s.id,action});setOutcome(s.outcome_note??"");setIssues(s.issues_note??"");
  setResolution(s.resolution_note??"");setEvidence(s.evidence_reference??"");
  setNextAction(s.next_action??"");setReviewNote("");setCancelReason("");setError("");
 }
 return <section className="rounded-2xl border border-slate-200 bg-white p-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-lg font-black">Pathfinder schedule, attendance & outcomes</h2>
    <p className="mt-1 text-xs leading-5 text-slate-600">Planned visits and remote checks, self-attested presence, delivered work, problems resolved and independent review.</p></div>
   {lead&&engagement.engagement_status==="active"&&
    <button type="button" onClick={()=>setShowSchedule(!showSchedule)}
     className="rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-bold text-white">+ Schedule supervision</button>}
  </div>
  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
   {[["Scheduled",sessions.filter(s=>s.status==="scheduled").length],["Missed / awaiting action",missed.length],["Completed",sessions.filter(s=>s.status==="completed").length],["Independently reviewed",verified.length]].map(([label,value])=>
    <div key={label} className="rounded-xl bg-slate-50 p-3"><strong className="text-xl">{value}</strong><p className="text-xs text-slate-600">{label}</p></div>)}
  </div>
  <p className="mt-3 text-xs text-slate-600">Reviewed sessions with documented problem resolutions: <strong>{resolved.length}</strong>. Attendance is self-declared through server-recorded check-in/out; it is not GPS or independent proof of presence. Duration is not an impact score.</p>
  {desk?.capped&&<p className="mt-2 text-xs text-amber-800">Showing a capped recent activity history; counts here are not lifetime totals.</p>}
  {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-900">{error}</p>}
  {showSchedule&&lead&&<form className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-2"
   onSubmit={e=>{e.preventDefault();if(!start)return;void act("schedule_session",{
    engagement_id:engagement.id,mode,title,objective,
    scheduled_start_at:new Date(start).toISOString(),
    scheduled_end_at:end?new Date(end).toISOString():null
   }).then(ok=>{if(ok){setShowSchedule(false);setTitle("");setObjective("");setStart("");setEnd("");}});}}>
   <p className="sm:col-span-2 text-xs font-bold">Assign to {name(engagement.representative_user_id??"")}. The Pathfinder must already be appointed to this school.</p>
   <label className={lbl}>Mode<select className={ctrl} value={mode} onChange={e=>setMode(e.target.value)}><option value="virtual">Virtual follow-up</option><option value="onsite">Physical school visit</option></select></label>
   <label className={lbl}>Activity title<input className={ctrl} required minLength={4} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label className={lbl+" sm:col-span-2"}>Purpose and expected result<textarea className={ctrl} required minLength={15} maxLength={2000} rows={2} value={objective} onChange={e=>setObjective(e.target.value)}/></label>
   <label className={lbl}>Scheduled start<input className={ctrl} type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label className={lbl}>Scheduled end (optional)<input className={ctrl} type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
   <div className="flex gap-2 sm:col-span-2">
    <button type="submit" disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Save schedule</button>
    <button type="button" onClick={()=>setShowSchedule(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold">Cancel</button>
   </div>
  </form>}
  <div className="mt-4 space-y-3">
   {!sessions.length&&<p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No scheduled work for this school yet. Attendance and performance will not be inferred until a real session is scheduled and recorded.</p>}
   {sessions.map(s=><article key={s.id} className="rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div><h3 className="text-sm font-black">{s.title}</h3>
      <p className="mt-1 text-xs text-slate-600">{s.mode==="onsite"?"Physical visit":"Virtual follow-up"} · {toLocalDate(s.scheduled_start_at)} · {name(s.representative_user_id)}</p>
      <p className="mt-1 text-xs text-slate-700">{s.objective}</p>
     </div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{s.status.replace("_"," ")}</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
     {s.mode==="onsite"?<><span><MapPin className="mr-1 inline size-3"/>In: {showDate(s.check_in_at)}</span><span>Out: {showDate(s.check_out_at)}</span></>:
      <span><Video className="mr-1 inline size-3"/>Remote — no physical check-in required</span>}
     {s.reviewed_at&&<span><CheckCircle2 className="mr-1 inline size-3"/>Reviewed {showDate(s.reviewed_at)}</span>}
     {s.status==="scheduled"&&now&&s.scheduled_start_at<now&&<strong className="text-amber-800">Scheduled start passed — needs review</strong>}
    </div>
    {s.status==="completed"&&<div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-xs leading-5">
     <p><strong>Work reported:</strong> {s.outcome_note}</p>
     {s.issues_note&&<p><strong>Problems:</strong> {s.issues_note}</p>}
     {s.resolution_note&&<p><strong>Solutions reported:</strong> {s.resolution_note}</p>}
     {s.evidence_reference&&<p><strong>Evidence reference:</strong> {s.evidence_reference}</p>}
     {s.next_action&&<p><strong>Next action:</strong> {s.next_action}</p>}
     {s.review_note&&<p><strong>Supervisor's assessment:</strong> {s.review_note}</p>}
    </div>}
    <div className="mt-3 flex flex-wrap gap-2">
     {assigned&&s.representative_user_id===viewer.userId&&s.mode==="onsite"&&s.status==="scheduled"&&<button disabled={busy} onClick={()=>void act("check_in",{id:s.id})} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-900"><MapPin className="mr-1 inline size-3"/>Check in on arrival</button>}
     {assigned&&s.representative_user_id===viewer.userId&&s.mode==="onsite"&&s.status==="checked_in"&&<button onClick={()=>actionFor(s,"check_out")} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Check out & report work</button>}
     {assigned&&s.representative_user_id===viewer.userId&&s.mode==="virtual"&&s.status==="scheduled"&&<button onClick={()=>actionFor(s,"complete_virtual")} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Log virtual work done</button>}
     {lead&&s.status==="scheduled"&&<button onClick={()=>actionFor(s,"cancel_session")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Cancel / missed visit reason</button>}
     {reviewer&&s.status==="completed"&&!s.reviewed_at&&s.representative_user_id!==viewer.userId&&s.created_by!==viewer.userId&&
      <button onClick={()=>actionFor(s,"review_session")} className="rounded-lg border border-slate-900 px-3 py-2 text-xs font-bold">Review result</button>}
    </div>
    {acting?.id===s.id&&<form className="mt-3 space-y-3 rounded-xl bg-blue-50 p-4"
     onSubmit={e=>{e.preventDefault();void act(acting.action,{id:s.id,...(acting.action==="cancel_session"?{cancellation_reason:cancelReason}:
      acting.action==="review_session"?{review_note:reviewNote}:{
       outcome_note:outcome,issues_note:issues,resolution_note:resolution,
       evidence_reference:evidence,next_action:nextAction})});}}>
     <p className="text-sm font-bold">{acting.action==="review_session"?"Independent supervisor review":acting.action==="cancel_session"?"Record a cancellation reason":"Record actual work and problems addressed"}</p>
     {acting.action==="cancel_session"?<label className={lbl}>Reason<textarea required minLength={15} maxLength={1000} className={ctrl} rows={2} value={cancelReason} onChange={e=>setCancelReason(e.target.value)}/></label>:
      acting.action==="review_session"?<label className={lbl}>Independent review decision and supporting reason<textarea required minLength={15} maxLength={1500} className={ctrl} rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/></label>:
      <>
       <label className={lbl}>What was actually done?<textarea required minLength={20} maxLength={3000} className={ctrl} rows={3} value={outcome} onChange={e=>setOutcome(e.target.value)}/></label>
       <label className={lbl}>Problems discovered<textarea maxLength={2000} className={ctrl} rows={2} value={issues} onChange={e=>setIssues(e.target.value)}/></label>
       <label className={lbl}>Problems solved (if any)<textarea maxLength={2000} className={ctrl} rows={2} value={resolution} onChange={e=>setResolution(e.target.value)}/></label>
       <label className={lbl}>Evidence reference (no learner private data)<input maxLength={700} className={ctrl} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
       <label className={lbl}>What needs to happen next?<textarea maxLength={1500} rows={2} className={ctrl} value={nextAction} onChange={e=>setNextAction(e.target.value)}/></label>
      </>}
     <div className="flex gap-2">
      <button disabled={busy} type="submit" className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Save action</button>
      <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold" onClick={()=>setActing(null)}>Close</button>
     </div>
    </form>}
   </article>)}
  </div>
  <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500"><Clock3 className="mt-0.5 size-4 shrink-0"/>Times are recorded by the server; location is not tracked. A checked-in visit without a check-out remains unfinished. Problems resolved count only when the supervisor reviews the documented outcome.</p>
  {missed.length>0&&<p className="mt-2 flex items-start gap-2 text-xs text-amber-900"><AlertTriangle className="size-4"/>A past scheduled start is not automatically proof of absence; follow up for circumstances and reschedule or document appropriately.</p>}
 </section>;
}
