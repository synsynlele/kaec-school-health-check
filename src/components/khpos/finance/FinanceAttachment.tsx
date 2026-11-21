"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { download } from "./FinanceExports";
import { secondary } from "./FinanceControls";

export function FinanceAttachment({ school,campus,entry }: { school: string; campus: string; entry: string }) {
  const [working,setWorking] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState(false);

  async function request(file?: File) {
    setWorking(true);setMessage("");setError(false);
    try {
      if (file && file.size>3_000_000) throw new Error("Choose a file of 3 MB or less.");
      const client = createBrowserSupabaseClient();
      const session = (await client?.auth.getSession())?.data.session;
      if (!session) throw new Error("Sign in to access the document.");
      const params = new URLSearchParams({ campus,entry });
      const response = await fetch("/api/khpos/ops/finance/"+school+"/document?"+params,{
        method:file?"POST":"GET",body:file,cache:"no-store",headers:{ Authorization:"Bearer "+session.access_token },
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "The document action could not be completed.");
      if (file) setMessage("Supporting document attached.");
      else {
        const name = response.headers.get("Content-Disposition")?.match(/"([^"]+)"/)?.[1] ?? "finance-document";
        download(name,await response.blob());
      }
    } catch (cause) {
      setError(true);setMessage(cause instanceof Error ? cause.message : "The document could not be opened.");
    } finally { setWorking(false); }
  }

  return <details className="min-w-36">
    <summary className="cursor-pointer py-2 font-semibold">Document</summary>
    <div className="space-y-2">
      <button className={secondary} disabled={working} onClick={()=>void request()}>Download attachment</button>
      <label className="grid gap-1 text-xs font-semibold">Attach PDF, PNG or JPEG
        <input className="max-w-52" type="file" disabled={working} accept=".pdf,.png,.jpg,.jpeg" onChange={event=>{
          const file=event.target.files?.[0];
          if (file) void request(file);
          event.target.value="";
        }} />
      </label>
      {message && <p role={error?"alert":"status"} className={error?"text-rose-800":"text-emerald-800"}>{message}</p>}
    </div>
  </details>;
}
