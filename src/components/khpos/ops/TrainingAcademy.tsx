"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Download, ExternalLink, GraduationCap } from "lucide-react";
import { LoadingScreen } from "@/components/navigation/LoadingScreen";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AcademyCourse } from "@/lib/khpos/academy-data";

export function TrainingAcademy({organisationId}:{organisationId?:string}){
  const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
  const [courses,setCourses]=useState<AcademyCourse[]>([]);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
  const [error,setError]=useState("");
  const [downloading,setDownloading]=useState("");
  const [active,setActive]=useState("");
  const params=useMemo(()=>new URLSearchParams(organisationId?{scope:"school",organisationId}:{scope:"hq"}).toString(),[organisationId]);
  useEffect(()=>{
    let mounted=true;const controller=new AbortController();
    async function load(){
      setStatus("loading");setError("");
      try{
        const token=(await supabase?.auth.getSession())?.data.session?.access_token;
        if(!token) throw new Error("Sign in to open your training materials.");
        const res=await fetch("/api/khpos/academy?"+params,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:controller.signal});
        const data=await res.json() as {ok:boolean;courses?:AcademyCourse[];error?:string};
        if(!res.ok||!data.ok||!data.courses) throw new Error(data.error||"Training is unavailable.");
        if(mounted){setCourses(data.courses);setStatus("ready");setActive(data.courses[0]?.id??"");}
      }catch(e){if(mounted&&!controller.signal.aborted){setError(e instanceof Error?e.message:"Training is unavailable.");setStatus("error");}}
    }
    void load();return ()=>{mounted=false;controller.abort();};
  },[params,supabase]);
  async function download(course:AcademyCourse,format:"pdf"|"pptx"){
    if(downloading)return;const key=course.id+"-"+format;setDownloading(key);setError("");
    try{
      const token=(await supabase?.auth.getSession())?.data.session?.access_token;
      if(!token)throw new Error("Sign in again to download.");
      const url="/api/khpos/academy?"+params+"&course="+encodeURIComponent(course.id)+"&format="+format;
      const res=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      if(!res.ok){const data=await res.json() as {error?:string};throw new Error(data.error||"The download failed.");}
      const blob=await res.blob();
      const objectUrl=URL.createObjectURL(blob);
      const anchor=document.createElement("a");anchor.href=objectUrl;anchor.download="KHP-OS_"+course.id+"_Academy_v"+course.version+"."+format;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    }catch(e){setError(e instanceof Error?e.message:"The download failed.");}
    finally{setDownloading("");}
  }
  const selected=courses.find(c=>c.id===active)??courses[0];
  const origin=organisationId?"/khpos/"+organisationId:"";
  return <section className="space-y-6" aria-label="KHP-OS Training Academy">
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center gap-3"><GraduationCap className="size-8 text-emerald-700"/><div>
        <h2 className="text-2xl font-black text-slate-950">Training Academy</h2>
        <p className="mt-1 text-sm text-slate-600">Learn your role, practise the workflows, and keep the approved guides for reference.</p>
      </div></div>
      <p className="mt-4 text-sm text-slate-600">The latest guides are generated directly by KHP-OS. Your active school or corporate appointment determines which levels you can see.</p>
      {status==="loading"&&<LoadingScreen inline message="Checking your training access…" />}
      {status==="ready"&&<div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Training level">
        {courses.map(course=><button key={course.id} type="button" role="tab" aria-selected={course.id===selected?.id} onClick={()=>setActive(course.id)}
          className={"rounded-xl px-4 py-3 text-sm font-bold "+(course.id===selected?.id?"bg-slate-950 text-white":"border border-slate-300 bg-white text-slate-800")}>{course.id==="staff"?"Level 1 — Staff":course.id==="leadership"?"Level 2 — School leaders":"Level 3 — KAEC HQ"}</button>)}
      </div>}
    </div>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {selected&&status==="ready"&&<div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap justify-between gap-4">
        <div><h3 className="text-xl font-black text-slate-950">{selected.title}</h3><p className="mt-2 text-sm text-slate-600">{selected.audience}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{selected.lessons.length} lessons · Version {selected.version} · Updated {selected.updated}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!downloading} onClick={()=>void download(selected,"pdf")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Download className="size-4"/>{downloading===selected.id+"-pdf"?"Preparing…":"Download PDF"}</button>
          <button type="button" disabled={!!downloading} onClick={()=>void download(selected,"pptx")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-50"><Download className="size-4"/>{downloading===selected.id+"-pptx"?"Preparing…":"Download PowerPoint"}</button>
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-600">Browse every lesson below before downloading. Training provides guidance; your school's approved policies and assigned permissions remain authoritative.</p>
      <div className="space-y-3">
      {selected.lessons.map((lesson,index)=><details key={lesson.title} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-black text-slate-950"><span className="mr-2 text-emerald-700">{String(index+1).padStart(2,"0")}.</span>{lesson.title}</summary>
        <p className="mt-3 text-sm text-slate-700">{lesson.purpose}</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">{lesson.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950"><strong>Practise:</strong> {lesson.practice}</p>
        <Link href={lesson.route==="/khpos"?"/khpos":origin+lesson.route} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-800"><ExternalLink className="size-4"/>Open relevant KHP-OS page</Link>
      </details>)}
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><BookOpen className="mt-0.5 size-5 shrink-0 text-emerald-700"/>
        <p className="text-sm text-slate-700">Your school leader or KAEC trainer should verify real-life practice before marking you ready for independent work. Reading a presentation does not activate a staff position or authorise approvals.</p>
      </div>
    </div>}
  </section>;
}
