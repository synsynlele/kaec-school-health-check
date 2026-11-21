"use client";

import { useState } from "react";
import { currency, financeCategories, financeWarnings, toKobo } from "@/lib/khpos/ops/school-finance-shared";
import { Expand, Field, FinanceForm, Grid, LoadingState, Pager, card, money, primary, secondary, str, useFinanceData,
  type Option, type Row } from "./FinanceControls";
import { allPages, excel, printFinance } from "./FinanceExports";
import type { OperationProps } from "./FinanceOperations";

const indicators: Option[] = [
  ["received","Net money received"],["expenses","Net expenses paid"],["cash","Cash and bank balance"],
  ["invoiced","New fees invoiced"],["balance","Total outstanding fees"],["overdue","Overdue fees"],
];
const metrics: Option[] = [
  ...indicators,["feeReceipts","Net fees received"],["otherIncome","Net other income"],["netCashFlow","Net operating cash flow"],
  ["due","Current fees due after assistance"],["collected","Applied to fees due"],["aged30","1–30 days overdue"],
  ["aged60","31–60 days overdue"],["aged90","61–90 days overdue"],["agedOlder","More than 90 days overdue"],
];
const chartKeys: [string,string,string][] = [
  ["fees","Fees received","bg-emerald-600"],["income","Other income","bg-sky-600"],["expenses","Expenses","bg-amber-600"],
];
const labels = (summary: Row) => (summary.reconciliationComplete ? "Reconciled records" : "Recorded figures");
const percent = (used: unknown, total: unknown) => Number(total)>0 ? Math.round(100*Number(used)/Number(total))+"%" : "No baseline";

