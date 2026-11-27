"use client";

import { useState } from "react";
import { ChevronRight, ReceiptText } from "lucide-react";
import { currency } from "@/lib/khpos/ops/school-finance-shared";
import { Expand, LoadingState, Pager, Search, card, secondary, selectClass, str, useFinanceData, type Row } from "./FinanceControls";
import { LearnerStatement, PostingForm, printReceipt, type OperationProps } from "./FinanceOperations";

export function FinanceCollection({ p, classes, initialLearner, initialInvoice }: {
  p: OperationProps; classes: Row[]; initialLearner: string; initialInvoice: string;
}) {
  const [query, setQuery] = useState("");
  const [className, setClassName] = useState("");
  const [offset, setOffset] = useState(0);
  const [learner, setLearner] = useState(initialLearner);
  const [invoiceOffset, setInvoiceOffset] = useState(0);
  const [target, setTarget] = useState(initialInvoice);
  const [receiptError, setReceiptError] = useState("");
  const [printing, setPrinting] = useState(false);
  const searching = Boolean(query || className);
  const roster = useFinanceData<Row[]>(p.call,"register","learners",{ search:query, class:className, offset },p.refresh,searching);
  const account = useFinanceData<{ name: string; class: string; admission: string; billed: number; balance: number; credit: number; latestReceipt: string | null }>(
    p.call,"ledger","statement",{ period:p.period,learner,offset:0 },p.refresh,Boolean(learner));
  const invoices = useFinanceData<Row[]>(p.call,"ledger","invoices",{ period:p.period,learner,includeHistory:true,outstandingOnly:true,offset:invoiceOffset },p.refresh,Boolean(learner));
  const chosen = useFinanceData<Row[]>(p.call,"ledger","invoice",{ period:p.period,id:target },p.refresh,Boolean(target && target!=="credit"));
  const invoice = chosen.data?.find(row=>row.learner_id===learner);
  const name = account.data?.name;

  async function latestReceipt() {
    if (!account.data?.latestReceipt || printing) return;
    setPrinting(true);
    setReceiptError("");
    try {
      const [receipt] = await p.call<Row[]>("ledger","receipt",{ period:p.period,id:account.data.latestReceipt });
      if (!receipt) throw new Error("This receipt is unavailable.");
      printReceipt(receipt,p.school);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : "The receipt could not be opened.");
    } finally { setPrinting(false); }
  }

  return <div className="space-y-5">
    <section className={card} aria-labelledby="find-learner">
      <h2 id="find-learner" className="text-xl font-bold tracking-tight">Find a learner</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_minmax(12rem,0.4fr)]">
        <Search label="Learner name, parent name or admission number" onSearch={value=>{setQuery(value);setOffset(0);}} />
        <label className="grid gap-1 text-sm font-semibold">Browse by class
          <select className={selectClass} value={className} onChange={event=>{setClassName(event.target.value);setOffset(0);}}>
            <option value="">All classes</option>
            {[...new Set(classes.map(row=>str(row.name)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(value=>
              <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <LoadingState {...roster} />
      {roster.data && (roster.data.length ? <>
        <ul aria-label="Matching learners" className="max-h-64 divide-y overflow-auto rounded-xl border border-slate-200">
          {roster.data.slice(0,50).map(row=><li key={str(row.id)}>
            <button className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-slate-50 aria-pressed:bg-emerald-50"
              type="button" aria-pressed={learner===row.id} disabled={p.busy} onClick={()=>{
                setLearner(str(row.id));setTarget("");setInvoiceOffset(0);setReceiptError("");
              }}>
              <span className="min-w-0 break-words"><strong className="block">{str(row.name)}</strong>
                <span className="text-sm text-slate-600">{[row.class,row.arm,row.admission].map(str).filter(Boolean).join(" · ")}</span>
              </span><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
            </button>
          </li>)}
        </ul><Pager offset={offset} setOffset={setOffset} more={roster.data.length>50} />
      </> : <p className="text-sm text-slate-600">No learners match this search.</p>)}
    </section>
    <LoadingState {...account} />
    {account.data && <section className={card} aria-labelledby="learner-fee-account">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h2 id="learner-fee-account" className="break-words text-2xl font-bold tracking-tight">{name || "Learner account"}</h2>
          <p className="text-sm text-slate-600">{[account.data.class,account.data.admission].filter(Boolean).join(" · ")}</p></div>
        {account.data.latestReceipt && <button type="button" disabled={printing} onClick={()=>void latestReceipt()} className={secondary+" inline-flex items-center gap-2"}>
          <ReceiptText aria-hidden="true" className="size-4" />{printing ? "Opening receipt…" : "Print latest receipt"}
        </button>}
      </div>
      {receiptError && <p role="alert" className="text-sm text-rose-800">{receiptError}</p>}
      <dl className="grid gap-2 sm:grid-cols-3">
        {[["Outstanding balance",account.data.balance],["Fees billed",account.data.billed],["Available credit",account.data.credit]].map(([label,amount],i)=>
          <div key={label} className={i===0 ? "min-w-0 rounded-xl bg-emerald-950 p-4 text-white" : "min-w-0 rounded-xl bg-slate-100 p-4"}>
            <dt className="text-sm font-medium">{label}</dt><dd className="mt-1 break-words text-2xl font-bold tabular-nums">{currency(amount)}</dd>
          </div>)}
      </dl>
      {p.closed ? <p className="text-sm text-slate-700">This accounting period is closed. Choose an open term to record a payment.</p> :
        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-lg font-bold">Record a payment</h3>
          {!p.accounts.length && <p className="text-sm text-slate-700">Add a receiving account in School Finance settings before recording a payment.</p>}
          <LoadingState {...invoices} />
          <label className="grid gap-1 text-sm font-semibold">Apply payment to
            <select className={selectClass} value={target} disabled={p.busy} onChange={event=>setTarget(event.target.value)}>
              <option value="">Choose an invoice or learner credit</option>
              {invoice && !invoices.data?.slice(0,50).some(row=>row.id===invoice.id && Number(row.balance)>0) &&
                <option value={str(invoice.id)} disabled={Number(invoice.balance)<=0}>{str(invoice.label)} · {currency(invoice.balance)} due</option>}
              {invoices.data?.slice(0,50).filter(row=>Number(row.balance)>0).map(row=><option key={str(row.id)} value={str(row.id)}>
                {str(row.label)} · {currency(row.balance)} due
              </option>)}
              <option value="credit">Save as learner credit</option>
            </select>
          </label>
          {invoices.data && <Pager offset={invoiceOffset} setOffset={setInvoiceOffset} more={invoices.data.length>50} />}
          <LoadingState {...chosen} />
          {target && target!=="credit" && chosen.data && !invoice && <p role="alert" className="text-sm text-rose-800">Choose an invoice for this learner.</p>}
          {(target==="credit" || invoice) &&
            <PostingForm key={learner+target} p={p} kind="payment" learner={learner} invoice={invoice} />}
        </div>}
      <Expand title="Fee statement and payment history"><LearnerStatement key={learner} p={p} learner={learner} /></Expand>
    </section>}
  </div>;
}
