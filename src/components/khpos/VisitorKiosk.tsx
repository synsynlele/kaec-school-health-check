"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardCheck, DoorOpen, KeyRound, ShieldCheck, UserRoundPlus } from "lucide-react";

type State={active:boolean;school?:string;campus?:string};
type Receipt={reference:string;departureCode:string};
const purposeOptions=[
  ["parent_guardian","Parent or guardian"],["appointment","Meeting or appointment"],
  ["delivery","Delivery"],["contractor","Service or maintenance"],
  ["official","Official visit"],["other","Another reason"],
] as const;
const field="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-300";

export function VisitorKiosk(){
  const [state,setState]=useState<State|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [mode,setMode]=useState<"in"|"out">("in");
  const [pin,setPin]=useState("");
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [purpose,setPurpose]=useState("parent_guardian");
  const [host,setHost]=useState("");
  const [exitCode,setExitCode]=useState("");
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const [departed,setDeparted]=useState(false);
  useEffect(()=>{
    let alive=true;
    void fetch("/api/khpos/visitor-kiosk",{cache:"no-store",credentials:"same-origin"})
      .then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||"The kiosk is unavailable.");if(alive)setState(body);})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Could not open the kiosk.");});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!receipt&&!departed)return;
    const t=window.setTimeout(()=>reset(),30_000);
    return()=>window.clearTimeout(t);
  },[receipt,departed]);
  function reset(){
    setName("");setPhone("");setHost("");setPurpose("parent_guardian");setExitCode("");
    setReceipt(null);setDeparted(false);setError("");setMode("in");
  }
  async function submit(action:"activate"|"check_in"|"check_out",details:Record<string,string>){
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/khpos/visitor-kiosk",{
        method:"POST",headers:{"Content-Type":"application/json"},
        credentials:"same-origin",cache:"no-store",body:JSON.stringify({action,...details}),
      });
      const body=await r.json() as {ok?:boolean;active?:boolean;receipt?:Receipt;departed?:boolean;error?:string};
      if(!r.ok || !body.ok)throw new Error(body.error||"Could not save your visit.");
      if(action==="activate"){
        setPin("");
        const next=await fetch("/api/khpos/visitor-kiosk",{cache:"no-store",credentials:"same-origin"});
        const details=await next.json();
        if(!next.ok||!details.active)throw new Error("Device activation could not be confirmed.");
        setState(details);
      }
      if(action==="check_in"&&body.receipt){
        setReceipt(body.receipt);setName("");setPhone("");setHost("");
      }
      if(action==="check_out"){setDeparted(true);setExitCode("");}
    }catch(e){setError(e instanceof Error?e.message:"Please try again.");}
    finally{setBusy(false);}
  }
  function checkin(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    void submit("check_in",{name,phone,purpose,host});
  }
  return <main className="min-h-svh bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 px-4 py-7 text-white sm:py-12">
    <div className="mx-auto max-w-xl space-y-6">
      <header className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-[20px] bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-300/10">
          <ShieldCheck className="size-9" aria-hidden="true"/>
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">KHP-OS · Visitor welcome</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          {state?.active?"Welcome to our school":"Activate school visitor tablet"}
        </h1>
        {state?.active&&<p className="mt-3 text-sm text-slate-200">
          {state.school} · {state.campus}
        </p>}
      </header>
      <section className="overflow-hidden rounded-[28px] bg-white p-5 text-slate-950 shadow-2xl sm:p-8">
        {!state&&!error&&<p role="status" className="py-8 text-center text-sm text-slate-600">Checking this school device…</p>}
        {state&&!state.active&&<>
          <div className="flex items-center gap-3 text-blue-800"><KeyRound className="size-6"/><h2 className="text-xl font-black">Set up this device once</h2></div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Ask your School Guardian or Custodian to generate a ten-character activation code from Gate & Visitors on their own phone. Visitors will never need a staff login.</p>
          <form className="mt-5 space-y-4" onSubmit={e=>{e.preventDefault();void submit("activate",{code:pin});}}>
            <label className="block text-sm font-bold">Activation code
              <input className={field+" font-mono tracking-[0.12em] uppercase"} autoComplete="off"
                autoCapitalize="characters" spellCheck={false} value={pin} onChange={e=>setPin(e.target.value.toUpperCase())}
                maxLength={12} required placeholder="XXXXXXXXXX"/>
            </label>
            <button disabled={busy||pin.trim().length<10} className="min-h-12 w-full rounded-xl bg-blue-700 px-5 font-black text-white disabled:opacity-50">
              {busy?"Activating…":"Activate visitor tablet"}
            </button>
          </form>
        </>}
        {state?.active&&(receipt||departed)?<div className="space-y-5 py-3 text-center">
          <CheckCircle2 className="mx-auto size-14 text-emerald-600" aria-hidden="true"/>
          <h2 className="text-2xl font-black">{departed?"Thank you for visiting!":"Check-in submitted"}</h2>
          {receipt&&<>
            <p className="text-sm leading-6 text-slate-600">Please show reception your visit reference. A school staff member will confirm admission.</p>
            <div className="rounded-2xl bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Visit reference</p>
              <p className="mt-2 font-mono text-2xl font-black tracking-wide text-slate-950">{receipt.reference}</p>
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-blue-700">Private departure code</p>
              <p className="mt-2 break-all font-mono text-2xl font-black tracking-wider text-slate-950">{receipt.departureCode}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">Keep this code until you leave. You can use it to check out on this tablet, or ask reception for help.</p>
            </div>
          </>}
          {departed&&<p className="text-sm text-slate-600">Your departure was recorded. Have a pleasant day.</p>}
          <button type="button" onClick={reset} className="min-h-12 w-full rounded-xl bg-slate-950 px-5 font-black text-white">Done · Next visitor</button>
          <p className="text-xs text-slate-500">For privacy, this screen clears automatically.</p>
        </div>:state?.active&&<>
          <div role="tablist" aria-label="Visit action" className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            <button type="button" role="tab" aria-selected={mode==="in"} onClick={()=>{setMode("in");setError("");}}
              className={`min-h-12 rounded-xl px-2 text-sm font-bold ${mode==="in"?"bg-white text-blue-800 shadow-sm":"text-slate-600"}`}>
              <UserRoundPlus className="mr-1 inline size-4"/> Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode==="out"} onClick={()=>{setMode("out");setError("");}}
              className={`min-h-12 rounded-xl px-2 text-sm font-bold ${mode==="out"?"bg-white text-blue-800 shadow-sm":"text-slate-600"}`}>
              <DoorOpen className="mr-1 inline size-4"/> Sign out
            </button>
          </div>
          {mode==="in"?<form autoComplete="off" onSubmit={checkin} className="mt-6 space-y-4">
            <h2 className="text-xl font-black">Please tell us about your visit</h2>
            <label className="block text-sm font-bold">Your full name
              <input className={field} value={name} onChange={e=>setName(e.target.value)} maxLength={100}
                autoComplete="off" required placeholder="First name and surname"/>
            </label>
            <label className="block text-sm font-bold">Reason for your visit
              <select className={field} value={purpose} onChange={e=>setPurpose(e.target.value)}>
                {purposeOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold">Who are you here to see?
              <input className={field} value={host} onChange={e=>setHost(e.target.value)} maxLength={90}
                autoComplete="off" required placeholder="Person or department"/>
            </label>
            <label className="block text-sm font-bold">Phone number <span className="font-normal text-slate-500">(optional)</span>
              <input type="tel" inputMode="tel" className={field} value={phone}
                onChange={e=>setPhone(e.target.value)} maxLength={20} autoComplete="off" placeholder="080..."/>
            </label>
            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              We record the minimum necessary details for school safety and visitor accountability. Only authorised school staff can view the register.
            </p>
            <button disabled={busy||name.trim().length<3||host.trim().length<2} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-base font-black text-white disabled:opacity-50">
              <ClipboardCheck className="size-5"/>{busy?"Submitting…":"Complete my check-in"}
            </button>
          </form>:<form autoComplete="off" onSubmit={e=>{e.preventDefault();void submit("check_out",{code:exitCode});}} className="mt-6 space-y-4">
            <h2 className="text-xl font-black">Leaving the school?</h2>
            <p className="text-sm leading-6 text-slate-600">Enter the private departure code you received at check-in. If you have lost it, reception can complete your sign-out.</p>
            <label className="block text-sm font-bold">Departure code
              <input className={field+" font-mono uppercase tracking-[0.1em]"} value={exitCode}
                onChange={e=>setExitCode(e.target.value.toUpperCase())} autoComplete="off"
                spellCheck={false} maxLength={14} required/>
            </label>
            <button disabled={busy||exitCode.trim().length<12} className="min-h-14 w-full rounded-xl bg-blue-700 px-4 font-black text-white disabled:opacity-50">
              {busy?"Checking out…":"Record my departure"}
            </button>
          </form>}
        </>}
        {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
      </section>
      <footer className="text-center text-xs text-slate-300">Powered by KAEC-NG · KHP-OS Gate & Visitors</footer>
    </div>
  </main>;
}
