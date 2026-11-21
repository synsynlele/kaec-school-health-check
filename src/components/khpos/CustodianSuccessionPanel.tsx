"use client";
import { useCallback,useEffect,useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
type Scope="school"|"candidate"|"admin";
type Transfer={
 id:string;organisation_id:string;schoolName?:string;incoming_email:string;
 outgoing_user_id:string|null;incoming_user_id:string|null;keep_outgoing_as_guardian:boolean;
 guardian_campus_id:string|null;status:string;reason:string;is_recovery:boolean;
 initiated_by:string;created_at:string;accepted_at:string|null;review_note:string|null;
 completed_at:string|null;
};
type Campus={id:string;name:string;organisation_id?:string};
type School={id:string;name:string};
const base="/api/khpos/custodian-succession";
const control="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-950";
const button="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50";
const strong="min-h-11 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
const pending=(row:Transfer)=>["awaiting_acceptance","awaiting_approval"].includes(row.status);
function statusLabel(status:string){
  return ({
    awaiting_acceptance:"Waiting for successor",awaiting_approval:"Awaiting KAEC governance approval",
    completed:"Transfer completed",rejected:"Not approved / declined",cancelled:"Cancelled",
  } as Record<string,string>)[status]||status;
}
export function CustodianSuccessionPanel({scope,organisationId}:{scope:Scope;organisationId?:string}){
  const [allowed,setAllowed]=useState(false);
  const [signedOut,setSignedOut]=useState(false);
  const [rows,setRows]=useState<Transfer[]>([]);
  const [schools,setSchools]=useState<School[]>([]);
  const [campuses,setCampuses]=useState<Campus[]>([]);
  const [canApprove,setCanApprove]=useState(false);
  const [schoolId,setSchoolId]=useState(organisationId||"");
  const [email,setEmail]=useState("");
  const [reason,setReason]=useState("");
  const [guardian,setGuardian]=useState(true);
  const [campusId,setCampusId]=useState("");
  const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const token=useCallback(async()=>{
    const client=createBrowserSupabaseClient();
    const session=(await client?.auth.getSession())?.data.session;
    if(!session?.access_token)throw new Error("Sign in with your verified email account.");
    return session.access_token;
  },[]);
  const load=useCallback(async()=>{
    try{
      const access=await token();
      setSignedOut(false);
      const qs=new URLSearchParams({scope});
      if(organisationId)qs.set("schoolId",organisationId);
      const res=await fetch(base+"?"+qs.toString(),{
        headers:{Authorization:"Bearer "+access},cache:"no-store",
      });
      if(scope==="school"&&res.status===403){setAllowed(false);return;}
      const json=await res.json() as {
        ok?:boolean;error?:string;transfers?:Transfer[];
        schools?:School[];campuses?:Campus[];canApprove?:boolean;
      };
      if(!res.ok||!json.ok)throw new Error(json.error||"Could not load succession records.");
      setRows(json.transfers??[]);setSchools(json.schools??[]);
      setCampuses(json.campuses??[]);
      setCanApprove(Boolean(json.canApprove));setAllowed(true);setError("");
    }catch(cause){
      const message=cause instanceof Error?cause.message:"Could not load succession records.";
      if(message.includes("Sign in"))setSignedOut(true);
      else setError(message);
    }
  },[scope,organisationId,token]);
  useEffect(()=>{const t=window.setTimeout(()=>{void load();},0);return ()=>window.clearTimeout(t);},[load]);
  async function act(payload:Record<string,unknown>,confirmation?:string){
    if(busy)return;
    if(confirmation&&!window.confirm(confirmation))return;
    setBusy(true);setError("");setNotice("");
    try{
      const access=await token();
      const res=await fetch(base,{method:"POST",headers:{
        Authorization:"Bearer "+access,"Content-Type":"application/json",
      },body:JSON.stringify(payload)});
      const json=await res.json() as {ok?:boolean;error?:string};
      if(!res.ok||!json.ok)throw new Error(json.error||"Succession could not be processed.");
      setNotice(payload.mode==="propose"
        ?"Succession request recorded. Ask the incoming Custodian to sign in at the KHP-OS entrance and accept the invitation."
        :payload.mode==="accept"?"You accepted the invitation. Custodian access begins only after KAEC governance approval."
        :payload.mode==="approve"?"Custodian role transferred. Original School Health Check history remains intact."
        :"Succession status updated.");
      if(payload.mode==="propose"){setEmail("");setReason("");}
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"Unable to process succession.");}
    finally{setBusy(false);}
  }
  if(scope==="candidate"&&signedOut)return <section id="custodian-succession" className="rounded-2xl border border-white/20 bg-white/5 p-5 text-white">
    <h2 className="text-lg font-bold">Invited to become a School Custodian?</h2>
    <p className="mt-2 text-sm text-slate-200">Sign in with the email address the school nominated. Your succession invitation will appear here once you have a verified account.</p>
    <Link href="/account" className="mt-3 inline-block text-sm font-bold text-mint-300 underline">Sign in or create your account</Link>
  </section>;
  if(!allowed&&scope!=="candidate")return null;
  if(!allowed)return null;
  const myPending=rows.filter(pending);
  const selectedCampuses=campuses.filter(c=>scope==="school"||c.organisation_id===schoolId);
  const showPropose=scope==="school"||scope==="admin";
  const panel=<>
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {showPropose&&<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-base font-black text-slate-950">{scope==="admin"?"Initiate governed recovery / succession":"Request a change of School Custodian"}</h3>
      <p className="mt-1 text-sm text-slate-700">This does not remove anyone or grant permissions immediately. The proposed successor must accept using their own verified account, and independent KAEC administration must approve.</p>
      <form className="mt-4 space-y-3" onSubmit={event=>{event.preventDefault();void act({mode:"propose",schoolId,candidateEmail:email,reason,keepAsGuardian:guardian,guardianCampusId:guardian&&campusId?campusId:null});}}>
        {scope==="admin"&&<label className="block text-sm font-bold">School
          <select className={control+" mt-1"} required value={schoolId} onChange={event=>{setSchoolId(event.target.value);setCampusId("");}}>
            <option value="">Choose a school</option>
            {schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>}
        <label className="block text-sm font-bold">Incoming Custodian’s verified email
          <input className={control+" mt-1"} type="email" autoComplete="email" required maxLength={254} value={email}
            onChange={event=>setEmail(event.target.value)} placeholder="proprietress@example.com"/>
        </label>
        <label className="block text-sm font-bold">Reason and succession authority
          <textarea className={control+" mt-1"} required minLength={20} maxLength={3000} rows={3} value={reason}
            onChange={event=>setReason(event.target.value)}
            placeholder="Explain succession, ownership authorisation and planned transfer of responsibilities."/>
        </label>
        <label className="flex items-start gap-3 text-sm font-semibold">
          <input className="mt-1 size-5" type="checkbox" checked={guardian} onChange={event=>setGuardian(event.target.checked)}/>
          Make the outgoing Custodian a School Guardian (if there is an outgoing Custodian)
        </label>
        {guardian&&selectedCampuses.length>1&&<label className="block text-sm font-bold">School Guardian campus
          <select required className={control+" mt-1"} value={campusId} onChange={event=>setCampusId(event.target.value)}>
            <option value="">Select campus</option>{selectedCampuses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>}
        <button disabled={busy||!schoolId} className={strong} type="submit">{busy?"Working…":"Submit succession request"}</button>
      </form>
    </div>}
    <div className="space-y-3">
      <h3 className="text-base font-black text-slate-950">{scope==="candidate"?"Your Custodian invitations":scope==="admin"?"Governance review queue":"Succession requests and history"}</h3>
      {!rows.length&&<p className="text-sm text-slate-600">No Custodian succession requests to display.</p>}
      {rows.map(row=><article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-950">
        <div className="flex flex-wrap justify-between gap-2">
          <strong className="text-sm">{row.schoolName||row.incoming_email}</strong>
          <span className="text-xs font-bold text-slate-700">{statusLabel(row.status)}</span>
        </div>
        {scope!=="candidate"&&<p className="mt-2 break-words text-sm text-slate-700">Incoming account: {row.incoming_email}</p>}
        {scope==="candidate"&&<p className="mt-2 text-sm text-slate-700">The school has nominated your verified email to hold its School Custodian authority. Read the responsibilities and accept only if you agree.</p>}
        <p className="mt-1 text-xs leading-5 text-slate-600">Reason: {row.reason}</p>
        <p className="mt-1 text-xs text-slate-600">Outgoing Custodian: {row.keep_outgoing_as_guardian?"to become School Guardian":"Custodian authority will end"} · {row.is_recovery?"KAEC recovery request":"Standard succession"}</p>
        {row.review_note&&<p className="mt-2 text-xs text-slate-600">Review: {row.review_note}</p>}
        {scope==="candidate"&&row.status==="awaiting_acceptance"&&<div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busy} className={strong} type="button" onClick={()=>void act({mode:"accept",transferId:row.id},"Accept the School Custodian nomination? You will receive authority only after KAEC's independent approval.")}>Accept Custodian appointment</button>
          <button disabled={busy} className={button} type="button" onClick={()=>void act({mode:"decline",transferId:row.id},"Decline this Custodian invitation?")}>Decline</button>
        </div>}
        {scope==="admin"&&row.status==="awaiting_approval"&&<div className="mt-3 space-y-2">
          <label className="block text-sm font-bold">Independent governance verification
            <textarea className={control+" mt-1"} rows={2} minLength={20} maxLength={3000} value={reviewNotes[row.id]||""}
              onChange={event=>setReviewNotes(v=>({...v,[row.id]:event.target.value}))}
              placeholder="Record how ownership authority and the handover were independently verified. Do not paste identity documents."/>
          </label>
          {!canApprove&&<p className="text-sm font-semibold text-amber-900">Administrator MFA is required before approval or rejection. Complete MFA from the Admin Console.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy||!canApprove||(reviewNotes[row.id]||"").trim().length<20} className={strong}
              onClick={()=>void act({mode:"approve",transferId:row.id,reason:reviewNotes[row.id]},"Approve this verified transfer? The outgoing Custodian will lose Custodian authority immediately. This action is not reversible in place.")}>Approve transfer</button>
            <button type="button" disabled={busy||!canApprove||(reviewNotes[row.id]||"").trim().length<20} className={button}
              onClick={()=>void act({mode:"reject",transferId:row.id,reason:reviewNotes[row.id]})}>Reject request</button>
          </div>
        </div>}
        {(scope==="school"||scope==="admin")&&pending(row)&&<div className="mt-3">
          <button type="button" disabled={busy} className={button} onClick={()=>{
            const note=window.prompt("Explain why the pending succession should be cancelled (at least 20 characters).");
            if(note&&note.trim().length>=20)void act({mode:"cancel",transferId:row.id,reason:note.trim()});
          }}>Cancel pending request</button>
        </div>}
      </article>)}
    </div>
  </>;
  if(scope==="candidate")return <section id="custodian-succession" className="rounded-2xl border border-white/20 bg-white p-5 text-slate-950">
    <h2 className="text-lg font-black">School Custodian invitations</h2>
    <p className="mt-1 text-sm text-slate-700">For school proprietors, proprietresses and appointed successors. No change occurs until you accept and independent review is completed.</p>
    <div className="mt-4 space-y-3">{panel}</div>
  </section>;
  return <details id="custodian-succession" className="khpos-interface-card overflow-hidden border border-slate-200 bg-white">
    <summary className="cursor-pointer p-5 text-base font-black text-slate-950">{scope==="admin"?"School Custodian transfers and recoveries":"Change School Custodian / succession"}
      <span className="mt-2 block text-sm font-normal text-slate-700">A governed handover, not a staff-role delete button. Preserves school records and School Health Check history.</span>
      {myPending.length>0&&<span className="mt-2 block text-xs font-bold text-amber-900">{myPending.length} pending request(s)</span>}
    </summary>
    <div className="space-y-5 border-t border-slate-200 p-4 sm:p-6">{panel}</div>
  </details>;
}
