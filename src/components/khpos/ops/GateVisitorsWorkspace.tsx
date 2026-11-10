"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck, DoorOpen, KeyRound, RefreshCw, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { LoadingScreen } from "@/components/navigation/LoadingScreen";
import type { GateDeskData, GateVisit } from "@/lib/khpos/ops/visitors";

const field="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950 focus-visible:outline-2 focus-visible:outline-blue-700";
const button="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-40";
const purposeLabels:Record<string,string>={
  parent_guardian:"Parent or guardian",appointment:"Meeting",delivery:"Delivery",
  contractor:"Service",official:"Official visit",other:"Other",
};
function timestamp(value:string|null){return value?new Date(value).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"—";}
function statusLabel(status:string){return status==="awaiting_admission"?"Waiting for admission":
  status==="on_campus"?"On campus":status==="departed"?"Departed":"Not admitted";}
export function GateVisitorsWorkspace({organisationId}:{organisationId:string}){
  const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
  const [desk,setDesk]=useState<GateDeskData|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [campusId,setCampusId]=useState("");
  const [deviceLabel,setDeviceLabel]=useState("Visitor tablet");
  const [pairingCode,setPairingCode]=useState("");
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("active");
  const [filterCampus,setFilterCampus]=useState("");
  async function request(input?:Record<string,string>){
    if(!supabase)throw new Error("KHP-OS sign-in is not configured.");
    const {data}=await supabase.auth.getSession();
    const token=data.session?.access_token;
    if(!token)throw new Error("Sign in to your school before opening Gate & Visitors.");
    const response=await fetch(`/api/khpos/ops/visitors/${organisationId}`,{
      ...(input?{method:"POST",body:JSON.stringify(input)}:{}),
      headers:{Authorization:`Bearer ${token}`,...(input?{"Content-Type":"application/json"}:{})},
      cache:"no-store",
    });
    const body=await response.json() as {
      ok?:boolean;error?:string;desk?:GateDeskData;
      pairing?:{code:string;expiresInMinutes:number};
    };
    if(!response.ok||!body.ok)throw new Error(body.error||"Gate & Visitors could not load.");
    return body;
  }
  useEffect(()=>{
    let active=true;
    void request().then(body=>{
      if(!active)return;
      setDesk(body.desk??null);
      setCampusId(body.desk?.campuses[0]?.id??"");
    }).catch(err=>{if(active)setError(err instanceof Error?err.message:"Could not load visitors.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[organisationId]);
  async function act(input:Record<string,string>,key:string){
    setBusy(key);setError("");setNotice("");
    try{
      const body=await request(input.mode ? input : undefined);
      if(body.desk)setDesk(body.desk);
      if(body.pairing){setPairingCode(body.pairing.code);setNotice("Tablet activation code created. It expires in ten minutes.");}
      else setNotice(key==="revoke"?"Tablet access revoked.":"Visitor register updated.");
    }catch(err){setError(err instanceof Error?err.message:"Could not complete this action.");}
    finally{setBusy("");}
  }
  const visits=(desk?.visits??[]).filter(v=>
    (status==="all"||status==="active"&&["awaiting_admission","on_campus"].includes(v.status)||v.status===status) &&
    (!filterCampus||v.campus_id===filterCampus) &&
    [v.visitor_name,v.reference,v.host_name,v.purpose].join(" ").toLowerCase().includes(search.toLowerCase().trim())
  );
  if(loading && !desk && !error)return <LoadingScreen/>;
  if(!desk)return <main className="mx-auto max-w-3xl px-4 py-16">
    <h1 className="text-2xl font-black text-slate-950">Gate & Visitors is unavailable</h1>
    <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error||"Your role does not have access."}</p>
    <Link href={`/khpos/${organisationId}`} className="mt-6 inline-flex min-h-11 items-center text-blue-800 underline">School overview</Link>
  </main>;
  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <section className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link href={`/khpos/${organisationId}/teaching-presence`} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-200">
          <ArrowLeft className="size-4"/> Attendance & lessons
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">School day · Campus safety</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Gate & Visitors</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">Visitors fill in their own details on a school tablet. You confirm admission and see who is still on campus.</p>
          </div>
          <button disabled={!!busy} onClick={()=>void act({},"refresh")} className={button+" border border-white/20 bg-white/10 text-white hover:bg-white/20"}>
            <RefreshCw className="size-4"/> Refresh
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-300/30 bg-white/10 p-4"><p className="text-xs font-bold text-amber-100">Waiting at reception</p><p className="mt-2 text-3xl font-black">{desk.summary.waiting}</p></div>
          <div className="rounded-2xl border border-emerald-300/30 bg-white/10 p-4"><p className="text-xs font-bold text-emerald-100">Visitors on campus</p><p className="mt-2 text-3xl font-black">{desk.summary.onCampus}</p></div>
          <div className="col-span-2 rounded-2xl border border-white/15 bg-white/10 p-4 sm:col-span-1"><p className="text-xs font-bold text-slate-200">Campuses you manage</p><p className="mt-2 text-3xl font-black">{desk.campuses.length}</p></div>
        </div>
      </div>
    </section>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6">
      {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
      {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{notice}</div>}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-800"><KeyRound className="size-5"/></span>
          <div><h2 className="text-xl font-black">Visitor tablet</h2><p className="mt-1 text-sm leading-6 text-slate-600">Visitors use the designated tablet without signing in as staff. Give the one-time code to the tablet operator, not to visitors.</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a target="_blank" rel="noopener noreferrer" href="/khpos/visitor-kiosk" className={button+" border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"}>
            <ClipboardCheck className="size-4"/> Open visitor tablet page
          </a>
        </div>
        {desk.canPair&&<div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm font-bold">Campus
            <select className={field} value={campusId} onChange={e=>{setCampusId(e.target.value);setPairingCode("");}}>
              {desk.campuses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">Device name
            <input className={field} value={deviceLabel} onChange={e=>setDeviceLabel(e.target.value)} maxLength={80} placeholder="Reception tablet"/>
          </label>
          <button disabled={!!busy||!campusId||deviceLabel.trim().length<2} className={button+" min-h-12 bg-slate-950 text-white"}
            onClick={()=>void act({mode:"pair",campusId,deviceLabel},"pair")}>Generate activation code</button>
        </div>}
        {pairingCode&&<div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-800">One-time code · expires after 10 minutes</p>
          <p className="mt-3 break-all font-mono text-3xl font-black tracking-[0.12em] text-slate-950">{pairingCode}</p>
          <p className="mt-2 text-sm text-slate-600">Type this code on the visitor tablet to activate it. The device stays restricted to visitor check-in and check-out.</p>
          <button type="button" onClick={()=>setPairingCode("")} className="mt-3 min-h-11 rounded-xl border border-blue-300 px-3 text-sm font-bold text-blue-900">Hide code</button>
        </div>}
        {desk.canPair&&desk.devices.length>0&&<details className="mt-5 rounded-2xl border border-slate-200 p-4">
          <summary className="min-h-11 cursor-pointer font-bold">Manage paired devices ({desk.devices.filter(x=>!x.revoked_at).length} active)</summary>
          <div className="mt-4 space-y-2">{desk.devices.map(device=><div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <div><strong>{device.device_label}</strong><p className="text-xs text-slate-600">{desk.campuses.find(c=>c.id===device.campus_id)?.name} · Paired {timestamp(device.paired_at)} · {device.revoked_at?"Revoked":new Date(device.expires_at)<new Date()?"Expired":"Active"}</p></div>
            {!device.revoked_at&&new Date(device.expires_at)>new Date()&&<button disabled={!!busy} onClick={()=>{if(window.confirm("Revoke this visitor tablet? It will stop accepting visitor entries."))void act({mode:"revoke",deviceId:device.id},"revoke");}} className={button+" border border-rose-200 text-rose-800"}>Revoke device</button>}
          </div>)}</div>
        </details>}
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-black">Visitor register</h2><p className="mt-1 text-sm text-slate-600">Admission is only confirmed when authorised staff tap Admit.</p></div>
          <p className="text-xs text-slate-500">Recent 150 entries · newest first</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-bold">Search visitors
            <input type="search" className={field} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, reference, host"/>
          </label>
          <label className="text-sm font-bold">Status
            <select className={field} value={status} onChange={e=>setStatus(e.target.value)}>
              <option value="active">Waiting + on campus</option><option value="all">All recent visits</option>
              <option value="awaiting_admission">Waiting</option><option value="on_campus">On campus</option>
              <option value="departed">Departed</option><option value="declined">Not admitted</option>
            </select>
          </label>
          <label className="text-sm font-bold">Campus
            <select className={field} value={filterCampus} onChange={e=>setFilterCampus(e.target.value)}>
              <option value="">All authorised campuses</option>
              {desk.campuses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        {visits.length===0?<p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No visitor records match this view.</p>:
          <div className="mt-5 space-y-3">{visits.map((visit:GateVisit)=><article key={visit.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-black">{visit.visitor_name}</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${visit.status==="on_campus"?"bg-emerald-50 text-emerald-800":visit.status==="awaiting_admission"?"bg-amber-50 text-amber-900":"bg-slate-100 text-slate-700"}`}>{statusLabel(visit.status)}</span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-500">{visit.reference} · {desk.campuses.find(c=>c.id===visit.campus_id)?.name}</p>
            <p className="mt-2 text-sm text-slate-700">{purposeLabels[visit.purpose]??visit.purpose} · Visiting: {visit.host_name}</p>
            <p className="mt-1 text-xs text-slate-500">Arrived at kiosk: {timestamp(visit.submitted_at)}{visit.admitted_at?` · Admitted: ${timestamp(visit.admitted_at)}`:""}{visit.departed_at?` · Left: ${timestamp(visit.departed_at)}`:""}</p>
            {visit.phone&&<p className="mt-1 text-xs text-slate-600">Contact: {visit.phone}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {visit.status==="awaiting_admission"&&<>
                <button disabled={!!busy} onClick={()=>void act({mode:"admit",visitId:visit.id},visit.id)} className={button+" bg-emerald-700 text-white"}><CheckCircle2 className="size-4"/> Admit visitor</button>
                <button disabled={!!busy} onClick={()=>{if(window.confirm("Mark this visitor as not admitted?"))void act({mode:"decline",visitId:visit.id},visit.id);}} className={button+" border border-rose-200 text-rose-800"}><XCircle className="size-4"/> Do not admit</button>
              </>}
              {visit.status==="on_campus"&&<button disabled={!!busy} onClick={()=>void act({mode:"depart",visitId:visit.id},visit.id)} className={button+" bg-slate-950 text-white"}><DoorOpen className="size-4"/> Record departure</button>}
            </div>
          </article>)}</div>}
      </section>
      <p className="text-xs leading-5 text-slate-500"><ShieldCheck className="mr-1 inline size-4"/> Visitor details are restricted to authorised school staff. The visitor tablet cannot view this register. No student attendance records are duplicated.</p>
    </div>
  </main>;
}
