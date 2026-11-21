"use client";

import { useState } from "react";
import { financeDate, toKobo } from "@/lib/khpos/ops/school-finance-shared";
import { csv } from "./FinanceExports";
import { Grid, Pager, primary, secondary, selectClass, str, type Row } from "./FinanceControls";
import { financeFileRows } from "./FinanceLearners";
import type { OperationProps } from "./FinanceOperations";

const columns = ["Admission number","Balance type","Amount (NGN)"];

export function FinanceOpeningImport({ p, reload }: { p: OperationProps; reload: () => void }) {
  const [rows,setRows] = useState<string[][]>([]);
  const [status,setStatus] = useState<Row[]>([]);
  const [date,setDate] = useState(p.start < financeDate() ? p.start : "");
  const [offset,setOffset] = useState(0);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [preview,setPreview] = useState(false);

  async function open(file: File) {
    setBusy(true);setPreview(false);setError("");setRows([]);setOffset(0);setStatus([]);
    try {
      const [header,...items] = await financeFileRows(file);
      if (!header || columns.some((name,i)=>header[i]?.trim().toLowerCase()!==name.toLowerCase()) || !items.length || items.length>10000) {
        throw new Error("Use the opening balances template with between 1 and 10,000 rows.");
      }
      setRows(items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The file could not be opened."); }
    finally {setBusy(false);}
  }

  async function run(commit: boolean) {
    setBusy(true);setError("");
    const results = commit ? [...status] : [];
    const counts = new Map<string,number>();
    for (const [admission] of rows) {
      const key = admission?.trim().toLowerCase();
      counts.set(key,(counts.get(key) ?? 0)+1);
    }
    try {
      for (let start=0;start<rows.length;start+=50) {
        const batch: Row[] = [];
        const positions: number[] = [];
        rows.slice(start,start+50).forEach(([number,type,amount],i)=>{
          const index=start+i;
          if (commit && status[index]?.result!=="ready") return;
          if ((counts.get(number?.trim().toLowerCase()) ?? 0)>1) {
            results[index]={result:"error",message:"This admission number is repeated in the file."};return;
          }
          try {
            const kind = ({ debt:"openingDebt",credit:"credit" } as Record<string,string>)[type?.trim().toLowerCase()];
            if (!kind || !number?.trim()) throw new Error("Enter an admission number and choose debt or credit.");
            batch.push({admission:number,kind,amount:toKobo(amount??"")});positions.push(index);
          } catch (cause) {results[index]={result:"error",message:cause instanceof Error ? cause.message : "Check this row."};}
        });
        if (batch.length) {
          const checked=await p.call<Row[]>("ledger",commit?"importOpening":"previewOpening",{period:p.period,date,rows:batch});
          positions.forEach((position,i)=>{results[position]=checked[i];});
        }
        setStatus([...results]);
      }
      setPreview(!commit);
    } catch (cause) {setError(cause instanceof Error ? cause.message : "The import stopped. Validate the file again before retrying.");}
    finally {if (commit) reload();setBusy(false);}
  }
  return <div className="space-y-3">
    <p className="text-sm text-slate-700">Use a separate file for balances brought forward. The School Custodian reviews each row. Historical balances do not count as new income.</p>
    <button className={secondary} onClick={()=>csv("opening-balances-template",[columns,["KNS-001","debt","35000.00"],["KNS-002","credit","2500.00"]])}>Download opening balances template</button>
    <label className="grid max-w-xs gap-1 text-sm font-semibold">Effective date
      <input type="date" className={selectClass} value={date} min={p.start} max={p.end} disabled={busy||p.closed}
        onChange={event=>{ setDate(event.target.value);setPreview(false);setStatus([]); }} />
    </label>
    <label className="grid gap-1 text-sm font-semibold">Opening balances spreadsheet
      <input type="file" accept=".csv,.xlsx" disabled={busy||p.closed} onChange={event=>{
        const file=event.target.files?.[0];
        if (file) void open(file);
        event.target.value="";
      }} />
    </label>
    {rows.length>0 && <>
      <div className="flex flex-wrap gap-2">
        <button className={secondary} disabled={busy || !date || p.closed} onClick={()=>void run(false)}>Validate {rows.length} rows</button>
        <button className={primary} disabled={busy || !preview || p.closed || !status.some(row=>row.result==="ready")}
          onClick={()=>void run(true)}>Send valid balances for review</button>
      </div>
      <Grid rows={rows.slice(offset,offset+50).map(([admission,type,amount],i)=>({admission,type,amount,result:status[offset+i]}))}
        columns={[["Admission",row=>str(row.admission)],["Type",row=>str(row.type)],["Amount",row=>str(row.amount)],
          ["Result",row=>str((row.result as Row | undefined)?.message || (row.result as Row | undefined)?.result) || "Awaiting validation"]]} />
      <Pager offset={offset} setOffset={setOffset} more={rows.length>offset+50} />
    </>}
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
  </div>;
}
