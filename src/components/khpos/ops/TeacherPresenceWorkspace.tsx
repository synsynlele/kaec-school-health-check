"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { announceKhposActivityChanged } from "@/lib/khpos/ops/action-events";
import { ArrowLeft, BookOpenCheck, CalendarClock, CheckCircle2, ClipboardCheck, Loader2, School, UsersRound } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposOpsAcademicDeliveryWorkspace } from "@/lib/khpos/ops/academic-delivery";
import type { KhposHqlsDomain } from "@/lib/khpos/ops/presence";
import type { KhposPresenceWorkspace } from "@/lib/khpos/ops/presence";

type Panel = "day" | "lessons" | "hqls" | "leaders";
type Domain = { code:string; name:string; test:string; automatic?:string };
const HQLS: Domain[] = [
 {code:"awakening",name:"1. AWAKENING",test:"Students are pulled into a problem, scenario or tension before definitions and explanation.",automatic:'Teacher starts with “Today we are learning…”'},
 {code:"exploration",name:"2. EXPLORATION",test:"Multiple students reveal crude, incomplete or wrong thinking without premature correction.",automatic:'Teacher says “That’s wrong” during this phase.'},
 {code:"micro_illumination",name:"3. MICRO-ILLUMINATION",test:"Teacher offers only minimal orientation; the learner remains responsible for the work.",automatic:"Full teaching before first student attempt."},
 {code:"first_trial",name:"4. TRIAL",test:"Learners struggle productively, independently or collaboratively, without being rescued.",automatic:"Teacher corrects work during first attempt."},
 {code:"full_illumination",name:"5. FULL ILLUMINATION",test:"Teaching follows student effort and addresses observed misconceptions.",automatic:"Teaching occurred before struggle."},
 {code:"second_trial",name:"6. SECOND TRIAL",test:"Learners attempt again, apply understanding and explain improvement."},
 {code:"integration",name:"7. INTEGRATION",test:"Learners reflect on their changed thinking and connections to life or identity.",automatic:"Lesson ends immediately after task completion."},
 {code:"teacher_role_fidelity",name:"8. TEACHER ROLE FIDELITY",test:"Teacher guides with questions rather than dominating learners' thinking."}
];
const WEEKDAYS = ["","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const emptyRating = {score:"",evidence:"",automaticFailure:false};
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none";
const box = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
function timeString(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date(iso));
}
function dateTime(iso:string|null|undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",dateStyle:"medium",timeStyle:"short"}).format(new Date(iso));
}
function possibleToday(date:string,weekday:number) {
  return date ? new Date(date+"T12:00:00Z").getUTCDay()===weekday%7:false;
}
function ratingText(score:number) { return score===3?"Strong":score===2?"Partial":"Weak"; }

