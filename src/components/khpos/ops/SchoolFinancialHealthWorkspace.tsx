"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { deriveFinancialHealth, moneyFormat, type FinancialInput, type FinancialPeriod } from "@/lib/khpos/ops/school-financial-shared";

type Editor=FinancialInput&{id:string;status:FinancialPeriod["status"]};
const fields: Array<[keyof FinancialInput,string,string]>= [
  ["feeIncome","Tuition and school fees received","Actual collections for this period, excluding unpaid fees"],
  ["otherIncome","Other operating income","Cash received from other school activities"],
  ["operatingExpenses","Operating expenses","Payments and recorded operating costs, excluding capital expenditure"],
  ["cashAvailable","Available cash at period end","Bank and cash balances; this is not profit"],
  ["outstandingFees","Outstanding school fees at period end","Unpaid amounts owed by families"],
  ["learnerCount","Enrolled learners at period end","Learners actually enrolled"],
  ["schoolCapacity","School capacity","Safe approved capacity"],
  ["breakEvenTarget","Budgeted break-even enrolment","Optional target from an approved school budget, not calculated from revenue"],
];
function firstOfMonth(){
  const s=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit"}).format(new Date());
  return s+"-01";
}
function endOfMonth(s:string){
  const [y,m]=s.split("-").map(Number);
  return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
}
const blank=():Editor=>({
  id:"",status:"draft",periodStart:firstOfMonth(),periodEnd:endOfMonth(firstOfMonth()),
  feeIncome:0,otherIncome:0,operatingExpenses:0,cashAvailable:0,outstandingFees:0,
  learnerCount:0,schoolCapacity:0,breakEvenTarget:null,sourceNote:"",managementNote:"",
});
const fromPeriod=(p:FinancialPeriod):Editor=>({
  id:p.id,status:p.status,periodStart:p.period_start,periodEnd:p.period_end,
  feeIncome:p.fee_income,otherIncome:p.other_income,operatingExpenses:p.operating_expenses,
  cashAvailable:p.cash_available,outstandingFees:p.outstanding_fees,
  learnerCount:p.learner_count,schoolCapacity:p.school_capacity,breakEvenTarget:p.break_even_target,
  sourceNote:p.source_note,managementNote:p.management_note,
});
const input="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-950";
const button="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-50";
const primary="min-h-11 rounded-xl bg-brand-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50";
export function SchoolFinancialHealthWorkspace({organisationId}:{organisationId:string}){
  const [periods,setPeriods]=useState<FinancialPeriod[]>([]);
  const [schoolName,setSchoolName]=useState("");
  const [canEdit,setCanEdit]=useState(false);
  const [canApprove,setCanApprove]=useState(false);
  const [form,setForm]=useState<Editor>(blank);
  const [reviewNote,setReviewNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const endpoint="/api/khpos/ops/financial-health/"+organisationId;
  const auth=useCallback(async()=>{
    const supabase=createBrowserSupabaseClient();
    const session=(await supabase?.auth.getSession())?.data.session;
    if(!session)throw new Error("Sign in to open School Financial Health.");
    return session.access_token;
  },[]);
  const load=useCallback(async()=>{
    try{
      const token=await auth();
      const response=await fetch(endpoint,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      const json=await response.json() as {ok?:boolean;error?:string;schoolName?:string;canEdit?:boolean;canApprove?:boolean;periods?:FinancialPeriod[]};
      if(!response.ok||!json.ok)throw new Error(json.error||"School finances could not be loaded.");
      setPeriods(json.periods??[]);
      setSchoolName(json.schoolName??"");
      setCanEdit(Boolean(json.canEdit));
      setCanApprove(Boolean(json.canApprove));
      setError("");
    }catch(cause){setError(cause instanceof Error?cause.message:"Unable to load financial health.");}
    finally{setLoading(false);}
  },[auth,endpoint]);
  useEffect(()=>{const t=window.setTimeout(()=>{void load();},0);return ()=>window.clearTimeout(t);},[load]);
  const selected=periods.find(p=>p.id===form.id);
  const approved=periods.filter(p=>p.status==="approved").sort((a,b)=>b.period_end.localeCompare(a.period_end));
  const latest=approved[0];
  const latestSummary=useMemo(()=>{
    if(!latest)return null;
    return deriveFinancialHealth([latest],latest.period_start,latest.period_end);
  },[latest]);
  const reviewed=periods.filter(p=>p.status==="submitted").length;
  const outstanding=periods.filter(p=>p.status!=="approved").length;
  const editable=canEdit&&(form.status==="draft"||form.status==="returned");
  const sourceComplete=Boolean(latestSummary?.complete);

  async function act(mode:"save"|"submit"|"approve"|"return"){
    if(busy)return;
    setError("");setNotice("");setBusy(true);
    try{
      const token=await auth();
      const {id}=form;
      const {periodStart,periodEnd,feeIncome,otherIncome,operatingExpenses,cashAvailable,outstandingFees,learnerCount,schoolCapacity,breakEvenTarget,sourceNote,managementNote}=form;
      const values={periodStart,periodEnd,feeIncome,otherIncome,operatingExpenses,cashAvailable,outstandingFees,learnerCount,schoolCapacity,breakEvenTarget,sourceNote,managementNote};
      if(mode!=="save"&&!id)throw new Error("Save the draft first.");
      if((mode==="return"||mode==="approve")&&reviewNote.trim().length<10)
        throw new Error("Provide a Custodian review note of at least 10 characters.");
      if(mode==="approve"&&!window.confirm("Approve this period as an official source for school financial health and termly investor reports? Approved periods are locked."))return;
      const body=mode==="save"?{mode,id:id||undefined,input:values}:{mode,id,reviewNote};
      const res=await fetch(endpoint,{method:"POST",headers:{
        Authorization:"Bearer "+token,"Content-Type":"application/json",
      },body:JSON.stringify(body)});
      const json=await res.json() as {ok?:boolean;error?:string;id?:string;periods?:FinancialPeriod[]};
      if(!res.ok||!json.ok)throw new Error(json.error||"The finance action failed.");
      const rows=json.periods??[];
      setPeriods(rows);
      const next=rows.find(p=>p.id===json.id);
      if(next)setForm(fromPeriod(next));
      setReviewNote("");
      setNotice(mode==="save"?"Finance draft saved.":mode==="submit"?"Submitted for School Custodian review.":mode==="approve"?"Approved and locked. This period can now feed investor reporting.":"Returned to Finance/Admin for correction.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not save financial period.");}
    finally{setBusy(false);}
  }
  function setMoney(key:keyof FinancialInput,value:string){
    if(key==="breakEvenTarget"){setForm(v=>({...v,breakEvenTarget:value===""?null:Math.max(0,Number(value)||0)}));return;}
    setForm(v=>({...v,[key]:Math.max(0,Number(value)||0)}));
  }
  if(loading)return <main className="khpos-interface-page mx-auto max-w-6xl p-5"><p className="text-sm text-slate-700">Checking access to school financial records</p></main>;
  return <main className="khpos-interface-page mx-auto max-w-6xl space-y-5 p-4 pb-20 sm:p-6">
    <header className="khpos-interface-card space-y-2 p-5 sm:p-7">
      <p className="text-xs font-black uppercase tracking-widest text-brand-700">School management · Restricted financial records</p>
      <h1 className="text-3xl font-black text-slate-950">School Financial Health</h1>
      <p className="max-w-3xl text-sm leading-6 text-slate-700">{schoolName}. Finance/Admin records one statement for each accounting period. Only a School Custodian can approve financial figures for official institutional reports.</p>
      <p className="text-xs text-slate-600">Not an accounting package or independent audit. Enter reconciled numbers from your school’s financial records. Investors do not have access to this workspace.</p>
    </header>
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error} <button className="underline" onClick={()=>void load()}>Retry</button></p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-950">{notice}</p>}
    <section className="khpos-interface-card space-y-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-slate-950">Last approved financial period</h2>
        <span className="text-xs font-semibold text-slate-700">{latest?latest.period_start+" – "+latest.period_end:"No approved financial periods yet"}</span>
      </div>
      {sourceComplete&&latestSummary?<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ["Operating income",moneyFormat(latestSummary.income)],
          ["Operating result",moneyFormat(latestSummary.operatingResult)],
          ["Operating margin",latestSummary.operatingMargin===null?"Not available":latestSummary.operatingMargin+"%"],
          ["Available cash",moneyFormat(latestSummary.cashAvailable??0)],
          ["Unpaid fees",moneyFormat(latestSummary.outstandingFees??0)],
          ["Enrolled learners",String(latestSummary.learnerCount??0)],
          ["Budget break-even target",latestSummary.breakEvenTarget===null?"Not recorded":String(latestSummary.breakEvenTarget)+" learners"],
          ["Pending approvals",String(reviewed)],
        ] as [string,string][]).map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="mt-1 text-lg font-black text-slate-950 break-words sm:text-xl">{value}</p>
        </div>)}
      </div>:<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">No figures have been approved. Drafts and submitted statements are not counted as confirmed financial performance.</p>}
      <p className="text-xs text-slate-600">Operating result = received fee and other operating income minus recorded operating expenses. This is not audited net profit and may differ from accrual accounts. Break-even enrolment is an optional budget target, not an automatically inferred number.</p>
    </section>
    <section className="khpos-interface-card space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[210px] flex-1">
          <label className="block text-sm font-bold text-slate-900" htmlFor="finance-period-select">Financial reporting periods</label>
          <select id="finance-period-select" className={input+" mt-2"} value={form.id} onChange={event=>{
            const next=periods.find(p=>p.id===event.target.value);
            setForm(next?fromPeriod(next):blank());setReviewNote("");setNotice("");setError("");
          }}>
            <option value="">New financial period</option>
            {periods.map(p=><option key={p.id} value={p.id}>{p.period_start} to {p.period_end} · {p.status}</option>)}
          </select>
        </div>
        {canEdit&&<button type="button" className={button} onClick={()=>{setForm(blank());setReviewNote("");setError("");setNotice("");}}>New period</button>}
      </div>
      <p className="text-sm text-slate-700">{outstanding} period(s) not yet approved. Finance/Admin submits records; the Custodian reviews them before they become reporting evidence. Period dates cannot overlap.</p>
      <form className="space-y-5" onSubmit={event=>{event.preventDefault();void act("save");}}>
        <fieldset className="space-y-5 disabled:opacity-80" disabled={!editable||busy}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-bold text-slate-900">Period starts
              <input required type="date" className={input+" mt-1"} value={form.periodStart}
                onChange={event=>setForm(v=>({...v,periodStart:event.target.value}))}/>
            </label>
            <label className="text-sm font-bold text-slate-900">Period ends
              <input required type="date" min={form.periodStart||undefined} className={input+" mt-1"} value={form.periodEnd}
                onChange={event=>setForm(v=>({...v,periodEnd:event.target.value}))}/>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map(([key,label,help])=><label key={key} className="text-sm font-bold text-slate-900">
              {label}<span className="mt-1 block text-xs font-normal text-slate-600">{help}</span>
              <input type="number" min={0} step={1} required={key!=="breakEvenTarget"} value={form[key]??""}
                className={input+" mt-1"} onChange={event=>setMoney(key,event.target.value)}/>
            </label>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-900">Source and reconciliation evidence
              <span className="mt-1 block text-xs font-normal text-slate-600">Describe the bank statements, ledger and fee register used (at least 10 characters).</span>
              <textarea required minLength={10} maxLength={2500} rows={4} className={input+" mt-1"} value={form.sourceNote}
                onChange={event=>setForm(v=>({...v,sourceNote:event.target.value}))}/>
            </label>
            <label className="text-sm font-bold text-slate-900">Management explanation (optional)
              <span className="mt-1 block text-xs font-normal text-slate-600">Explain significant variances, cash risks, or corrective actions.</span>
              <textarea maxLength={3000} rows={4} className={input+" mt-1"} value={form.managementNote}
                onChange={event=>setForm(v=>({...v,managementNote:event.target.value}))}/>
            </label>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black uppercase text-slate-700">Status: {form.status}</span>
          {editable&&<button type="submit" disabled={busy} className={primary}>{busy?"Saving…":"Save draft"}</button>}
          {form.id&&editable&&<button type="button" disabled={busy} className={button} onClick={()=>void act("submit")}>Submit to Custodian</button>}
        </div>
      </form>
      {form.id&&form.status==="submitted"&&canApprove&&<div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <h3 className="text-base font-black text-slate-950">Custodian review and approval</h3>
        <p className="text-xs text-slate-700">Check reconciled source records before approval. Approval locks the figures and makes them eligible for termly investor reporting.</p>
        <label className="block text-sm font-bold">Review and verification note
          <textarea minLength={10} maxLength={1000} className={input+" mt-2"} rows={3} value={reviewNote}
            onChange={event=>setReviewNote(event.target.value)} placeholder="Record the checks performed and any concerns."/>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primary} disabled={busy||reviewNote.trim().length<10} onClick={()=>void act("approve")}>Approve and lock</button>
          <button type="button" className={button} disabled={busy||reviewNote.trim().length<10} onClick={()=>void act("return")}>Return for correction</button>
        </div>
      </div>}
      {selected?.review_note&&<p className="rounded-xl border border-slate-200 p-3 text-sm text-slate-800">Last Custodian review: {selected.review_note}</p>}
    </section>
    {canApprove&&<p className="text-sm text-slate-600">Preparing the termly institutional report? <Link href={"/khpos/"+organisationId+"/reports#custodian-investor-report"} className="font-bold text-brand-700 underline">Open Custodian investor reports</Link>. Approved periods will be used as the financial source when they fully cover the selected reporting dates.</p>}
  </main>;
}
