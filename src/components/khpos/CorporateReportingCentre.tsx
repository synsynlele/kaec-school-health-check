"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {CalendarDays,FileCheck2,ClipboardList,ArrowLeft,RefreshCw} from "lucide-react";
import {createBrowserSupabaseClient} from "@/lib/supabase/client";
import type {HqReportingDesk,HqReportingLine,HqReportSubmission} from "@/lib/khpos/hq-reports";
const input="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950";
const label="block space-y-1.5 text-xs font-bold text-slate-700";
const caps=(v:string)=>v.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
type Action={id:string;kind:"submit"|"review";returnedId?:string};
export function CorporateReportingCentre(){
 const client=useMemo(()=>createBrowserSupabaseClient(),[]);
 const [desk,setDesk]=useState<HqReportingDesk|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [showLine,setShowLine]=useState(false);
 const [title,setTitle]=useState(""),[purpose,setPurpose]=useState("");
 const [reporter,setReporter]=useState(""),[reviewer,setReviewer]=useState(""),[schoolId,setSchoolId]=useState("");
 const [cadence,setCadence]=useState("weekly"),[firstDue,setFirstDue]=useState("");
 const [action,setAction]=useState<Action|null>(null);
 const [achievements,setAchievements]=useState(""),[challenges,setChallenges]=useState("");
 const [nextActions,setNextActions]=useState(""),[evidence,setEvidence]=useState("");
 const [decision,setDecision]=useState("accept"),[reviewNote,setReviewNote]=useState("");
 const [filter,setFilter]=useState("all");
 const load=useCallback(async()=>{
  if(!client){setError("Corporate sign-in is unavailable.");setLoading(false);return;}
  try{
   const {data}=await client.auth.getSession();const token=data.session?.access_token;
   if(!token){setError("Please sign in with an appointed corporate account.");setLoading(false);return;}
   const r=await fetch("/api/khpos/hq/reports",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   const j=await r.json() as {ok?:boolean;desk?:HqReportingDesk;error?:string};
   if(!r.ok||!j.ok||!j.desk)throw new Error(j.error??"Reports did not load.");
   setDesk(j.desk);setError("");setLoading(false);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load corporate reports.");setLoading(false);}
 },[client]);
 useEffect(()=>{const id=window.setTimeout(()=>{void load();},0);return()=>window.clearTimeout(id);},[load]);
 async function act(operation:string,payload:Record<string,unknown>,message:string){
  if(!client)return false;
  setBusy(true);setError("");setNotice("");
  try{
   const {data}=await client.auth.getSession();const token=data.session?.access_token;
   if(!token)throw new Error("Session expired. Sign in again.");
   const r=await fetch("/api/khpos/hq/reports",{method:"POST",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
    body:JSON.stringify({action:operation,...payload})});
   const j=await r.json() as {ok?:boolean;desk?:HqReportingDesk;error?:string};
   if(!r.ok||!j.ok||!j.desk)throw new Error(j.error??"The report action could not save.");
   setDesk(j.desk);setNotice(message);setAction(null);return true;
  }catch(e){setError(e instanceof Error?e.message:"Could not save your report.");return false;}
  finally{setBusy(false);}
 }
 const viewer=desk?.viewer;
 const canConfigure=!!viewer&&["vision_custodian","system_steward","alliance_catalyst"].includes(viewer.role);
 const active=(desk?.lines??[]).filter(l=>l.status==="active");
 const overdue=active.filter(l=>l.next_due_on<(desk?.generated_at.slice(0,10)??""));
 const today=desk?.generated_at.slice(0,10)??"";
 const awaiting=(desk?.submissions??[]).filter(s=>s.status==="submitted");
 const returned=(desk?.submissions??[]).filter(s=>s.status==="returned");
 const reportName=(id:string)=>desk?.members.find(m=>m.user_id===id)?.display_name??"Corporate role holder";
 const lineFor=(id:string)=>desk?.lines.find(l=>l.id===id);
 const lines=(desk?.lines??[]).filter(l=>filter==="all"||
  (filter==="mine"&&l.reporter_user_id===viewer?.userId)||
  (filter==="review"&&l.reviewer_user_id===viewer?.userId));
 const reviewers=desk?.members.filter(m=>m.status==="active"&&
 ["vision_custodian","system_steward","alliance_catalyst","finance_steward"].includes(m.role))??[];
 const candidates=desk?.members.filter(m=>m.status==="active")??[];
 const [schoolChoices,setSchoolChoices]=useState<{id:string;name:string}[]>([]);
 useEffect(()=>{
  if(!client||!canConfigure)return;
  let cancelled=false;
  (async()=>{try{
   const {data}=await client.auth.getSession();
   const t=data.session?.access_token;if(!t)return;
   const r=await fetch("/api/khpos/hq/schools",{headers:{Authorization:"Bearer "+t},cache:"no-store"});
   const j=await r.json() as {ok?:boolean;desk?:{engagements:{id:string;organisation_id:string;engagement_status:string}[];organisations:{id:string;name:string}[]}};
   if(r.ok&&j.ok&&j.desk&&!cancelled)
    setSchoolChoices(j.desk.engagements.filter(x=>x.engagement_status==="active").map(x=>({
     id:x.id,name:j.desk?.organisations.find(o=>o.id===x.organisation_id)?.name??"School"})));
  }catch{/* The reporting form remains usable for non-school roles. */}
  })();
  return()=>{cancelled=true;};
 },[client,canConfigure]);
 function startSubmission(line:HqReportingLine,returnedReport?:HqReportSubmission){
  setAction({id:line.id,kind:"submit",returnedId:returnedReport?.id});
  setAchievements(returnedReport?.achievements??"");setChallenges(returnedReport?.challenges??"");
  setNextActions(returnedReport?.next_actions??"");setEvidence(returnedReport?.evidence_reference??"");
  setError("");
 }
 if(loading)return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading corporate reporting centre…</main>;
 if(!desk)return <main className="min-h-screen bg-slate-950 p-8 text-white">
  <h1 className="text-xl font-black">KAEC HQ — Reporting Centre</h1>
  <p className="mt-4 text-sm">{error}</p>
  <Link href="/account" className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-slate-950">Sign in</Link></main>;
 return <div className="min-h-screen bg-slate-50 text-slate-950">
  <header className="bg-slate-950 px-4 py-6 text-white">
   <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">KAEC-NG · Execution Accountability</p>
     <h1 className="mt-1 text-2xl font-black">Corporate Reporting Centre</h1>
     <p className="mt-1 text-xs text-slate-300">Reporter → scheduled period → recipient → decision → next report</p></div>
    <div className="flex gap-2"><Link href="/khpos/hq" className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold"><ArrowLeft className="mr-1 inline size-3"/> HQ</Link>
     <button onClick={()=>void load()} className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold"><RefreshCw className="mr-1 inline size-3"/> Refresh</button></div>
   </div>
  </header>
  <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {([["Active reporting lines",active.length],["Overdue reporting periods",overdue.length],
      ["Awaiting recipient review",awaiting.length],["Returned for correction",returned.length]] as [string,number][]).map(([k,v])=>
     <div key={k} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-2xl font-black">{v}</p><p className="text-xs text-slate-600">{k}</p></div>)}
   </div>
   <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-900">
    Reporting lines are set for real people, not merely job titles. Dates advance automatically after each report is submitted; missed periods remain visible until reported.
    Each submission requires a separate appointed recipient to accept or return it. Daily reports can be brief; quarterly and yearly reports should include verified outcomes.
    No emails, WhatsApp messages or push alerts are sent by this release.
   </div>
   {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}
   {notice&&<p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p>}
   {desk.capped&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Reporting data is capped to recent records; totals may be incomplete at larger scale.</p>}
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex flex-wrap gap-2">{[["all","All accessible"],["mine","My reports"],["review","To me"]].map(([v,k])=>
     <button key={v} onClick={()=>setFilter(v)} className={"rounded-lg border px-3 py-2 text-xs font-bold "+(filter===v?"border-emerald-800 bg-emerald-800 text-white":"border-slate-300 bg-white")}>{k}</button>)}</div>
    {canConfigure&&<button onClick={()=>setShowLine(!showLine)}
     className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white">+ Assign reporting line</button>}
   </div>
   {showLine&&canConfigure&&<form className="grid gap-3 rounded-2xl border border-emerald-200 bg-white p-5 sm:grid-cols-2"
    onSubmit={e=>{e.preventDefault();void act("create_line",{
     title,purpose,reporter_user_id:reporter,reviewer_user_id:reviewer,engagement_id:schoolId||null,
     cadence,anchor_due_on:firstDue
    },"Reporting line activated.").then(ok=>{if(ok){setShowLine(false);setTitle("");setPurpose("");}});}}>
    <p className="sm:col-span-2 font-black">New reporting responsibility</p>
    <label className={label}>Report title<input className={input} required minLength={4} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label className={label}>Cadence<select className={input} value={cadence} onChange={e=>setCadence(e.target.value)}>
     {["daily","weekly","monthly","quarterly","yearly"].map(c=><option key={c} value={c}>{caps(c)}</option>)}</select></label>
    <label className={label}>Reporting officer<select required className={input} value={reporter} onChange={e=>setReporter(e.target.value)}>
     <option value="">Choose officer</option>{candidates.map(m=><option key={m.user_id} value={m.user_id}>{m.display_name} — {caps(m.role)}</option>)}
    </select></label>
    <label className={label}>Receives and reviews the report<select required className={input} value={reviewer} onChange={e=>setReviewer(e.target.value)}>
     <option value="">Choose reviewer</option>{reviewers.filter(m=>m.user_id!==reporter).map(m=><option key={m.user_id} value={m.user_id}>{m.display_name} — {caps(m.role)}</option>)}
    </select></label>
    <label className={label}>First report due<input type="date" required className={input} value={firstDue} onChange={e=>setFirstDue(e.target.value)}/></label>
    <label className={label}>School scope (for School Pathfinder reporting)<select className={input} value={schoolId} onChange={e=>setSchoolId(e.target.value)}>
     <option value="">Corporate role (no school)</option>{schoolChoices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>
    <label className={label+" sm:col-span-2"}>Expected outcomes and reporting instructions<textarea className={input} minLength={15} maxLength={2000} required rows={3} value={purpose} onChange={e=>setPurpose(e.target.value)}/></label>
    <div className="flex flex-wrap gap-2 sm:col-span-2">
     <button disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Assign reporting responsibility</button>
     <button type="button" onClick={()=>setShowLine(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold">Cancel</button>
    </div>
   </form>}
   <section className="space-y-3">
    {lines.length===0&&<p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
     No reporting lines are assigned in this view. Appoint the relevant leaders and Pathfinders, then assign each real reporting responsibility and due date.
    </p>}
    {lines.map(line=>{
     const history=desk.submissions.filter(s=>s.line_id===line.id).sort((a,b)=>b.cycle_index-a.cycle_index);
     const returns=history.filter(s=>s.status==="returned"&&s.submitted_by===viewer?.userId);
     const due=!!today&&line.status==="active"&&line.next_due_on<today;
     return <article key={line.id} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div><h2 className="text-base font-black">{line.title}</h2>
        <p className="mt-1 text-xs text-slate-600">From <strong>{reportName(line.reporter_user_id)}</strong> to <strong>{reportName(line.reviewer_user_id)}</strong> · {caps(line.cadence)} · Period {line.next_cycle_index}</p></div>
       <span className={"rounded-full px-3 py-1 text-xs font-bold "+(line.status==="paused"?"bg-slate-100":"bg-emerald-50 text-emerald-800")}>{caps(line.status)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-700">{line.purpose}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
       <span className={due?"font-bold text-red-700":""}><CalendarDays className="mr-1 inline size-3"/>Next due: {line.next_due_on}{due?" · Overdue":""}</span>
       <span>Original anchor: {line.anchor_due_on}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
       {line.status==="active"&&line.reporter_user_id===viewer?.userId&&
        <button onClick={()=>startSubmission(line)} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white"><ClipboardList className="mr-1 inline size-3"/>Submit period {line.next_cycle_index}</button>}
       {canConfigure&&<button disabled={busy} onClick={()=>void act("line_status",{id:line.id,status:line.status==="active"?"paused":"active"},"Reporting schedule updated.")}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">{line.status==="active"?"Pause":"Resume"} reporting</button>}
       {returns.map(s=><button key={s.id} className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
        onClick={()=>startSubmission(line,s)}>Correct returned period {s.cycle_index}</button>)}
      </div>
      {action?.id===line.id&&action.kind==="submit"&&<form className="mt-4 space-y-3 rounded-xl bg-emerald-50 p-4" onSubmit={e=>{e.preventDefault();void act("submit_report",{
       line_id:line.id,...(action.returnedId?{returned_submission_id:action.returnedId}:{}),
       achievements,challenges,next_actions:nextActions,evidence_reference:evidence
      },"Report submitted to its named recipient.");}}>
       <h3 className="text-sm font-bold">{action.returnedId?"Revise returned report":"Report for period "+line.next_cycle_index}</h3>
       <label className={label}>Achievements and actual work completed<textarea required minLength={20} maxLength={3000} rows={3} className={input} value={achievements} onChange={e=>setAchievements(e.target.value)}/></label>
       <label className={label}>Problems, delays or help required<textarea maxLength={2500} rows={2} className={input} value={challenges} onChange={e=>setChallenges(e.target.value)}/></label>
       <label className={label}>Next actions, responsible persons and dates<textarea required minLength={10} maxLength={2500} rows={2} className={input} value={nextActions} onChange={e=>setNextActions(e.target.value)}/></label>
       <label className={label}>Evidence references (no child/private school records)<input className={input} maxLength={700} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
       <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white">Send report</button><button type="button" onClick={()=>setAction(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs">Cancel</button></div>
      </form>}
      {history.length>0&&<details className="mt-4 rounded-xl bg-slate-50 p-3" open={false}>
       <summary className="cursor-pointer text-xs font-bold">Reporting history ({history.length} visible)</summary>
       <div className="mt-3 space-y-3">
        {history.map(s=><div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
         <div className="flex flex-wrap items-center justify-between gap-2"><strong>Period {s.cycle_index} · Due {s.due_on}</strong>
          <span className={"font-bold "+(s.status==="accepted"?"text-emerald-700":s.status==="returned"?"text-amber-800":"text-slate-600")}>{caps(s.status)}</span></div>
         <p className="mt-2 whitespace-pre-wrap"><strong>Work:</strong> {s.achievements}</p>
         {s.challenges&&<p className="mt-1 whitespace-pre-wrap"><strong>Challenges:</strong> {s.challenges}</p>}
         <p className="mt-1 whitespace-pre-wrap"><strong>Next:</strong> {s.next_actions}</p>
         {s.review_note&&<p className="mt-2 rounded-lg bg-blue-50 p-2"><strong>Reviewer response:</strong> {s.review_note}</p>}
         {s.status==="submitted"&&line.reviewer_user_id===viewer?.userId&&<div className="mt-3">
          <button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white" onClick={()=>{setAction({id:s.id,kind:"review"});setReviewNote("");setDecision("accept");}}>Review submitted report</button>
          {action?.id===s.id&&action.kind==="review"&&<form className="mt-3 space-y-2 rounded-lg bg-blue-50 p-3"
           onSubmit={e=>{e.preventDefault();void act("review_report",{id:s.id,decision,review_note:reviewNote},"Recipient decision recorded.");}}>
           <label className={label}>Decision<select className={input} value={decision} onChange={e=>setDecision(e.target.value)}>
            <option value="accept">Accept</option><option value="return">Return for correction</option></select></label>
           <label className={label}>Reason and required follow-up<textarea required minLength={15} maxLength={1500} className={input} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} rows={2}/></label>
           <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Record review</button><button type="button" onClick={()=>setAction(null)} className="rounded-lg border px-3 py-2 text-xs">Close</button></div>
          </form>}
         </div>}
        </div>)}
       </div>
      </details>}
     </article>;
    })}
   </section>
   <footer className="py-4 text-xs leading-6 text-slate-600">
    <FileCheck2 className="mr-1 inline size-4"/>A report's acceptance verifies the submitted report, not necessarily all underlying school outcomes. Material financial and governance decisions require their separate approval processes.
   </footer>
  </main>
 </div>;
}