export function TeacherPresenceWorkspace({organisationId}:{organisationId:string}) {
  const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
  const [data,setData]=useState<KhposPresenceWorkspace|null>(null);
  const [academic,setAcademic]=useState<KhposOpsAcademicDeliveryWorkspace|null>(null);
  const [tab,setTab]=useState<Panel>("day");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [campusId,setCampusId]=useState("");
  const [weekday,setWeekday]=useState("1");
  const [start,setStart]=useState("08:00");
  const [end,setEnd]=useState("09:30");
  const [room,setRoom]=useState("");
  const [scheduleStream,setScheduleStream]=useState("");
  const [hqlsStream,setHqlsStream]=useState("");
  const [hqlsSession,setHqlsSession]=useState("");
  const [hqlsMode,setHqlsMode]=useState<"full"|"walk">("full");
  const [ratings,setRatings]=useState<Record<string,{score:string;evidence:string;automaticFailure:boolean}>>({});
  const [strengths,setStrengths]=useState("");
  const [improvement,setImprovement]=useState("");
  const [coachingAction,setCoachingAction]=useState("");
  const [coachingDue,setCoachingDue]=useState("");
  const [lessonTopics,setLessonTopics]=useState<Record<string,string>>({});
  const [lessonOutcome,setLessonOutcome]=useState<Record<string,string>>({});
  const [lessonNotes,setLessonNotes]=useState<Record<string,string>>({});
  const [responses,setResponses]=useState<Record<string,string>>({});
  const [reconcileReason,setReconcileReason]=useState("");
  const [presenceQuery,setPresenceQuery]=useState("");
  const [presenceSort,setPresenceSort]=useState<"newest"|"oldest"|"name">("newest");
  const [lessonQuery,setLessonQuery]=useState("");
  const requestKey=useRef<string|null>(null);

  const authToken=useCallback(async()=>{
    if(!supabase) throw new Error("KHP-OS sign-in is not configured.");
    const {data:session}=await supabase.auth.getSession();
    if(!session.session?.access_token) throw new Error("Your session has ended. Sign in to continue.");
    return session.session.access_token;
  },[supabase]);

  const load=useCallback(async()=>{
    try {
      const token=await authToken();
      const headers={Authorization:"Bearer "+token};
      const response=await fetch("/api/khpos/ops/presence/"+organisationId,{headers,cache:"no-store"});
      const body=await response.json() as {ok?:boolean;workspace?:KhposPresenceWorkspace;error?:string};
      if(!response.ok||!body.ok||!body.workspace) throw new Error(body.error??"Attendance could not be loaded.");
      setData(body.workspace);
      setCampusId(v=>v||body.workspace?.staff?.campusId||body.workspace?.campuses[0]?.id||"");
      try {
        const res=await fetch("/api/khpos/ops/academic-delivery/"+organisationId,{headers,cache:"no-store"});
        if(res.ok) {
          const academicBody=await res.json() as {academic?:KhposOpsAcademicDeliveryWorkspace};
          setAcademic(academicBody.academic??null);
        }
      } catch { /* Attendance remains available if Academic Delivery cannot be loaded. */ }
      setError("");
    } catch(e){setError(e instanceof Error?e.message:"Unable to load attendance.");}
  },[authToken,organisationId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const selected = new URLSearchParams(window.location.search).get("tab");
      if (selected === "day" || selected === "lessons" || selected === "hqls" || selected === "leaders") setTab(selected);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!data || tab !== "lessons") return;
    const selected = new URLSearchParams(window.location.search).get("period");
    if (!selected || !/^[0-9a-f-]{36}$/i.test(selected)) return;
    const timer = window.setTimeout(() => document.getElementById("class-" + selected)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    return () => window.clearTimeout(timer);
  }, [data, tab]);
  useEffect(()=>{
    let active=true;
    void Promise.resolve().then(()=>{if(active)void load();});
    return ()=>{active=false;};
  },[load]);

  async function act(mode:string,payload:Record<string,unknown>={},label="Action saved") {
    setBusy(mode);setError("");setNotice("");
    try{
      const token=await authToken();
      const response=await fetch("/api/khpos/ops/presence/"+organisationId,{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
        body:JSON.stringify({mode,...payload})
      });
      const body=await response.json() as {ok?:boolean;error?:string;workspace?:KhposPresenceWorkspace};
      if(!response.ok||!body.ok)throw new Error(body.error??"The request could not be completed.");
      if(body.workspace)setData(body.workspace);
      setNotice(label);
      announceKhposActivityChanged(organisationId);
      return true;
    }catch(e){setError(e instanceof Error?e.message:"Unable to complete action.");}
    finally{setBusy("");}
    return false;
  }

  async function saveRubric(){
    const domains:KhposHqlsDomain[]=HQLS.filter(d=>ratings[d.code]?.score).map(d=>({
      code:d.code,score:Number(ratings[d.code].score),evidence:ratings[d.code].evidence.trim(),
      automaticFailure:!!ratings[d.code].automaticFailure
    }));
    if(!hqlsStream){setError("Choose the class being observed.");return;}
    if(hqlsMode==="full"&&domains.length!==8){setError("A full observation requires all eight domain scores.");return;}
    if(domains.length===0){setError("Score at least one observed domain.");return;}
    if(domains.some(d=>d.evidence.length<12)){setError("Write specific observed evidence for every scored domain (at least 12 characters).");return;}
    if(strengths.trim().length<8){setError("Record the instructional strengths observed.");return;}
    if(!requestKey.current) requestKey.current=crypto.randomUUID();
    const saved=await act("hqls_create",{
      streamId:hqlsStream,classSessionId:hqlsSession||null,observationMode:hqlsMode,requestKey:requestKey.current,domains,strengths:strengths.trim(),
      improvement:improvement.trim(),coachingAction:coachingAction.trim(),coachingDue
    },"HQLS observation saved. Coaching work is assigned in Today when required.");
    if(saved){
      requestKey.current=null;
      setRatings({});setStrengths("");setImprovement("");setCoachingAction("");setCoachingDue("");
    }
    // Failed submissions retain the draft and idempotency key.
  }

  const canManage=Boolean(data?.canManage);
  const canObserve=Boolean(academic?.canMonitor||academic?.canPlan);
  const roleStreams=(academic?.streams??[]).filter(s=>["approved","active"].includes(s.status));
  const todays=(data?.periods??[]).filter(p=>possibleToday(data?.localDay??"",p.weekday));
  const observed=(data?.observations??[]);
  const own=(data?.periods??[]).filter(p=>[p.class,p.subject,p.teacher,p.room??"",WEEKDAYS[p.weekday]].join(" ").toLowerCase().includes(lessonQuery.trim().toLowerCase()));
  const presenceMatches=(value:string)=>presenceQuery.toLowerCase().trim().split(/\s+/).filter(Boolean).every(term=>value.toLowerCase().includes(term));
  const schoolRows=(data?.teamPresence??[]).filter(d=>presenceMatches([d.name,data?.campuses.find(c=>c.id===d.campusId)?.name??"",d.in,d.out??"",data?.localDay??""].join(" "))).sort((a,b)=>presenceSort==="name"?a.name.localeCompare(b.name):(Date.parse(a.in)-Date.parse(b.in))*(presenceSort==="oldest"?1:-1));
  const classRows=todays.filter(p=>p.session && presenceMatches([p.teacher,p.class,p.subject,p.session.topic??"",p.session.outcome??"",data?.localDay??""].join(" "))).sort((a,b)=>presenceSort==="name"?a.teacher.localeCompare(b.teacher):(Date.parse(a.session!.in)-Date.parse(b.session!.in))*(presenceSort==="oldest"?1:-1));
  return <div className="min-h-screen bg-slate-50 px-4 py-7 sm:px-7">
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href={"/khpos/"+organisationId} className="inline-flex items-center gap-2 text-sm font-bold text-brand-700">
        <ArrowLeft className="size-4"/> School Overview
      </Link>
      <div className="rounded-3xl bg-slate-900 px-5 py-6 text-white sm:px-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300"><BookOpenCheck className="size-4"/> SCHOOL ATTENDANCE & TEACHING DELIVERY</div>
        <h1 className="text-2xl font-black sm:text-4xl">My school day</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">Record when you arrive at school, when each class starts and finishes, and when you leave school. Keep class teaching records separate from your school attendance. teaching through evidence-led observations.</p>
        <p className="mt-2 text-xs text-slate-300">Recorded using Nigerian local school time (Africa/Lagos). Staff attendance and subject lesson delivery are separate records.</p>
      </div>
      {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-900">{error}</div>}
      {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{notice}</div>}
      {!data&&<div className={box}><Loader2 className="mr-2 inline size-5 animate-spin"/> Loading school attendance…</div>}
      {data&&<>
        {!data.pilotEnabled&&<section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-xl font-black text-amber-950">School attendance and teaching — ready to activate</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">The new tools are available to every KHP-OS school. School attendance, lesson check-ins and HQLS observations stay inactive at this school until its School Custodian enables them. Existing school records are not changed.</p>
          {data.canEnablePilot?<button type="button" disabled={Boolean(busy)}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50"
            onClick={()=>{if(window.confirm("Enable school attendance, scheduled lesson check-ins and HQLS observation tools for this school? Existing records will remain unchanged."))void act("pilot_enable",{enabled:true},"School attendance and teaching pilot activated.");}}>
            Enable for this school</button>
            :<p className="mt-3 text-sm font-semibold text-amber-900">Ask your School Custodian to activate these tools for your school.</p>}
        </section>}
        {data.pilotEnabled&&data.canEnablePilot&&<div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="text-sm font-semibold text-emerald-900">School attendance and teaching are enabled.</span>
          <button type="button" disabled={Boolean(busy)}
            className="text-xs font-bold text-emerald-900 underline disabled:opacity-50"
            onClick={()=>{if(window.confirm("Pause new school attendance, class check-ins and HQLS observations for your school? Existing records stay saved."))void act("pilot_enable",{enabled:false},"New attendance and teaching activity paused.");}}>Pause pilot</button>
        </div>}
        {data.pilotEnabled&&<>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Teaching attendance sections">
          {([["day","School attendance",School],["lessons","Class lessons",CalendarClock],["hqls","HQLS observation",ClipboardCheck],["leaders","Leadership overview",UsersRound]] as const)
          .filter(([id])=>id!=="leaders" || data.teamPresence.length>0 || canManage || data.canEnableHqls)
          .map(([id,title,Icon])=><button key={id} type="button" role="tab" aria-selected={tab===id}
            onClick={()=>{setTab(id);setError("");setNotice("");}}
            className={"inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold "+(tab===id?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-700")}>
            <Icon className="size-4"/>{title}</button>)}
        </div>
        {tab==="day"&&<div className="grid gap-4 lg:grid-cols-2">
          <section className={box}>
            <h2 className="mb-2 text-xl font-black text-slate-900">Your school arrival and departure</h2>
            <p className="mb-4 text-sm text-slate-600">First record your arrival at school. When you leave, record your departure. Both actions save the date and exact time. Your classes must be recorded separately.</p>
            {!data.staff?<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">An active staff identity is needed. Ask your School Guardian to complete People & Staff onboarding.</p>
            :<div className="space-y-3">
              <p className="text-sm"><b>Staff member:</b> {data.staff.name}</p>
              <p className="text-sm"><b>School day:</b> {data.localDay}</p>
              {data.todayPresence?<>
                <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><b>School check-in recorded:</b> {dateTime(data.todayPresence.in)}<br/><b>School check-out recorded:</b> {dateTime(data.todayPresence.out)}{data.todayPresence.administrativelyClosed?" (administratively closed)":""}</p>
                {!data.todayPresence.out&&<button disabled={Boolean(busy)} onClick={()=>void act("school_out",{},"School check-out recorded.")} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50">Record School Check-out</button>}
              </>:<>
                <label className="block text-sm font-bold text-slate-800" htmlFor="schoolCampus">Campus</label>
                <select id="schoolCampus" className={field} value={campusId} onChange={e=>setCampusId(e.target.value)}>
                  {data.campuses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button disabled={!campusId||Boolean(busy)} onClick={()=>void act("school_in",{campusId},"School check-in recorded.")}
                  className="w-full rounded-xl bg-brand-700 px-4 py-3 font-bold text-white disabled:opacity-50">Record School Check-in</button>
              </>}
            </div>}
          </section>
          <section className={box}>
            <h2 className="mb-2 text-xl font-black text-slate-900">Today&apos;s classes</h2>
            <p className="mb-3 text-sm text-slate-600">Scheduled periods visible to your teaching role or authorised leadership position.</p>
            {todays.length===0?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No scheduled class records for today. Leaders can set up periods under Class lessons after activating an Academic Delivery stream.</p>
              :<div className="space-y-2">{todays.map(p=><div key={p.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <b>{p.subject} · {p.class}</b><p>{p.start}–{p.end} · {p.room||"Room not set"}</p>
                <p className="text-xs text-slate-500">{p.teacher} · {p.session?.out?"Reported":p.session?"In progress":"Not checked in"}</p>
              </div>)}</div>}
            <button className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800" onClick={()=>setTab("lessons")}>Open class lessons</button>
          </section>
        </div>}

        {tab==="lessons"&&<div className="space-y-4">
          <section className={box}>
            <h2 className="text-xl font-black text-slate-900">Scheduled subject lessons</h2>
            <p className="my-2 text-sm text-slate-600">A class check-in is available from 30 minutes before the lesson starts until 30 minutes after it finishes. The assigned teacher must record the actual start time. After teaching, record the class check-out and what happened. Finish an open class before checking out of school.</p>
            {own.length===0?<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No period has been entered for the current term. An Academic Inspector or School Guardian should add the schedule below. <Link href={"/khpos/"+organisationId+"/academic-delivery"} className="font-bold underline">Open Academic Delivery</Link>.</p>:null}
            <label className="mt-4 block text-sm font-semibold text-slate-700">Find a scheduled class
              <input type="search" className={field} placeholder="Search class, teacher, subject or room" value={lessonQuery} onChange={e=>setLessonQuery(e.target.value)}/>
            </label>
            <div className="mt-3 space-y-3">
              {own.map(p=>{
                const today=possibleToday(data.localDay,p.weekday);
                const mine=Boolean(academic?.streams.find(s=>s.id===p.streamId && s.isTeacher));
                return <div key={p.id} id={"class-" + p.id} className="scroll-mt-6 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h3 className="font-black text-slate-900">{p.subject} · {p.class}</h3>
                      <p className="text-sm text-slate-600">{WEEKDAYS[p.weekday]} {p.start}–{p.end} · {p.room||"Room not set"}</p>
                      <p className="text-xs text-slate-500">{p.teacher}</p></div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{p.session?.out?"Recorded":p.session?"In progress":today?"Today":"Upcoming"}</span>
                  </div>
                  {today&&mine&&p.termActive&&!p.session&&<button disabled={Boolean(busy)||!data.todayPresence||Boolean(data.todayPresence.out)}
                    className="mt-3 rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    onClick={()=>void act("class_in",{periodId:p.id},"Class check-in recorded.")}>Record Class Check-in — Start class</button>}
                  {today&&mine&&p.session&&!p.session.out&&<div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div><label className="text-xs font-bold">What happened in this class?</label>
                      <select className={field} value={lessonOutcome[p.id]||"completed"} onChange={e=>setLessonOutcome(old=>({...old,[p.id]:e.target.value}))}>
                        <option value="completed">Completed as planned</option><option value="partial">Partially completed</option><option value="not_held">Could not hold</option>
                      </select></div>
                    <div><label className="text-xs font-bold">What topic did you teach?</label>
                      <input className={field} value={lessonTopics[p.id]||""} maxLength={200} onChange={e=>setLessonTopics(old=>({...old,[p.id]:e.target.value}))} placeholder="Topic or learning focus"/></div>
                    <div className="sm:col-span-2"><label className="text-xs font-bold">Anything still to finish? (optional)</label>
                      <textarea className={field} rows={2} maxLength={1000} value={lessonNotes[p.id]||""} onChange={e=>setLessonNotes(old=>({...old,[p.id]:e.target.value}))} placeholder="What needs attention?"/></div>
                    <button disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      onClick={()=>void act("class_out",{periodId:p.id,outcome:lessonOutcome[p.id]||"completed",topic:lessonTopics[p.id]||"",followUp:lessonNotes[p.id]||""},"Lesson checkout saved.")}>Record Class Check-out — Finish class</button>
                  </div>}
                  {p.session&&<p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mr-1 inline size-4"/> Class check-in: {dateTime(p.session.in)}<br/>Class check-out: {dateTime(p.session.out)} {p.session.administrativelyClosed?"(administratively closed)":""}<br/>Outcome: {p.session.outcome||"In progress"} · {p.session.topic||"No topic recorded"}</p>}
                  {!mine&&canManage&&<button className="mt-3 text-xs font-bold text-rose-700 underline" disabled={Boolean(busy)}
                    onClick={()=>{if(window.confirm("Disable this scheduled period? Historical class records will be retained."))void act("period_disable",{periodId:p.id},"Period disabled.");}}>Disable future periods</button>}
                </div>;
              })}
            </div>
          </section>
          {canManage&&<section className={box}>
            <h2 className="text-xl font-black text-slate-900">Add a weekly subject period</h2>
            <p className="my-2 text-sm text-slate-600">Use an existing approved/active Academic Delivery stream. The stream already contains class, subject and assigned teacher. The application checks for overlapping teaching periods.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="text-xs font-bold">Approved subject stream</label><select className={field} value={scheduleStream} onChange={e=>setScheduleStream(e.target.value)}>
                <option value="">Select stream</option>{roleStreams.map(s=><option key={s.id} value={s.id}>{s.classLabel} · {s.subjectLabel} · {s.teacherDisplay}</option>)}
              </select></div>
              <div><label className="text-xs font-bold">Weekday</label><select className={field} value={weekday} onChange={e=>setWeekday(e.target.value)}>{WEEKDAYS.slice(1).map((d,i)=><option value={i+1} key={d}>{d}</option>)}</select></div>
              <div><label className="text-xs font-bold">Room (optional)</label><input className={field} maxLength={100} value={room} onChange={e=>setRoom(e.target.value)}/></div>
              <div><label className="text-xs font-bold">Start</label><input type="time" className={field} value={start} onChange={e=>setStart(e.target.value)}/></div>
              <div><label className="text-xs font-bold">End</label><input type="time" className={field} value={end} onChange={e=>setEnd(e.target.value)}/></div>
            </div>
            <button disabled={!scheduleStream||Boolean(busy)} className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              onClick={()=>void act("period_add",{streamId:scheduleStream,weekday:Number(weekday),start,end,room},"Weekly class period added.")}>Add subject period</button>
            {roleStreams.length===0&&<Link className="mt-3 block text-sm font-bold text-brand-700 underline" href={"/khpos/"+organisationId+"/academic-delivery"}>Create and activate a subject stream in Academic Delivery</Link>}
          </section>}
        </div>}

        {tab==="hqls"&&<div className="space-y-4">
          <section className={box}>
            <h2 className="text-xl font-black text-slate-900">KAEC HQLS classroom observation</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Original KAEC HQLS fidelity standard. Evidence must describe what learners and the teacher actually did, not opinions or planned activities. This measures HQLS fidelity, not teacher charisma. Observers must be independently authorised.</p>
            <p className="mt-2 rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-900">Strong = 3 · Partial = 2 · Weak = 1. Full observation: 22–24 Model; 17–21 Coaching; below 17 Retraining. Any automatic failure requires coaching regardless of total score.</p>
            {data.canEnableHqls&&<div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
              <p className="text-sm font-bold text-brand-900">School HQLS adoption: {data.hqlsEnabled?"Enabled":"Not yet enabled"}</p>
              <p className="mt-1 text-xs text-brand-800">Enable the official KAEC HQLS rubric only when this school has adopted HQLS. Generic classroom observations remain separate.</p>
              <button disabled={Boolean(busy)} className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                onClick={()=>{if(window.confirm(data.hqlsEnabled?"Disable new HQLS observations for this school? Existing records remain.":"Confirm this school formally implements HQLS?"))void act("hqls_enable",{enabled:!data.hqlsEnabled},data.hqlsEnabled?"New HQLS observations disabled.":"HQLS rubric enabled.");}}>
                {data.hqlsEnabled?"Disable new observations":"Enable HQLS rubric for this school"}
              </button>
            </div>}
            {!data.hqlsEnabled&&<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">New HQLS observations require the School Custodian or Guardian to enable this standard. Historical records remain visible.</p>}
            {!canObserve || !data.hqlsEnabled?<p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm">Only authorised instructional leaders can submit observations. Teachers can review and acknowledge their recorded observations below.</p>:<>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div><label className="text-sm font-bold">Class and teacher</label>
                  <select className={field} value={hqlsStream} onChange={e=>{setHqlsStream(e.target.value);setHqlsSession("");}}>
                    <option value="">Select a subject stream</option>
                    {roleStreams.filter(s=>!s.isTeacher).map(s=><option key={s.id} value={s.id}>{s.classLabel} · {s.subjectLabel} · {s.teacherDisplay}</option>)}
                  </select></div>
                <div><label className="text-sm font-bold">Observation type</label>
                  <select className={field} value={hqlsMode} onChange={e=>setHqlsMode(e.target.value as "full"|"walk")}>
                    <option value="full">Full observation (all 8 stages)</option>
                    <option value="walk">Quick learning walk (only seen stages)</option>
                  </select></div>
              </div>
              <div className="mt-3"><label className="text-sm font-bold">Scheduled class session (optional)</label>
                <select className={field} value={hqlsSession} onChange={e=>setHqlsSession(e.target.value)}>
                  <option value="">Observe by approved class stream only</option>
                  {data.periods.filter(p=>p.streamId===hqlsStream&&p.session).map(p=><option key={p.session!.id} value={p.session!.id}>{p.subject} · {p.class} · {p.start}–{p.end}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">Where available, select the actual checked-in lesson to link the observation to its class session.</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">A quick learning walk does not produce a total score or model/developing/violation rating.</p>
              <div className="mt-5 space-y-4">
              {HQLS.map(d=>{
                const r=ratings[d.code]??emptyRating;
                return <div key={d.code} className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-black text-slate-900">{d.name}</h3><p className="mt-1 text-sm text-slate-600">{d.test}</p>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={"Score "+d.name}>
                    {([["","Not observed"],["1","Weak (1)"],["2","Partial (2)"],["3","Strong (3)"]] as const).map(([score,name])=>
                      <button type="button" key={score} onClick={()=>setRatings(prev=>({...prev,[d.code]:{...(prev[d.code]??emptyRating),score}}))}
                        className={"rounded-lg border px-3 py-2 text-xs font-bold "+(r.score===score?"border-slate-900 bg-slate-900 text-white":"border-slate-300 bg-white text-slate-700")}>{name}</button>)}
                  </div>
                  {r.score&&<div className="mt-3">
                    <label className="block text-xs font-bold">Specific observed evidence (required)</label>
                    <textarea className={field} rows={2} maxLength={1000} value={r.evidence}
                      onChange={e=>setRatings(prev=>({...prev,[d.code]:{...(prev[d.code]??emptyRating),evidence:e.target.value}}))}
                      placeholder="Describe an actual learner or teacher action you observed."/>
                    {d.automatic&&<label className="mt-2 flex items-start gap-2 text-sm font-semibold text-rose-900">
                      <input type="checkbox" className="mt-1" checked={r.automaticFailure}
                        onChange={e=>setRatings(prev=>({...prev,[d.code]:{...(prev[d.code]??emptyRating),automaticFailure:e.target.checked}}))}/>
                      Automatic failure observed: {d.automatic}
                    </label>}
                  </div>}
                </div>;
              })}
              </div>
              <div className="mt-4 grid gap-3">
                <div><label className="text-sm font-bold">Observed strengths (required)</label><textarea className={field} rows={2} value={strengths} maxLength={1000} onChange={e=>setStrengths(e.target.value)}/></div>
                <div><label className="text-sm font-bold">One improvement priority</label><textarea className={field} rows={2} value={improvement} maxLength={1000} onChange={e=>setImprovement(e.target.value)}/></div>
                <div><label className="text-sm font-bold">Coaching action (optional; system requires coaching for low scores/failure)</label><textarea className={field} rows={2} value={coachingAction} maxLength={800} onChange={e=>setCoachingAction(e.target.value)}/></div>
                <div><label className="text-sm font-bold">Coaching deadline (optional)</label><input type="date" className={field} value={coachingDue} onChange={e=>setCoachingDue(e.target.value)}/></div>
                <button disabled={Boolean(busy)||!hqlsStream} onClick={()=>void saveRubric()} className="rounded-xl bg-brand-700 px-4 py-3 font-bold text-white disabled:opacity-50">Save evidence-led HQLS observation</button>
              </div>
            </>}
          </section>
          <section className={box}>
            <h2 className="text-xl font-black text-slate-900">Observation history & teacher reflection</h2>
            <p className="mb-3 mt-1 text-sm text-slate-600">Required teacher reflection: <b>“At which HQLS stage were you most tempted to step in — and why?”</b></p>
            {observed.length===0?<p className="text-sm text-slate-600">No accessible HQLS observations yet.</p>:<div className="space-y-4">
              {observed.map(o=><div key={o.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black">{o.mode==="full"?"Full HQLS observation":"Quick learning walk"}</h3><span className="text-xs text-slate-500">{dateTime(o.observedAt)}</span></div>
                <p className="mt-1 text-sm text-slate-600">{o.total===null?"No total score":o.total+"/24 · "+(o.band??"")} {o.automaticFailure?"· Automatic failure (coaching required)":""}</p>
                <p className="mt-2 text-sm"><b>Strengths:</b> {o.strengths}</p>
                {o.improvement&&<p className="mt-2 text-sm"><b>Improve:</b> {o.improvement}</p>}
                {o.coaching&&<p className="mt-2 text-sm"><b>Coaching:</b> {o.coaching}{o.due?" · Due "+o.due:""} {o.coachingWorkId&&<Link className="font-bold text-brand-700 underline" href={"/khpos/"+organisationId+"/work"}>Open Today</Link>}</p>}
                <details className="mt-2 text-sm"><summary className="cursor-pointer font-bold text-brand-700">View eight-domain evidence</summary>
                  <ul className="mt-2 space-y-2">{o.domains.map(d=><li key={d.code} className="rounded-lg bg-slate-50 p-2"><b>{HQLS.find(x=>x.code===d.code)?.name??d.code}:</b> {ratingText(d.score)} {d.automaticFailure?"· Automatic failure":""}<p>{d.evidence}</p></li>)}</ul>
                </details>
                {o.acknowledgedAt?<p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><b>Teacher&apos;s reflection:</b> {o.teacherResponse}</p>:o.teacherUserId===data.userId?<><label className="mt-3 block text-xs font-bold">Teacher response</label>
                  <textarea className={field} rows={2} maxLength={1500} value={responses[o.id]||""} onChange={e=>setResponses(old=>({...old,[o.id]:e.target.value}))} placeholder="Which stage tempted you to step in, and why?"/>
                  <button className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white" disabled={Boolean(busy)||!responses[o.id]?.trim()}
                    onClick={()=>void act("hqls_acknowledge",{observationId:o.id,teacherResponse:responses[o.id]},"Teacher reflection saved.")}>Submit teacher reflection</button>
                </>:<p className="mt-2 text-xs text-slate-500">Awaiting the observed teacher’s reflection.</p>}
              </div>)}
            </div>}
          </section>
        </div>}
        {tab==="leaders"&&<div className="space-y-5">
          <section className={box}>
            <h2 className="text-xl font-black text-slate-900">School Day — leadership overview</h2>
            <p className="mt-2 text-sm text-slate-600">School attendance and class lesson attendance are separate events. Times below show when they were actually recorded in Nigeria (Africa/Lagos); they are not scheduled arrival or departure times.</p>
            <p className="mt-2 text-sm font-bold text-slate-800">School date: {data.localDay}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Search records
                <input type="search" className={field} value={presenceQuery} onChange={e=>setPresenceQuery(e.target.value)} placeholder="Staff, class, subject or date"/>
              </label>
              <label className="text-sm font-semibold text-slate-700">Sort records
                <select className={field} value={presenceSort} onChange={e=>setPresenceSort(e.target.value as typeof presenceSort)}>
                  <option value="newest">Latest check-in first</option>
                  <option value="oldest">Earliest check-in first</option>
                  <option value="name">Staff name A–Z</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">Unclosed class sessions (last 14 days)</p><p className="text-2xl font-black">{data.openClassSessions.length}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">Unclosed school attendance (last 14 days)</p><p className="text-2xl font-black">{data.openSchoolAttendance.length}</p></div>
            </div>
          </section>
          <section className={box} aria-label="School attendance records">
            <h3 className="text-lg font-black text-slate-900">1. School check-in and check-out</h3>
            <p className="mt-1 text-sm text-slate-600">Staff arrival and departure for the school day. A school check-in does not prove a class was taught.</p>
            {schoolRows.length===0?<p className="mt-3 text-sm text-slate-500">{presenceQuery?"No school attendance matches this search.":"No school check-ins recorded today within your leadership scope."}</p>:
              <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-slate-600"><th className="p-2">Staff</th><th className="p-2">Campus</th><th className="p-2">School date</th><th className="p-2">School check-in recorded</th><th className="p-2">School check-out recorded</th></tr></thead>
                <tbody>{schoolRows.map((d,i)=><tr key={i} className="border-b"><td className="p-2">{d.name}</td><td className="p-2">{data.campuses.find(c=>c.id===d.campusId)?.name??"School campus"}</td><td className="p-2">{data.localDay}</td><td className="p-2">{dateTime(d.in)}</td><td className="p-2">{dateTime(d.out)}{d.administrativelyClosed?" (administratively closed)":""}</td></tr>)}</tbody></table></div>}
          </section>
          <section className={box} aria-label="Class attendance records">
            <h3 className="text-lg font-black text-slate-900">2. Class lesson check-in and check-out</h3>
            <p className="mt-1 text-sm text-slate-600">Recorded attendance for individual subject periods today. Only classes with an actual check-in appear; unscheduled or unchecked classes must not be treated as attended.</p>
            {classRows.length===0?<p className="mt-3 text-sm text-slate-500">{presenceQuery?"No class check-ins match this search.":"No class lesson check-ins have been recorded today within your scope."}</p>:
              <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-slate-600"><th className="p-2">Teacher</th><th className="p-2">Class / subject</th><th className="p-2">School date</th><th className="p-2">Class check-in recorded</th><th className="p-2">Class check-out recorded</th><th className="p-2">Lesson outcome</th></tr></thead>
                <tbody>{classRows.map(p=><tr key={p.session!.id} className="border-b"><td className="p-2">{p.teacher}</td><td className="p-2">{p.class} · {p.subject}</td><td className="p-2">{data.localDay}</td><td className="p-2">{dateTime(p.session!.in)}</td><td className="p-2">{dateTime(p.session!.out)}{p.session!.administrativelyClosed?" (admin)":""}</td><td className="p-2">{p.session!.outcome||"In progress"}</td></tr>)}</tbody></table></div>}
          </section>
          <section className={box}>
            <h3 className="text-lg font-black text-slate-900">Administrative corrections</h3>
          {(data.openClassSessions.length>0||data.openSchoolAttendance.length>0)&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-black text-amber-900">Administrative correction — evidence required</h3>
            <p className="my-2 text-sm text-amber-900">An authorised leader can close an unfinished session. A corrected lesson is marked unverified, not as proof that teaching occurred. Staff should explain missed check-outs through Issues &amp; Escalations.</p>
            <label className="block text-xs font-bold">Correction reason and supporting reference (at least 15 characters)</label>
            <textarea className={field} rows={2} maxLength={1000} value={reconcileReason} onChange={e=>setReconcileReason(e.target.value)} placeholder="Reason, verified information and issue reference."/>
            {data.openClassSessions.map(x=><div key={x.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm">
              <span><b>{x.teacher}</b> · {x.class} · {x.subject} · School date: {x.date} · Class check-in: {dateTime(x.in)}</span>
              <button disabled={Boolean(busy)||reconcileReason.trim().length<15} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40" onClick={()=>void act("class_reconcile",{classSessionId:x.id,reason:reconcileReason},"Class administratively closed as unverified.")}>Close as unverified</button>
            </div>)}
            {data.openSchoolAttendance.map(x=><div key={x.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm">
              <span><b>{x.teacher}</b> · School date: {x.date} · School check-in: {dateTime(x.in)}</span>
              <button disabled={Boolean(busy)||reconcileReason.trim().length<15} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40" onClick={()=>void act("school_reconcile",{presenceId:x.id,reason:reconcileReason},"School attendance administratively closed.")}>Record admin closure</button>
            </div>)}
          </div>}

          </section>
        </div>}
        </>}
      </>}
    </div>
  </div>;
}
