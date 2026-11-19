"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { FinancialSummary } from "@/lib/khpos/ops/school-financial-shared";
import { custodianReportTotals, type CustodianReport, type CustodianReportData } from "@/lib/khpos/ops/custodian-report-shared";

const blank:CustodianReportData={
  feeIncome:0,otherIncome:0,operatingExpenses:0,cashAvailable:0,outstandingFees:0,
  learnerCount:0,schoolCapacity:0,operationalHighlights:"",learningHighlights:"",
  managementRisks:"",nextTermPriorities:"",financialSourceNotes:"Pending approved School Financial Health coverage.",
};
const moneyLabels:Array<[keyof CustodianReportData,string]>=[
  ["feeIncome","Tuition and school fees received (₦)"],
  ["otherIncome","Other operating income received (₦)"],
  ["operatingExpenses","Operating expenditure (₦)"],
  ["cashAvailable","Available cash reported (₦)"],
  ["outstandingFees","Unpaid school fees (₦)"],
  ["learnerCount","Enrolled learners"],
  ["schoolCapacity","School capacity"],
];
const notes:Array<[keyof CustodianReportData,string,string]>=[
  ["operationalHighlights","School operations and management performance","Summarise staff delivery, attendance, completed work and outstanding management matters."],
  ["learningHighlights","Teaching, learning and human-potential progress","Summarise measured learner progress, quality assurance and project outcomes."],
  ["managementRisks","Material risks and management responses","State material financial, safeguarding, operational or regulatory risks and actions."],
  ["nextTermPriorities","Priorities for the next term","List the key outcomes, responsible management actions and targets."],

];
const small="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-950";
const button="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-50";
const primary="min-h-11 rounded-xl bg-brand-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50";
type FormState={id:string;termLabel:string;periodStart:string;periodEnd:string;data:CustodianReportData;status:"draft"|"approved"};
const fresh=():FormState=>({id:"",termLabel:"",periodStart:"",periodEnd:"",data:{...blank},status:"draft"});
function fromReport(report:CustodianReport):FormState {
  return {id:report.id,termLabel:report.term_label,periodStart:report.period_start,periodEnd:report.period_end,
    data:{...blank,...report.data},status:report.status};
}
export function CustodianInvestorReportsPanel({organisationId}:{organisationId:string}) {
  const [allowed,setAllowed]=useState(false);
  const [schoolName,setSchoolName]=useState("");
  const [reports,setReports]=useState<CustodianReport[]>([]);
  const [form,setForm]=useState<FormState>(fresh);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [financeCoverage,setFinanceCoverage]=useState<FinancialSummary|null>(null);
  const endpoint="/api/khpos/ops/investor-reports/"+organisationId;

  const token=useCallback(async()=>{
    const client=createBrowserSupabaseClient();
    const session=(await client?.auth.getSession())?.data.session;
    if(!session?.access_token)throw new Error("Sign in to access the Custodian report.");
    return session.access_token;
  },[]);
  const load=useCallback(async()=>{
    try{
      const access=await token();
      const response=await fetch(endpoint,{headers:{Authorization:"Bearer "+access},cache:"no-store"});
      if(response.status===403){setAllowed(false);return;}
      const json=await response.json() as {ok?:boolean;error?:string;schoolName?:string;reports?:CustodianReport[]};
      if(!response.ok||!json.ok)throw new Error(json.error||"Unable to load Custodian reports.");
      setAllowed(true);
      setSchoolName(json.schoolName||"");
      setReports(json.reports??[]);
    }catch(cause){setError(cause instanceof Error?cause.message:"Unable to load Custodian reports.");}
  },[endpoint,token]);
  useEffect(()=>{const first=window.setTimeout(()=>{void load();},0);return ()=>window.clearTimeout(first);},[load]);

  // The financial section is display-only. Approved underlying finance statements
  // are the sole source of numbers when saving and approving institutional reports.
  useEffect(()=>{
    if(!allowed||form.status==="approved"||!/^\d{4}-\d{2}-\d{2}$/.test(form.periodStart)||
       !/^\d{4}-\d{2}-\d{2}$/.test(form.periodEnd)||form.periodStart>form.periodEnd)return;
    let active=true;
    const {periodStart,periodEnd}=form;
    const timer=window.setTimeout(()=>{
      void (async()=>{
        try{
          const access=await token();
          const params=new URLSearchParams({summary:"1",from:periodStart,to:periodEnd});
          const response=await fetch(endpoint+"?"+params.toString(),{headers:{Authorization:"Bearer "+access},cache:"no-store"});
          const json=await response.json() as {ok?:boolean;summary?:FinancialSummary};
          if(!response.ok||!json.ok||!json.summary)throw new Error("Coverage not available.");
          if(!active)return;
          const summary=json.summary;
          setFinanceCoverage(summary);
          setForm(current=>{
            if(current.status==="approved"||current.periodStart!==periodStart||current.periodEnd!==periodEnd)return current;
            return {...current,data:{...current.data,
              feeIncome:summary.complete?summary.feeIncome:0,
              otherIncome:summary.complete?summary.otherIncome:0,
              operatingExpenses:summary.complete?summary.operatingExpenses:0,
              cashAvailable:summary.complete?summary.cashAvailable??0:0,
              outstandingFees:summary.complete?summary.outstandingFees??0:0,
              learnerCount:summary.complete?summary.learnerCount??0:0,
              schoolCapacity:summary.complete?summary.schoolCapacity??0:0,
              financialSourceNotes:summary.complete
                ? "Auto-synced from "+summary.periods+" approved School Financial Health period(s)."
                : "PENDING: Approved School Financial Health periods do not fully cover this term.",
              financeSourcePeriodIds:summary.complete?summary.approvedIds:[],
            }};
          });
        }catch{if(active)setFinanceCoverage(null);}
      })();
    },250);
    return ()=>{active=false;window.clearTimeout(timer);};
  },[allowed,endpoint,form.periodStart,form.periodEnd,form.status,token]);

  function updateData(key:keyof CustodianReportData,value:number|string){
    setForm(current=>({...current,data:{...current.data,[key]:value}}));
  }
  async function action(mode:"save"|"approve"){
    if(busy)return;
    setError("");setNotice("");setBusy(true);
    try{
      if(mode==="approve"&&!window.confirm("Approve this termly institutional report? Approved reports cannot be edited."))return;
      const access=await token();
      const input=mode==="save" ? {
        mode,id:form.id||undefined,termLabel:form.termLabel.trim(),periodStart:form.periodStart,
        periodEnd:form.periodEnd,data:form.data,
      } : {mode,id:form.id};
      const res=await fetch(endpoint,{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},body:JSON.stringify(input)});
      const json=await res.json() as {ok?:boolean;id?:string;error?:string;reports?:CustodianReport[]};
      if(!res.ok||!json.ok)throw new Error(json.error||"Report could not be saved.");
      setReports(json.reports??[]);
      const chosen=(json.reports??[]).find(report=>report.id===json.id);
      if(chosen)setForm(fromReport(chosen));
      setNotice(mode==="approve"?"Custodian approval recorded. PDF and Word reports can now be issued.":"Draft saved privately for the Custodian.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Report action failed.");}
    finally{setBusy(false);}
  }
  async function download(format:"pdf"|"docx"){
    if(!form.id||busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const access=await token();
      const res=await fetch(endpoint+"?format="+format+"&report="+encodeURIComponent(form.id),{
        headers:{Authorization:"Bearer "+access},cache:"no-store",
      });
      if(!res.ok){const json=await res.json() as {error?:string};throw new Error(json.error||"Download failed.");}
      const blob=await res.blob(),url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;
      link.download="KAEC-Confidential-"+form.termLabel.replace(/[^a-zA-Z0-9-]+/g,"-")+"."+format;
      document.body.append(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
      setNotice(format==="pdf"?"PDF downloaded.":"Editable Word document downloaded.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Download failed.");}
    finally{setBusy(false);}
  }
  if(!allowed)return null;
  const totals=custodianReportTotals(form.data);
  const formatMoney=(value:number)=>"₦"+new Intl.NumberFormat("en-NG",{maximumFractionDigits:0}).format(value);
  return <details className="khpos-interface-card overflow-hidden border-2 border-brand-200 bg-white" id="custodian-investor-report">
    <summary className="cursor-pointer bg-brand-50 p-4 text-base font-black text-brand-950 sm:p-5">
      <span className="block text-xs font-black uppercase tracking-wide text-brand-700">Restricted to authorised School Custodians</span>
      Termly institutional performance and financial health
      <span className="mt-2 block text-sm font-normal text-slate-700">Prepare, approve and download a confidential investor report. Investors have no KHP-OS access through this feature.</span>
    </summary>
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-sm font-bold">Choose a report
          <select className={small+" mt-1"} value={form.id} onChange={event=>{
            const selected=reports.find(report=>report.id===event.target.value);
            setForm(selected?fromReport(selected):fresh());setError("");setNotice("");
          }}>
            <option value="">New termly report</option>
            {reports.map(report=><option key={report.id} value={report.id}>{report.term_label} · {report.status}</option>)}
          </select>
        </label>
        <button type="button" className={button} onClick={()=>{setForm(fresh());setError("");setNotice("");}}>New termly report</button>
      </div>
      {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-950">{error}</p>}
      {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <p className="text-sm font-semibold text-slate-700">School: {schoolName}. {form.status==="approved"?"This report is approved and read-only.":"Drafts are private until the Custodian approves them."}</p>
      <form className="space-y-5" onSubmit={event=>{event.preventDefault();void action("save");}}>
        <fieldset disabled={form.status==="approved"||busy} className="space-y-5 disabled:opacity-70">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-bold">School term
              <input required minLength={4} maxLength={120} className={small+" mt-1"} value={form.termLabel} placeholder="2026/27 · Term 1"
                onChange={event=>setForm(current=>({...current,termLabel:event.target.value}))}/>
            </label>
            <label className="text-sm font-bold">Period starts
              <input required type="date" className={small+" mt-1"} value={form.periodStart}
                onChange={event=>setForm(current=>({...current,periodStart:event.target.value}))}/>
            </label>
            <label className="text-sm font-bold">Period ends
              <input required type="date" min={form.periodStart||undefined} className={small+" mt-1"} value={form.periodEnd}
                onChange={event=>setForm(current=>({...current,periodEnd:event.target.value}))}/>
            </label>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-950">School Financial Health</h3>
            <p className="mt-1 text-sm text-slate-700">These figures are automatically sourced from approved School Financial Health records, not entered again in this report. They remain management-approved, not audited accounts.</p>
            <Link className="mt-2 inline-block text-sm font-bold text-brand-700 underline" href={"/khpos/"+organisationId+"/financial-health"}>Open School Financial Health</Link>
            {form.status!=="approved"&&form.periodStart&&form.periodEnd&&<p className={"mt-2 rounded-xl p-3 text-sm "+(financeCoverage?.complete?"bg-emerald-50 text-emerald-900":"bg-amber-50 text-amber-950")}>{financeCoverage?.complete?"Approved financial source complete for this term.":"Financial data incomplete. The Custodian cannot approve this report until all dates are covered by approved financial periods."}{financeCoverage?.missing?.length?" Missing: "+financeCoverage.missing.join("; "):""}</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {moneyLabels.map(([key,label])=><label key={key} className="text-sm font-bold">{label}
                <input type="number" min={0} step={1} readOnly required className={small+" mt-1 bg-slate-100"} value={form.data[key] as number}/>
              </label>)}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-700">Total operating income</p><p className="mt-1 text-xl font-black">{formatMoney(totals.income)}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-700">Operating result before tax and financing</p>
                <p className="mt-1 text-xl font-black">{formatMoney(totals.operatingResult)}</p></div>
            </div>
          </div>
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">Financial source: {form.data.financialSourceNotes}</p>
          <div className="grid gap-4">
            {notes.map(([key,label,help])=><label key={key} className="text-sm font-bold">
              {label}<span className="mt-1 block text-xs font-normal text-slate-600">{help}</span>
              <textarea required minLength={10} maxLength={5000} rows={3} className={small+" mt-1"}
                value={form.data[key] as string} onChange={event=>updateData(key,event.target.value)}/>
            </label>)}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          {form.status!=="approved"&&<button type="submit" disabled={busy} className={primary}>{busy?"Working…":"Save private draft"}</button>}
          {form.id&&form.status==="draft"&&<button type="button" disabled={busy} className={button} onClick={()=>void action("approve")}>Approve institutional report</button>}
          {form.id&&<button type="button" disabled={busy} className={button} onClick={()=>void download("pdf")}>Download PDF</button>}
          {form.id&&<button type="button" disabled={busy} className={button} onClick={()=>void download("docx")}>Download Word (.docx)</button>}
        </div>
      </form>
      <p className="text-xs leading-6 text-slate-600">This document is made available solely to the authorised School Custodian inside KHP-OS. Sending an approved file outside the application remains a deliberate Custodian action, subject to the school management agreement and investors' lawful information rights.</p>
    </div>
  </details>;
}
