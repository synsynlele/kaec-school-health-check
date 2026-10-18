"use client";

import Link from "next/link";
import { useCallback,useEffect,useMemo,useState } from "react";
import {
  ArrowLeft,BookOpen,CalendarCheck2,CheckCircle2,ClipboardList,MapPinned,
  ShieldCheck,Loader2,Plus,RefreshCw,Search,Users,Video,
} from "lucide-react";
import {createBrowserSupabaseClient} from "@/lib/supabase/client";
import {PathfinderSchedulePanel} from "@/components/khpos/PathfinderSchedulePanel";
import type {
  SchoolDeskSnapshot,SchoolEngagement,SchoolCommitment,
} from "@/lib/khpos/hq-schools";

const control="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-700";
const label="block space-y-1.5 text-xs font-bold text-slate-600";
type AgreementDraft={
  id:string;agreement_reference:string;agreed_scope:string;representative_user_id:string;
  school_liaison:string;next_virtual_check_on:string;next_site_visit_on:string;
  engagement_status:string;confirm_verified:boolean;
};
type CommitmentDraft={
  engagement_id:string;title:string;agreed_expectation:string;agreement_clause:string;
  evidence_expected:string;priority:string;due_on:string;next_followup_on:string;followup_mode:string;
};
function agreementForm(e:SchoolEngagement):AgreementDraft {
  return {id:e.id,agreement_reference:e.agreement_reference,agreed_scope:e.agreed_scope,
    representative_user_id:e.representative_user_id??"",school_liaison:e.school_liaison,
    next_virtual_check_on:e.next_virtual_check_on??"",next_site_visit_on:e.next_site_visit_on??"",
    engagement_status:e.engagement_status,confirm_verified:false};
}
function newCommitment(id:string):CommitmentDraft {
  return {engagement_id:id,title:"",agreed_expectation:"",agreement_clause:"",
    evidence_expected:"",priority:"normal",due_on:"",next_followup_on:"",followup_mode:"virtual"};
}
function labelOf(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());}
function dateOf(value:string|null){return value||"Not scheduled";}
function stageTone(value:string){
  if(value==="verified"||value==="active")return "bg-emerald-50 text-emerald-800";
  if(value==="blocked"||value==="paused")return "bg-red-50 text-red-800";
  if(value==="evidence_submitted"||value==="setup")return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-700";
}
export function SchoolPathfinderDesk() {
  const client=useMemo(()=>createBrowserSupabaseClient(),[]);
  const [desk,setDesk]=useState<SchoolDeskSnapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [selectedSchool,setSelectedSchool]=useState("");
  const [schoolQuery,setSchoolQuery]=useState("");
  const [newOrganisation,setNewOrganisation]=useState("");
  const [agreement,setAgreement]=useState<AgreementDraft|null>(null);
  const [commitment,setCommitment]=useState<CommitmentDraft|null>(null);
  const [currentAction,setCurrentAction]=useState<{kind:"progress"|"followup"|"verify";id:string}|null>(null);
  const [actionStatus,setActionStatus]=useState("in_progress");
  const [actionNote,setActionNote]=useState("");
  const [actionReference,setActionReference]=useState("");
  const [followupMode,setFollowupMode]=useState("phone");
  const [nextFollowup,setNextFollowup]=useState("");
  const [nextVisit,setNextVisit]=useState("");
  const [decision,setDecision]=useState("verify");
  const load=useCallback(async()=>{
    if(!client){setError("School sign-in is unavailable.");setLoading(false);return;}
    try {
      const {data}=await client.auth.getSession();
      if(!data.session?.access_token){setError("Sign in with your corporate account to access School Pathfinders.");setLoading(false);return;}
      const res=await fetch("/api/khpos/hq/schools",{headers:{Authorization:"Bearer "+data.session.access_token},cache:"no-store"});
      const body=await res.json() as {ok?:boolean;desk?:SchoolDeskSnapshot;error?:string};
      if(!res.ok||!body.ok||!body.desk){setError(body.error??"School desk could not load.");setLoading(false);return;}
      setDesk(body.desk);setError("");setLoading(false);
    }catch{setError("School desk is temporarily unreachable.");setLoading(false);}
  },[client]);
  useEffect(()=>{const id=window.setTimeout(()=>{void load();},0);return ()=>window.clearTimeout(id);},[load]);
  async function act(action:string,body:Record<string,unknown>,successLabel:string){
    if(!client)return false;
    setBusy(true);setError("");setNotice("");
    try{
      const {data}=await client.auth.getSession();
      const token=data.session?.access_token;
      if(!token){setError("Your session has expired. Sign in again.");return false;}
      const response=await fetch("/api/khpos/hq/schools",{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
        body:JSON.stringify({action,...body})
      });
      const result=await response.json() as {ok?:boolean;desk?:SchoolDeskSnapshot;error?:string};
      if(!response.ok||!result.ok||!result.desk){setError(result.error??"Action could not be completed.");return false;}
      setDesk(result.desk);setNotice(successLabel);return true;
    }catch{setError("The action failed. Check your connection and retry.");return false;}
    finally{setBusy(false);}
  }
  const canGovern=desk?.viewer.role==="vision_custodian"||desk?.viewer.role==="alliance_catalyst";
  const isVision=desk?.viewer.role==="vision_custodian";
  const today=desk?.generated_at.slice(0,10)??"";
  const selected=desk?.engagements.find(e=>e.id===selectedSchool)??null;
  const partnerName=(organisationId:string)=>desk?.organisations.find(s=>s.id===organisationId)?.name??"Registered partner school";
  const memberName=(id:string|null)=>id ? desk?.members.find(m=>m.user_id===id)?.display_name??"Appointed Pathfinder" : "Unassigned";
  const visibleSchools=(desk?.engagements??[]).filter(e=>partnerName(e.organisation_id).toLowerCase().includes(schoolQuery.toLowerCase()));
  const scopedCommitments=(desk?.commitments??[]).filter(c=>selected?.id===c.engagement_id);
  const outstanding=(desk?.commitments??[]).filter(c=>!["verified","cancelled"].includes(c.status));
  const overdue=outstanding.filter(c=>!!today&&!!c.due_on&&c.due_on<today);
  const awaiting=(desk?.commitments??[]).filter(c=>c.status==="evidence_submitted");
  const blocked=(desk?.commitments??[]).filter(c=>c.status==="blocked");
  const schoolNextFollowup=(id:string)=>{
    const commits=(desk?.commitments??[]).filter(c=>c.engagement_id===id);
    const explicit=commits.flatMap(c=>(desk?.followups??[]).filter(f=>f.commitment_id===c.id && f.next_followup_on)
      .map(f=>f.next_followup_on as string));
    const dates=[...commits.flatMap(c=>c.next_followup_on?[c.next_followup_on]:[]),...explicit];
    return dates.sort()[0]??"Not set";
  };
  function canVerify(c:SchoolCommitment,e:SchoolEngagement){
    return !!desk && canGovern && c.status==="evidence_submitted" &&
      c.updated_by!==desk.viewer.userId && e.representative_user_id!==desk.viewer.userId;
  }
  function canLog(e:SchoolEngagement){
    return !!desk && e.engagement_status==="active" &&
      (canGovern || (desk.viewer.role==="school_pathfinder" && e.representative_user_id===desk.viewer.userId));
  }
  function openAction(kind:"progress"|"followup"|"verify",item:SchoolCommitment){
    setCurrentAction({kind,id:item.id});setActionStatus("in_progress");setActionNote("");
    setActionReference(item.evidence_reference??"");setNextFollowup("");
    setNextVisit("");setFollowupMode("phone");setDecision("verify");setError("");
  }
  async function submitAction(item:SchoolCommitment) {
    if(!currentAction)return;
    const kind=currentAction.kind;
    const done=await act(kind==="progress"?"progress":kind==="followup"?"followup":"verify",
      kind==="progress"?{id:item.id,status:actionStatus,progress_note:actionNote,
        evidence_reference:actionReference,next_followup_on:nextFollowup||null}:
      kind==="followup"?{commitment_id:item.id,mode:followupMode,outcome:actionNote,
        evidence_reference:actionReference,next_followup_on:nextFollowup||null,next_visit_on:nextVisit||null}:
        {id:item.id,decision,decision_note:actionNote},
      kind==="followup"?"Follow-up added to the school history.":kind==="progress"?"School progress updated.":"Independent verification decision recorded.");
    if(done)setCurrentAction(null);
  }
  if(loading)return <div className="grid min-h-screen place-items-center bg-slate-950 text-white"><Loader2 className="size-8 animate-spin" aria-label="Loading school desk"/></div>;
  if(!desk)return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
    <div className="max-w-lg rounded-2xl border border-white/20 p-7">
      <h1 className="text-2xl font-black">School Pathfinders</h1>
      <p className="mt-3 text-sm leading-7 text-slate-300">{error||"School oversight is restricted."}</p>
      <Link href="/account" className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-950">Account sign-in</Link>
    </div>
  </main>;
  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <header className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">KAEC-NG · School Execution</p>
          <h1 className="mt-1 text-2xl font-black">School Pathfinders</h1>
          <p className="mt-1 text-xs text-slate-300">Agreement → Commitment → Virtual Follow-up → Evidence → Verification</p>
        </div>
        <div className="flex gap-2">
          <Link href="/khpos/hq" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold"><ArrowLeft className="mr-1 inline size-3.5"/> KAEC HQ</Link>
          <button onClick={()=>void load()} disabled={busy} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold disabled:opacity-40"><RefreshCw className="mr-1 inline size-3.5"/> Refresh</button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {([
          ["Schools supervised",desk.engagements.filter(e=>e.engagement_status==="active").length],
          ["Open commitments",outstanding.length],
          ["Overdue",overdue.length],
          ["Blocked",blocked.length],
          ["Awaiting verification",awaiting.length]
        ] as [string,number][]).map(([title,count])=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-black tabular-nums">{count}</p><p className="mt-1 text-xs font-semibold text-slate-600">{title}</p>
        </div>)}
      </div>
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <strong>Virtual first, visit when necessary.</strong> A registered KHP-OS partner is not automatically under a verified KAEC supervision agreement.
        School commitments are activated only after an authorised leader checks the signed agreement, enters its actual scope, and assigns a Pathfinder.
        This desk records follow-ups; it does not automatically send WhatsApp messages, inspect child records or book visits.
      </div>
      {desk.capped&&<p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">This workspace currently displays a capped set of recent school execution records. Older activity requires paginated reporting.</p>}
      {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-lg font-black"><MapPinned className="size-5 text-emerald-700"/> Partner schools</h2>
            <label className={label+" mt-3"}>Search schools
              <div className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400"/>
                <input value={schoolQuery} onChange={e=>setSchoolQuery(e.target.value)} placeholder="Find a partner" className={control+" pl-9"}/></div>
            </label>
            <div className="mt-3 space-y-2">
              {visibleSchools.map(e=>{
                const n=outstanding.filter(c=>c.engagement_id===e.id);
                return <button key={e.id} onClick={()=>{setSelectedSchool(e.id);setAgreement(null);setCommitment(null);setCurrentAction(null);}}
                  className={"w-full rounded-xl border p-3 text-left "+(selected?.id===e.id?"border-emerald-700 bg-emerald-50":"border-slate-200 hover:bg-slate-50")}>
                  <span className="block text-sm font-black">{partnerName(e.organisation_id)}</span>
                  <span className="mt-1 block text-xs text-slate-600">{labelOf(e.engagement_status)} · {n.length} open · {memberName(e.representative_user_id)}</span>
                </button>;
              })}
              {!visibleSchools.length&&<p className="p-3 text-xs text-slate-500">No school assignment matches. Only schools with authorised HQ links appear here.</p>}
            </div>
          </section>
          {canGovern&&<section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-black"><Plus className="size-4"/> Link a registered partner</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">Creates Setup only. It does not verify a signed licence or grant a school account.</p>
            <label className={label+" mt-3"}>Partner school<select value={newOrganisation} onChange={e=>setNewOrganisation(e.target.value)} className={control}>
              <option value="">Choose a school</option>
              {desk.organisations.filter(s=>!desk.engagements.some(e=>e.organisation_id===s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <button disabled={!newOrganisation||busy} onClick={()=>void act("create_engagement",{organisation_id:newOrganisation},"School added as setup; no agreement verified.").then(done=>{if(done)setNewOrganisation("");})}
              className="mt-3 rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Begin school setup</button>
          </section>}
        </aside>
        <div className="min-w-0 space-y-5">
          {!selected&&<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8">
            <h2 className="text-lg font-black">School Execution Centre</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">Select a linked school or begin a partner-school setup. Each verified agreement becomes a set of actionable commitments with follow-up history, due dates and an accountable KAEC School Pathfinder.</p>
            <p className="mt-3 text-sm text-slate-600">No school has been assigned automatically. The Vision Custodian must confirm actual contract scope and nominate the representative.</p>
          </div>}
          {selected&&<>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">School agreement and ownership</p>
                  <h2 className="mt-1 text-xl font-black">{partnerName(selected.organisation_id)}</h2>
                  <p className="mt-2 text-sm text-slate-600">Pathfinder: {memberName(selected.representative_user_id)} · Status: {labelOf(selected.engagement_status)}</p>
                </div>
                <span className={"rounded-full px-3 py-1.5 text-xs font-bold "+stageTone(selected.engagement_status)}>{labelOf(selected.engagement_status)}</span>
              </div>
              <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div><strong>Agreement reference</strong><p className="mt-1 text-slate-600">{selected.agreement_reference||"Not supplied"}</p></div>
                <div><strong>Verified contract</strong><p className="mt-1 text-slate-600">{selected.contract_verified_at?"Recorded as checked by authorised corporate lead":"Not verified"}</p></div>
                <div><strong>Next virtual check</strong><p className="mt-1 text-slate-600">{dateOf(selected.next_virtual_check_on)}</p></div>
                <div><strong>Next site visit</strong><p className="mt-1 text-slate-600">{dateOf(selected.next_site_visit_on)}</p></div>
              </div>
              {selected.agreed_scope&&<div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700"><strong>Agreed support scope:</strong> {selected.agreed_scope}</div>}
              {(isVision || (canGovern && selected.engagement_status==="setup" && !selected.contract_verified_at))&&<button onClick={()=>{setAgreement(agreementForm(selected));setCommitment(null);}} className="mt-4 rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold">Manage agreement & Pathfinder</button>}
              {!isVision && selected.contract_verified_at && canGovern&&<p className="mt-4 text-xs text-slate-600">Verified agreements may only be revised, paused or ended by the Vision Custodian.</p>}
              {agreement?.id===selected.id&&<form className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                onSubmit={e=>{e.preventDefault();void act("update_engagement",{
                  ...agreement,representative_user_id:agreement.representative_user_id||null,
                  next_virtual_check_on:agreement.next_virtual_check_on||null,
                  next_site_visit_on:agreement.next_site_visit_on||null
                },"School agreement setup updated.").then(done=>{if(done)setAgreement(null);});}}>
                <h3 className="text-sm font-black">Agreement verification and assigned Pathfinder</h3>
                <label className={label}>Signed agreement reference<input className={control} value={agreement.agreement_reference} maxLength={240} onChange={e=>setAgreement({...agreement,agreement_reference:e.target.value})} placeholder="Document number, date or signed agreement ID"/></label>
                <label className={label}>Scope agreed with school<textarea className={control} rows={4} maxLength={3000} value={agreement.agreed_scope} onChange={e=>setAgreement({...agreement,agreed_scope:e.target.value})} placeholder="Specific services and supervision boundaries actually agreed"/></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>KAEC School Pathfinder<select className={control} value={agreement.representative_user_id} onChange={e=>setAgreement({...agreement,representative_user_id:e.target.value})}>
                    <option value="">Unassigned</option>
                    {desk.members.filter(m=>m.status==="active"&&["school_pathfinder","alliance_catalyst","vision_custodian"].includes(m.role)).map(m=><option value={m.user_id} key={m.user_id}>{m.display_name} — {labelOf(m.role)}</option>)}
                  </select></label>
                  <label className={label}>School liaison (role/name)<input className={control} value={agreement.school_liaison} maxLength={140} onChange={e=>setAgreement({...agreement,school_liaison:e.target.value})}/></label>
                  <label className={label}>Next virtual check<input className={control} type="date" value={agreement.next_virtual_check_on} onChange={e=>setAgreement({...agreement,next_virtual_check_on:e.target.value})}/></label>
                  <label className={label}>Next site visit (if needed)<input className={control} type="date" value={agreement.next_site_visit_on} onChange={e=>setAgreement({...agreement,next_site_visit_on:e.target.value})}/></label>
                  <label className={label}>Engagement state<select className={control} value={agreement.engagement_status} onChange={e=>setAgreement({...agreement,engagement_status:e.target.value})}>
                    <option value="setup">Setup — not operational</option>
                    {isVision&&<option value="active">Activate verified agreement</option>}
                    <option value="paused">Pause supervision</option>
                    {isVision&&<option value="ended">End supervision</option>}
                  </select></label>
                </div>
                {isVision&&<label className="flex items-start gap-3 rounded-lg bg-white p-3 text-xs leading-5"><input type="checkbox" className="mt-1" checked={agreement.confirm_verified} onChange={e=>setAgreement({...agreement,confirm_verified:e.target.checked})}/>I have checked the actual signed agreement outside KAEC HQ and confirm that its reference and scope are accurate. This does not sign or modify the contract.</label>}
                <div className="flex flex-wrap gap-2"><button disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Save supervision setup</button>
                  <button type="button" onClick={()=>setAgreement(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold">Close</button></div>
              </form>}
            </section>
            <PathfinderSchedulePanel key={selected.id} engagement={selected} viewer={desk.viewer} members={desk.members}/>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="text-lg font-black">Agreed work to be done</h2>
                  <p className="mt-1 text-xs text-slate-600">Commitments come from the actual contract or signed implementation plan, not generic school targets.</p></div>
                {canGovern&&selected.engagement_status==="active"&&<button onClick={()=>{setCommitment(newCommitment(selected.id));setAgreement(null);}}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"><Plus className="mr-1 inline size-3.5"/> Add agreed action</button>}
              </div>
              {commitment?.engagement_id===selected.id&&<form className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
                onSubmit={e=>{e.preventDefault();void act("add_commitment",{
                  ...commitment,due_on:commitment.due_on||null,next_followup_on:commitment.next_followup_on||null
                },"Agreement-linked school action created.").then(done=>{if(done)setCommitment(null);});}}>
                <label className={label+" sm:col-span-2"}>Action title<input required minLength={4} maxLength={180} className={control} value={commitment.title} onChange={e=>setCommitment({...commitment,title:e.target.value})}/></label>
                <label className={label+" sm:col-span-2"}>What the school agreed to do<textarea required minLength={15} maxLength={3000} rows={3} className={control} value={commitment.agreed_expectation} onChange={e=>setCommitment({...commitment,agreed_expectation:e.target.value})}/></label>
                <label className={label}>Agreement clause / signed action plan reference<input required minLength={4} maxLength={200} className={control} value={commitment.agreement_clause} onChange={e=>setCommitment({...commitment,agreement_clause:e.target.value})}/></label>
                <label className={label}>Evidence to collect<input required minLength={8} maxLength={800} className={control} value={commitment.evidence_expected} onChange={e=>setCommitment({...commitment,evidence_expected:e.target.value})}/></label>
                <label className={label}>Due date<input type="date" className={control} value={commitment.due_on} onChange={e=>setCommitment({...commitment,due_on:e.target.value})}/></label>
                <label className={label}>Next follow-up<input type="date" className={control} value={commitment.next_followup_on} onChange={e=>setCommitment({...commitment,next_followup_on:e.target.value})}/></label>
                <label className={label}>Priority<select className={control} value={commitment.priority} onChange={e=>setCommitment({...commitment,priority:e.target.value})}>{["low","normal","high","critical"].map(p=><option key={p}>{p}</option>)}</select></label>
                <label className={label}>Follow-up method<select className={control} value={commitment.followup_mode} onChange={e=>setCommitment({...commitment,followup_mode:e.target.value})}><option value="virtual">Virtual first</option><option value="onsite">On-site required</option></select></label>
                <div className="sm:col-span-2 flex gap-2"><button disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Add commitment</button>
                  <button type="button" onClick={()=>setCommitment(null)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold">Cancel</button></div>
              </form>}
              <div className="mt-4 space-y-4">
                {scopedCommitments.length===0&&<p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                  No agreed commitments have been entered. This is not a failed school: there is no evidence yet to assess.
                </p>}
                {scopedCommitments.map(c=>{
                  const history=desk.followups.filter(f=>f.commitment_id===c.id);
                  const overdueItem=!!today&&!!c.due_on&&c.due_on<today&&!["verified","cancelled"].includes(c.status);
                  const actor=canLog(selected);
                  return <article key={c.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="text-xs font-bold text-emerald-800">{c.agreement_clause}</p>
                        <h3 className="mt-1 text-base font-black">{c.title}</h3></div>
                      <span className={"rounded-full px-3 py-1 text-xs font-bold "+stageTone(c.status)}>{labelOf(c.status)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{c.agreed_expectation}</p>
                    <p className="mt-2 text-xs text-slate-600"><strong>Evidence expected:</strong> {c.evidence_expected}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                      <span className={overdueItem?"font-bold text-red-700":""}>Due: {dateOf(c.due_on)}{overdueItem?" · Overdue":""}</span>
                      <span>Follow-up: {dateOf(c.next_followup_on)}</span>
                      <span>{labelOf(c.followup_mode)}</span><span>{labelOf(c.priority)} priority</span>
                    </div>
                    {c.progress_note&&<p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700"><strong>Latest progress:</strong> {c.progress_note}</p>}
                    {c.evidence_reference&&<p className="mt-2 text-xs text-slate-600"><strong>Evidence reference:</strong> {c.evidence_reference}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {actor&&!["verified","cancelled"].includes(c.status)&&<>
                        <button type="button" onClick={()=>openAction("followup",c)} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-900"><Video className="mr-1 inline size-3.5"/> Log contact / visit</button>
                        <button type="button" onClick={()=>openAction("progress",c)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Update progress</button>
                      </>}
                      {canVerify(c,selected)&&<button type="button" onClick={()=>openAction("verify",c)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"><ShieldCheck className="mr-1 inline size-3.5"/> Verify evidence</button>}
                    </div>
                    {currentAction?.id===c.id&&<form className="mt-3 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4" onSubmit={e=>{e.preventDefault();void submitAction(c);}}>
                      <p className="text-sm font-black">{currentAction.kind==="followup"?"Record a real virtual contact or site visit":currentAction.kind==="progress"?"Update agreed commitment":"Independent school evidence review"}</p>
                      {currentAction.kind==="progress"&&<label className={label}>Current progress<select className={control} value={actionStatus} onChange={e=>setActionStatus(e.target.value)}>
                        <option value="planned">Planned</option><option value="in_progress">In progress</option>
                        <option value="blocked">Blocked / needs intervention</option>
                        <option value="evidence_submitted">Submit evidence for verification</option>
                      </select></label>}
                      {currentAction.kind==="followup"&&<label className={label}>Contact channel<select className={control} value={followupMode} onChange={e=>setFollowupMode(e.target.value)}>
                        <option value="phone">Phone</option><option value="whatsapp">WhatsApp (manually conducted)</option>
                        <option value="video">Video call</option><option value="email">Email</option><option value="site_visit">On-site visit</option>
                      </select></label>}
                      {currentAction.kind==="verify"&&<label className={label}>Decision<select className={control} value={decision} onChange={e=>setDecision(e.target.value)}>
                        <option value="verify">Evidence verified</option><option value="return">Return for correction</option>
                      </select></label>}
                      <label className={label}>What happened / evidence or decision reason
                        <textarea className={control} required minLength={15} maxLength={3000} rows={3} value={actionNote} onChange={e=>setActionNote(e.target.value)}/>
                      </label>
                      {currentAction.kind!=="verify"&&<label className={label}>Evidence reference (no student private details)<input className={control} maxLength={700} value={actionReference} onChange={e=>setActionReference(e.target.value)} placeholder="Approved document URL/reference, not private student data"/></label>}
                      {currentAction.kind!=="verify"&&<div className="grid gap-3 sm:grid-cols-2">
                        <label className={label}>Next remote check<input className={control} type="date" value={nextFollowup} onChange={e=>setNextFollowup(e.target.value)}/></label>
                        {currentAction.kind==="followup"&&<label className={label}>Next physical visit if needed<input className={control} type="date" value={nextVisit} onChange={e=>setNextVisit(e.target.value)}/></label>}
                      </div>}
                      <div className="flex gap-2"><button className="rounded-lg bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40" disabled={busy}>Save {currentAction.kind==="followup"?"follow-up":currentAction.kind==="progress"?"progress":"decision"}</button>
                        <button type="button" onClick={()=>setCurrentAction(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold">Cancel</button></div>
                    </form>}
                    {history.length>0&&<details className="mt-4 rounded-xl bg-slate-50 p-3">
                      <summary className="cursor-pointer text-xs font-bold">Follow-up history ({history.length} visible)</summary>
                      <div className="mt-3 space-y-2">{history.map(f=><div key={f.id} className="border-l-2 border-emerald-600 pl-3 text-xs leading-5">
                        <strong>{labelOf(f.mode)} · {f.happened_at.slice(0,10)}</strong>
                        <p className="mt-1 whitespace-pre-wrap">{f.outcome}</p>
                        <p className="text-slate-500">Next virtual: {dateOf(f.next_followup_on)} · Visit: {dateOf(f.next_visit_on)}</p>
                      </div>)}</div>
                    </details>}
                  </article>;
                })}
              </div>
            </section>
            <div className="rounded-xl bg-white p-4 text-xs leading-6 text-slate-600">
              <CalendarCheck2 className="mr-2 inline size-4 text-emerald-700"/>Earliest visible next follow-up: {schoolNextFollowup(selected.id)}.
              Due/blocked indicators come from actual recorded commitments; they do not imply that the school has been independently inspected.
            </div>
          </>}
        </div>
      </div>
      <footer className="flex flex-wrap items-center gap-3 border-t border-slate-200 py-5 text-xs text-slate-500">
        <ClipboardList className="size-4"/>School activities remain in KHP-OS. This is corporate agreement supervision, not blanket access to private school records.
        <Link className="font-bold text-emerald-800 underline" href="/khpos/hq"><BookOpen className="mr-1 inline size-3.5"/> HQ Playbooks</Link>
        <Users className="size-4"/> Only appointed KAEC School Pathfinders may operate assigned schools.
        <CheckCircle2 className="size-4"/> Formal verification stays with an independent authorised leader.
      </footer>
    </main>
  </div>;
}