export function FinanceOverview({ p, open }: { p: OperationProps; open: (tab: string) => void }) {
  const data = useFinanceData<Row>(p.call,"report","overview",{ period:p.period },p.refresh);
  const summary = data.data;
  const timeline = (summary?.timeline ?? []) as Row[];
  const max = Math.max(1,...timeline.flatMap(row=>chartKeys.map(([key])=>Math.abs(Number(row[key])))));
  return <div className="space-y-4">
    <LoadingState {...data} />
    {summary && <>
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="text-xl font-bold">Where your money stands</h2><p className="mt-1 text-sm text-slate-600">{str(summary.from)} to {str(summary.to)}</p></div>
          <p className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{labels(summary)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {indicators.map(([key,label]) => <div key={key} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
            <p className="mt-1 break-words text-lg font-black tabular-nums text-slate-950 sm:text-2xl">{money(summary,key)}</p>
          </div>)}
          <div className="rounded-xl bg-emerald-50 p-3 sm:p-4"><h3 className="text-sm font-bold text-emerald-950">Collected against fees due</h3>
            <p className="mt-1 text-xl font-black text-emerald-950">{percent(summary.collected,summary.due)}</p></div>
          <div className="rounded-xl bg-sky-50 p-3 sm:p-4"><h3 className="text-sm font-bold text-sky-950">Budget used</h3>
            <p className="mt-1 text-xl font-black text-sky-950">{percent(summary.spent,summary.budget)}</p></div>
        </div>
      </section>
      <section className={card}>
        <h2 className="text-xl font-bold">Needs attention</h2>
        <ul className="space-y-2">{financeWarnings(summary).map(message =>
          <li key={message} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{message}</li>)}</ul>
        <div className="flex flex-wrap gap-2">
          {Number(summary.pending)>0 && <button className={primary} onClick={()=>open("Income & Expenses")}>Open adjustment approvals</button>}
          {Number(summary.overdueLearners)>0 && <button className={secondary} onClick={()=>open("Reports & Financial Health")}>Review overdue fees</button>}
        </div>
      </section>
      <section className={card}>
        <h2 className="text-xl font-bold">Money in and out by month</h2>
        {timeline.length ? <div className="space-y-4">{timeline.map(row => <div key={str(row.month)} className="space-y-1">
          <h3 className="text-sm font-bold">{str(row.month)}</h3>
          {chartKeys.map(([key,label,color]) => <div key={key} className="grid grid-cols-[6.75rem_1fr] items-center gap-2 text-xs sm:grid-cols-[9rem_1fr_8rem]">
            <span>{label}</span><div aria-hidden="true" className="h-2 rounded-full bg-slate-100">
              <div style={{width:Math.abs(Number(row[key]))/max*100+"%"}} className={"h-full rounded-full "+color} /></div>
            <span className="col-span-2 text-right tabular-nums sm:col-span-1">{money(row,key)}</span>
          </div>)}
        </div>)}</div> : <p className="text-sm text-slate-700">Monthly totals will appear after income or expenses are recorded.</p>}
      </section>
    </>}
  </div>;
}

export function FinanceBudgets({ p }: { p: OperationProps }) {
  const data = useFinanceData<Row[]>(p.call,"report","budget",{ period:p.period },p.refresh);
  const [selected,setSelected] = useState<Row>();
  return <section className={card}>
    <h2 className="text-xl font-bold">Budgets</h2>
    <p className="text-sm text-slate-700">Use the same category and department when recording expenses. Leave the department blank for expenses without a department.</p>
    <FinanceForm key={str(selected?.id ?? "new")} disabled={p.busy || p.closed} submitLabel="Save budget" onSubmit={async row => {
      await p.write("report","saveBudget",{ ...row,period:p.period,amount:toKobo(row.amount) },"Budget saved.");
    }}>
      <Field label="Expense category" name="category" choices={financeCategories.expense.map(category=>[category,category])} value={str(selected?.category)} />
      <Field label="Department" name="department" required={false} value={str(selected?.department)} />
      <Field label="Planned spending (₦)" name="amount" type="money" value={selected ? (Number(selected.amount)/100).toFixed(2) : ""} />
    </FinanceForm>
    <LoadingState {...data} />
    {data.data && <Grid rows={data.data} columns={[
      ["Category",row=>str(row.category)],["Department",row=>str(row.department)],["Planned",row=>money(row,"amount")],
      ["Spent",row=>money(row,"spent")],["Remaining",row=>currency(BigInt(str(row.amount))-BigInt(str(row.spent))+"")],
      ["Used",row=>percent(row.spent,row.amount)],
      ["Edit",row=><button className={secondary} disabled={p.closed} onClick={()=>setSelected(row)}>Edit amount</button>],
    ]} empty="No budgets are set for this campus and term." />}
  </section>;
}

export function FinanceReports({ p }: { p: OperationProps }) {
  const [annual,setAnnual] = useState(false);
  const [offset,setOffset] = useState(0);
  const [exporting,setExporting] = useState(false);
  const [error,setError] = useState("");
  const report = useFinanceData<Row>(p.call,"report",annual ? "annual" : "overview",{ period:p.period },p.refresh);
  const aged = useFinanceData<Row[]>(p.call,"report","aged",{ period:p.period,offset },p.refresh);
  const summary = report.data;
  const categories = (summary?.categories ?? []) as Row[];
  const accounts = (summary?.accounts ?? []) as Row[];

  async function exportReport() {
    if (!summary) return;
    setExporting(true);setError("");
    try {
      const debts = annual ? [] : await allPages(offset=>p.call<Row[]>("report","aged",{period:p.period,offset}));
      const budgets = annual ? [] : await p.call<Row[]>("report","budget",{period:p.period});
      await excel(annual ? "annual-finance-summary" : "term-finance-summary",[
        { title:"Summary",rows:[["Metric","Value"],["School",p.school],["Basis",labels(summary)],["From",str(summary.from)],["Through",str(summary.to)],
          ...metrics.map(([key,label])=>[label,money(summary,key)])] },
        { title:"Income and expenditure",rows:[["Type","Category","Amount (NGN)"],...categories.map(row=>[str(row.kind),str(row.category),money(row,"amount")])] },
        { title:"Accounts",rows:[["Account","Balance (NGN)","Reconciled through"],...accounts.map(row=>[str(row.name),money(row,"balance"),str(row.reconciled)])] },
        { title:"Aged debts",rows:[["Learner","Admission","Due date","Days overdue","Outstanding (NGN)"],...debts.map(row=>
          [str(row.learner_name),str(row.admission_number),str(row.due),str(row.days),money(row,"balance")])] },
        { title:"Budgets",rows:[["Category","Department","Planned (NGN)","Spent (NGN)"],...budgets.map(row=>
          [str(row.category),str(row.department),money(row,"amount"),money(row,"spent")])] },
      ]);
    } catch(cause) {setError(cause instanceof Error ? cause.message : "Export could not be prepared.");}
    finally {setExporting(false);}
  }

  function printReport() {
    if (!summary) return;
    printFinance(annual ? "Annual finance summary" : "Term finance summary",p.school,[
      { title:labels(summary)+" · "+str(summary.from)+" to "+str(summary.to),rows:[["Metric","Amount"],...metrics.map(([key,label])=>[label,money(summary,key)])] },
      { title:"Income and expenditure by category",rows:[["Type","Category","Amount"],...categories.map(row=>[str(row.kind),str(row.category),money(row,"amount")])] },
      { title:"Cash and bank accounts",rows:[["Account","Balance","Reconciled through"],...accounts.map(row=>[str(row.name),money(row,"balance"),str(row.reconciled)])] },
    ]);
  }

  return <section className={card}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h2 className="text-xl font-bold">Finance reports</h2>
      <label className="grid gap-1 text-sm font-bold">Report dates
        <select className={secondary} value={annual ? "annual" : "term"} onChange={event=>setAnnual(event.target.value==="annual")}>
          <option value="term">Selected term</option><option value="annual">Full academic session</option>
        </select>
      </label>
    </div>
    <LoadingState {...report} />
    {summary && <>
      <p className="text-sm text-slate-700">{labels(summary)} · {str(summary.from)} to {str(summary.to)}. Official approval applies to the separate Financial Health statement below.</p>
      {!!summary.missingTerms && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{str(summary.missingTerms)} academic terms do not have a configured accounting period.</p>}
      <div className="flex flex-wrap gap-2">
        <button className={secondary} disabled={exporting} onClick={()=>void exportReport()}>{exporting?"Preparing Excel file…":"Download Excel report"}</button>
        <button className={secondary} onClick={printReport}>Print or save report as PDF</button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      <Grid rows={metrics.map(([key,label])=>({label,value:summary[key]}))} columns={[["Metric",r=>str(r.label)],["Amount",r=>money(r,"value")]]} />
      <Expand title="Income and expenditure by category">
        <Grid rows={categories} columns={[["Category",r=>str(r.category)],["Type",r=>str(r.kind)],["Amount",r=>money(r,"amount")]]} />
      </Expand>
      <Expand title="Cash, bank and reconciliation">
        <Grid rows={accounts} columns={[["Account",r=>str(r.name)],["Balance",r=>money(r,"balance")],["Reconciled through",r=>str(r.reconciled)||"Awaiting reconciliation"]]} />
      </Expand>
    </>}
    {!annual && <Expand title="Overdue invoices and fee reminder drafts">
      <div className="space-y-3">
        <LoadingState {...aged} />
        {aged.data && <><Grid rows={aged.data.slice(0,50)} columns={[
          ["Learner",r=>str(r.learner_name)],["Due",r=>str(r.due)],["Days overdue",r=>str(r.days)],
          ["Outstanding",r=>money(r,"balance")],["Reminder draft",r=><details><summary className="cursor-pointer font-bold">Review text</summary>
            <p className="min-w-48">Hello, our records show {money(r,"balance")} outstanding for {str(r.learner_name)} on invoice #{str(r.number)}, due {str(r.due)}. Please contact {p.school} if you have paid or need to discuss a payment plan.</p>
          </details>],
        ]} empty="No overdue invoices through this period." /><Pager offset={offset} setOffset={setOffset} more={aged.data.length>50} /></>}
      </div>
    </Expand>}
  </section>;
}

export function FinanceAudit({ p }: { p: OperationProps }) {
  const [offset,setOffset] = useState(0);
  const history = useFinanceData<Row[]>(p.call,"ledger","audit",{ period:p.period,offset },p.refresh,Boolean(p.period));
  return <div className="space-y-3">
    <LoadingState {...history} />
    {history.data && <><Grid rows={history.data.slice(0,50)} columns={[
      ["Date",row=>str(row.happened_at).slice(0,10)],["Action",row=>str(row.action)],
      ["Record",row=>str(row.record_id)],["Actor",row=>str(row.actor_id)],["Note",row=>str((row.detail as Row)?.note)],
    ]} empty="No finance changes have been recorded." /><Pager offset={offset} setOffset={setOffset} more={history.data.length>50} /></>}
  </div>;
}

export function FinanceObligations({ p }: { p: OperationProps }) {
  const [offset,setOffset] = useState(0);
  const [selected,setSelected] = useState<Row>();
  const records = useFinanceData<Row[]>(p.call,"report","obligations",{period:p.period,offset},p.refresh);
  return <section className={card}>
    <h2 className="text-xl font-bold">Upcoming bills and commitments</h2>
    <Expand title="Record a school obligation">
      <FinanceForm disabled={p.busy || p.closed} submitLabel="Save obligation" onSubmit={async row=>{
        await p.write("report","addObligation",{...row,period:p.period,amount:toKobo(row.amount)},"School obligation saved.");
      }}>
        <Field label="Description" name="description" placeholder="December rent" maxLength={160} />
        <Field label="Due date" name="due" type="date" />
        <Field label="Amount (₦)" name="amount" type="money" />
      </FinanceForm>
    </Expand>
    <LoadingState {...records} />
    {records.data && <><Grid rows={records.data.slice(0,50)} columns={[
      ["Description",r=>str(r.description)],["Due",r=>str(r.due)],["Amount",r=>money(r,"amount")],["Status",r=>str(r.status)],
      ["Payment",r=>r.status==="open" ? <button className={secondary} disabled={p.closed} onClick={()=>setSelected(r)}>Link paid expense</button> : str(r.reference)],
    ]} empty="No school obligations recorded." /><Pager offset={offset} setOffset={setOffset} more={records.data.length>50} /></>}
    {selected && <FinanceForm key={str(selected.id)} title={"Link expense for "+str(selected.description)} disabled={p.busy || p.closed}
      submitLabel="Mark obligation paid" onSubmit={async row=>{
        await p.write("report","settleObligation",{period:p.period,id:selected.id,reference:row.reference},"Paid expense linked.");
        setSelected(undefined);
      }}>
      <Field label="Recorded expense reference" name="reference" maxLength={160} />
    </FinanceForm>}
  </section>;
}

export function OfficialSnapshot({ p }: { p: OperationProps }) {
  const source = useFinanceData<{ id: string; status: string; snapshot: Row } | null>(p.call,"report","source",{period:p.period},p.refresh);
  if (!source.data) return null;
  const { status,snapshot } = source.data;
  const rows = [["Metric","Amount (NGN)"],["Financial Health status",status],["From",str(snapshot.from)],["Through",str(snapshot.to)],
    ...metrics.map(([key,label])=>[label,money(snapshot,key)])];
  return <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
    <span className="text-sm font-bold">Reconciled source snapshot · {status}</span>
    <button className={secondary} onClick={()=>printFinance("Financial Health source snapshot",p.school,[{title:status,rows}])}>
      Print or save snapshot as PDF
    </button>
  </div>;
}
