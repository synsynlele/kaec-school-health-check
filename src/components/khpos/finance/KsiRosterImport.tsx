"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Expand, Field, FinanceForm, secondary, str, type Row } from "./FinanceControls";

type SourceClass = { id: string; name: string; session: string | null };
type Result = { admission: string | null; name?: string; result: "synced" | "review"; message?: string };

export function KsiRosterImport({ school, campus, classes, terms, term, refresh }: {
  school: string; campus: string; classes: Row[]; terms: Row[]; term: string; refresh: () => void;
}) {
  const [sharing,setSharing]=useState<boolean>();
  const [sources,setSources]=useState<SourceClass[]>();
  const [results,setResults]=useState<Result[]>([]);
  const [syncedCount,setSyncedCount]=useState<number>();
  const [busy,setBusy]=useState(false);
  const [scheduleMessage,setScheduleMessage]=useState("");
  const [error,setError]=useState("");

  async function request(input:object) {
    const session=(await createBrowserSupabaseClient()?.auth.getSession())?.data.session;
    if(!session) throw new Error("Sign in to sync learners.");
    const response=await fetch("/api/khpos/ops/learner-roster/"+school,{
      method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
      body:JSON.stringify({campus,...input}),
    });
    const body=await response.json();
    if(!response.ok) throw new Error(body.error ?? "Could not connect to KSI.");
    return body;
  }

  async function load() {
    if(busy) return;
    setBusy(true);
    setError("");
    try {setSources((await request({action:"classes"})).classes);}
    catch(cause) {setError(cause instanceof Error ? cause.message : "Could not load classes.");}
    finally {setBusy(false);}
  }

  async function changeSharing() {
    if(busy) return;
    setBusy(true);
    setError("");
    try {
      const result=await request({action:"share",enabled:sharing===undefined?undefined:!sharing});
      setSharing(result.enabled);
    } catch(cause) {
      setError(cause instanceof Error ? cause.message : "Could not manage sharing.");
    } finally {
      setBusy(false);
    }
  }

  return <Expand title="KSI learner roster">
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-slate-700">If KSI is your registration source, choose a class from your paired school and match it to a KHP-OS campus class and term. The sync uses admission numbers and flags conflicts for review.</p>
      <button type="button" className={secondary} disabled={busy} onClick={()=>void changeSharing()}>
        {busy?"Please wait…":sharing===undefined?"Check sharing with KSI":sharing?"Stop sharing this campus":"Share this campus with KSI"}
      </button>
      {sharing && <p className="break-all text-sm">KHP-OS school ID for KSI <code>{school}</code></p>}
      {sharing!==undefined && <p role="status" className="text-sm font-semibold">Campus sharing is {sharing?"on":"off"}.</p>}
      {!sources && <button type="button" className={secondary} disabled={busy} onClick={()=>void load()}>{busy?"Connecting…":"Load classes from KSI"}</button>}
      {sources && <FinanceForm disabled={busy || !sources.length || !classes.length || !terms.length}
        submitLabel={busy?"Working…":"Continue"} onSubmit={async row=>{
          if(busy) return;
          const source=sources.find(item=>item.id===row.sourceClass);
          const destination=terms.find(item=>item.id===row.term);
          const sessionKey=(value:string)=>value.replace(/^(\d{4})[/\s-]+(?:\d{2})?(\d{2})$/,"$1/$2");
          if(!source?.session || sessionKey(source.session)!==sessionKey(str(destination?.session))) {
            throw new Error("Choose a KHP-OS term in the same academic session as the KSI class.");
          }
          setBusy(true);setError("");setResults([]);setSyncedCount(undefined);setScheduleMessage("");
          if(row.operation && row.operation!=="manual") {
            try {
              const {schedule}=await request({action:"schedule",classId:row.classId,sourceClass:row.sourceClass,
                term:row.term,enabled:row.operation==="check"?undefined:row.operation==="enable"});
              setScheduleMessage(schedule ? [schedule.enabled?"Daily sync is on.":"Daily sync is paused.",schedule.last_status,
              schedule.last_run?"Last run "+new Date(schedule.last_run).toLocaleString():null,
              schedule.review_count?schedule.review_count+" to review. Run a manual import for details.":null].filter(Boolean).join(" ")
              : "Daily sync has yet to be set up for this class.");
            } finally {setBusy(false);}
            return;
          }
          let count=0;
          const review:Result[]=[];
          let after:string|null=null;
          try {
            do {
              const page=await request({action:"sync",...row,after}) as {results:Result[];after:string|null};
              count+=page.results.filter(item=>item.result==="synced").length;
              review.push(...page.results.filter(item=>item.result==="review"));
              after=page.after;
            } while(after);
          } catch(cause) {
            setError(cause instanceof Error ? cause.message : "Sync stopped. Run it again to continue.");
          } finally {
            setSyncedCount(count);setResults(review);setBusy(false);
            if(count) refresh();
          }
        }}>
        <Field label="KSI class" name="sourceClass" choices={sources.map(item=>[item.id,[item.name,item.session].filter(Boolean).join(" · ")])} />
        <Field label="KHP-OS class and arm" name="classId" choices={classes.map(item=>[str(item.id),[str(item.name),str(item.arm)].filter(Boolean).join(" · ")])} />
        <Field label="KHP-OS term" name="term" value={term} choices={terms.map(item=>[str(item.id),str(item.session)+" · "+str(item.name)])} />
        <Field label="What would you like to do?" name="operation" value="manual" choices={[
          ["manual","Sync now"],["check","Check daily sync status"],["enable","Enable daily sync"],["pause","Pause daily sync"],
        ]} />
      </FinanceForm>}
      {scheduleMessage && <p role="status" className="text-sm font-semibold">{scheduleMessage}</p>}
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      {syncedCount!==undefined && <p role="status" className="text-sm font-semibold">{syncedCount} synced · {results.length} to review</p>}
      {!!results.length && <ul className="max-h-64 space-y-2 overflow-auto">
        {results.map((item,index)=><li key={index} className="break-words rounded-lg border bg-white p-2 text-sm">
          <strong>{[item.name,item.admission].filter(Boolean).join(" · ") || "Learner record"}</strong> {item.message}
        </li>)}
      </ul>}
    </div>
  </Expand>;
}
