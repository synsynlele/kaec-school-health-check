"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { BarChart3, BookOpen, CircleDollarSign, ClipboardList, LayoutDashboard, ReceiptText, Settings2 } from "lucide-react";
import { currency, toKobo } from "@/lib/khpos/ops/school-finance-shared";
import { SchoolFinancialHealthWorkspace } from "@/components/khpos/ops/SchoolFinancialHealthWorkspace";
import { FinanceOversight } from "./FinanceOversight";
import { FinanceCollection } from "./FinanceCollection";
import { FinanceLearners } from "./FinanceLearners";
import { Approvals, FinanceAccounts, FinanceBilling, FinanceTransactions, type OperationProps } from "./FinanceOperations";
import { FinanceAudit, FinanceBudgets, FinanceObligations, FinanceOverview, FinanceReports, OfficialSnapshot } from "./FinanceReporting";
import { Expand, Field, FinanceForm, LoadingState, card, financeFetch, primary, secondary, selectClass, str, useFinanceData,
  type FinanceCall, type FinanceSurface, type Row, type Write } from "./FinanceControls";

const tabs = [
  ["Overview",LayoutDashboard],["Learners",BookOpen],["Billing",ReceiptText],["Income & Expenses",CircleDollarSign],
  ["Budgets",ClipboardList],["Reports & Financial Health",BarChart3],["Settings",Settings2],
] as const;

type Context = { campuses: { id: string; name: string; canApprove: boolean; canManage?: boolean }[]; school: string; schoolWide: boolean };
type Catalog = { classes: Row[]; terms: Row[] };

export function SchoolFinanceWorkspace({ organisationId, collection }: { organisationId: string; collection?: { campus: string; period: string; learner: string; invoice: string } }) {
  const [campusId,setCampus] = useState(collection?.campus ?? "");
  const [termId,setTerm] = useState("");
  const [useLinkedTerm,setUseLinkedTerm] = useState(true);
  const [tab,setTab] = useState<string>(() => typeof window!=="undefined" && (window.location.hash==="#health" || window.location.hash==="#approvals") ? (window.location.hash==="#health" ? "Reports & Financial Health" : "Income & Expenses") : "Overview");
  const [learner,setLearner] = useState("");
  const [refresh,setRefresh] = useState(0);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");
  const [statementId,setStatementId] = useState("");
  const [legacyView,setLegacyView] = useState(false);
  const locked = useRef(false);
  const retry = useRef<Record<string,string>>({});
  const contextCall = useCallback<FinanceCall>((surface,action,input)=>financeFetch(organisationId,null,surface,action,input),[organisationId]);
  const context = useFinanceData<Context>(contextCall,"register","context",{},0);
  const campus = context.data?.campuses.find(item=>item.id===campusId) ?? context.data?.campuses[0];
  const campusKey = campus?.id ?? "";
  const oversightOnly = campus?.canManage === false;
  const call = useCallback<FinanceCall>((surface,action,input)=>financeFetch(organisationId,campusKey || null,surface,action,input),[organisationId,campusKey]);
  const catalog = useFinanceData<Catalog>(call,"register","catalog",{},0,Boolean(campusKey) && !oversightOnly);
  const terms = useFinanceData<Row[]>(call,"ledger","periods",{},refresh,Boolean(campusKey) && !oversightOnly);
  const accounts = useFinanceData<Row[]>(call,"ledger","accounts",{},refresh,Boolean(campusKey) && !oversightOnly);
  const controls = useFinanceData<Row>(call,"ledger","controls",{},refresh,Boolean(campusKey) && !oversightOnly);
  const term = terms.data?.find(item=>item.term===termId) ?? terms.data?.find(item=>useLinkedTerm && Boolean(collection?.period) && item.id===collection?.period) ?? terms.data?.find(item=>item.status==="active") ?? terms.data?.[0];
  const termKey = str(term?.term);
  const period = str(term?.id);
  const school = context.data?.school ?? "";
  const closed = Boolean(term?.closed);
  const canApprove = Boolean(campus?.canApprove);
  const start = str(term?.starts);
  const end = str(term?.ends);

  const reload = useCallback(() => setRefresh(n=>n+1),[]);
  const write = useCallback<Write>(async (surface: FinanceSurface,action,input,message="Saved.") => {
    if (locked.current) return null;
    locked.current=true;setBusy(true);setError("");setNotice("");
    const envelope = JSON.stringify([campusKey,surface,action,input]);
    const key = retry.current[envelope] ?? crypto.randomUUID();
    retry.current[envelope]=key;
    try {
      const result = await call(surface,action,{ ...input,key });
      delete retry.current[envelope];
      setNotice(result?.pending ? "Sent for School Custodian review." : message);reload();
      return result;
    } catch(cause) {
      const problem = cause instanceof Error ? cause.message : "The action could not be completed.";
      setError(problem);
      throw new Error(problem);
    } finally { locked.current=false;setBusy(false); }
  },[call,campusKey,reload]);
  const p: OperationProps = {
    call,write,refresh,busy,period,closed,accounts:accounts.data??[],school,schoolId:organisationId,campusId:campusKey,
    canApprove,start,end,reviewThreshold:str(controls.data?.expenseThreshold),
  };

  function changeTab(value: string) {
    setTab(value);setError("");setNotice("");
  }
  async function openPeriod() {
    try { await write("ledger","openPeriod",{ term:termKey },"Accounting period opened."); }
    catch { /* Error is shown in the workspace. */ }
  }
  async function prepare() {
    try {
      const result = await write("report","prepareStatement",{ period },"Reconciled figures prepared as a Financial Health draft.");
      if (result?.id) setStatementId(str(result.id));
    } catch { /* Error is shown in the workspace. */ }
  }

  const financeUrl = `/khpos/${organisationId}/financial-health`;

  return <main className="khpos-interface-page mx-auto max-w-7xl space-y-4 px-4 py-5 pb-24 text-slate-950 sm:px-6">
    <header className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 sm:p-7">
      {school && <p className="text-sm font-semibold text-emerald-800">{school}</p>}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{collection ? "Fee Collection" : "School Finance"}</h1>
        {campus && !oversightOnly && (collection
          ? <Link className={secondary+" inline-flex items-center"} href={financeUrl}>Back to School Finance</Link>
          : <Link className={primary+" inline-flex items-center gap-2"} href={financeUrl+"/fee-collection?"+new URLSearchParams({campus:campusKey,period})}>
              <ReceiptText className="size-4 shrink-0" aria-hidden="true" /> Fee Collection
            </Link>)}
      </div>
      {campus && <div className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold">Campus
          <select className={selectClass} disabled={busy} value={campusKey} onChange={event=>{
            setUseLinkedTerm(false);setCampus(event.target.value);setTerm("");setLearner("");setStatementId("");setNotice("");setError("");
          }}>{context.data?.campuses.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
        </label>
        {!oversightOnly && <label className="grid gap-1 text-sm font-bold">Academic term
          <select className={selectClass} disabled={busy || !terms.data?.length} value={termKey} onChange={event=>{
            setUseLinkedTerm(false);setTerm(event.target.value);setLearner("");setStatementId("");setNotice("");setError("");
          }}>
            {!terms.data?.length && <option value="">Choose an academic term</option>}
            {terms.data?.map(item=><option key={str(item.term)} value={str(item.term)}>{str(item.session)} · {str(item.name)}{item.closed?" (closed)":""}</option>)}
          </select>
        </label>}
      </div>}
    </header>
    <LoadingState {...context} />
    {context.error && !legacyView && <button className={secondary} onClick={()=>setLegacyView(true)}>Open existing Financial Health statements</button>}
    {context.error && legacyView && <SchoolFinancialHealthWorkspace organisationId={organisationId} embedded />}
    {campus && oversightOnly && <FinanceOversight key={campusKey} call={call} />}
    {campus && !oversightOnly && <>
      {!collection && <nav aria-label="School Finance sections" className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3 xl:grid-cols-7">
        {tabs.map(([name,Icon])=><button key={name} type="button" aria-current={tab===name?"page":undefined} disabled={busy}
          onClick={()=>changeTab(name)}
          className={"flex min-h-12 min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold leading-snug "+
            (tab===name ? "border-emerald-800 bg-emerald-800 text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100")}>
          <Icon aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 break-words">{name==="Reports & Financial Health" ? "Reports" : name}</span>
        </button>)}
      </nav>}
      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-950" role="status">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-900" role="alert">{error}</p>}
      {terms.loading || terms.error ? <LoadingState {...terms} /> : <>
        {!period && tab!=="Settings" && <section className={card}>
          <h2 className="text-lg font-bold">{term ? "Open this accounting period" : "Set up the academic calendar"}</h2>
          <p className="text-sm text-slate-700">{term ? "Open this term’s accounting period to start billing and recording transactions." :
            "Create an academic term in Academic Delivery or the school calendar, then return to Finance."}</p>
          {term && <button className={primary} disabled={busy} onClick={()=>void openPeriod()}>Open accounting period</button>}
        </section>}
        {collection && period && <>
          <LoadingState {...catalog} />
          {catalog.data && <FinanceCollection key={campusKey+period} p={p} classes={catalog.data.classes}
            initialLearner={campusKey===collection.campus && period===collection.period ? collection.learner : ""}
            initialInvoice={campusKey===collection.campus && period===collection.period ? collection.invoice : ""} />}
        </>}
        {!collection && <>
        {tab==="Learners" && <div key={campusKey+termKey} className="space-y-4">
          <LoadingState {...catalog} />
          {catalog.data && <FinanceLearners call={call} write={write} refresh={refresh} busy={busy} classes={catalog.data.classes}
            terms={catalog.data.terms} term={termKey} school={organisationId} campus={campusKey}
            campuses={context.data?.campuses.map(item=>[item.id,item.name])??[]} onImported={reload} onStatement={id=>{
              setLearner(id);
              changeTab("Billing");
            }} />}

        </div>}
        {tab==="Billing" && period && <FinanceBilling key={period+learner} p={p} classes={catalog.data?.classes??[]} initialLearner={learner} reload={reload} />}
        {tab==="Overview" && period && <FinanceOverview key={period} p={p} open={changeTab} />}
        {tab==="Income & Expenses" && period && <FinanceTransactions key={period} p={p} />}
        {tab==="Budgets" && period && <div key={period} className="space-y-4"><FinanceBudgets p={p} /><FinanceObligations p={p} /></div>}
        {tab==="Reports & Financial Health" && <>
          {period && <FinanceReports key={period} p={p} />}
          <section className={card}>
            <h2 className="text-xl font-bold">Official School Financial Health</h2>
            {context.data?.schoolWide || context.data?.campuses.length===1 ? <>
              {period && context.data?.schoolWide && <div className="flex flex-wrap items-center gap-3">
                <button className={primary} disabled={busy || !closed} onClick={()=>void prepare()}>Prepare reconciled statement</button>
                <p className="text-sm text-slate-700">Close the same dates at each campus and reconcile school accounts through period end.</p>
              </div>}
              {period && context.data?.schoolWide && <OfficialSnapshot p={p} />}
              <SchoolFinancialHealthWorkspace onChanged={reload} key={statementId} organisationId={organisationId} embedded initialId={statementId} />
            </> : <p className="text-sm text-slate-700">A school-wide finance appointment is required to open the official statement.</p>}
          </section>
        </>}
        {tab==="Settings" && <>
          <LoadingState {...accounts} />
          <FinanceAccounts key={period||campusKey} p={p} />
          {context.data?.schoolWide && canApprove && <section className={card}>
            <h2 className="text-xl font-bold">School-wide expense approval</h2>
            <p className="text-sm text-slate-700">{Number(controls.data?.expenseThreshold)>0
              ? "Expenses of "+currency(controls.data?.expenseThreshold)+" and above require School Custodian approval."
              : "Expenses have no amount-based review threshold. Adjustments still require approval."}</p>
            <FinanceForm disabled={busy} submitLabel="Save approval threshold" onSubmit={async row=>{
              await write("ledger","setThreshold",{amount:toKobo(row.amount,true)},"Approval threshold saved.");
            }}><Field label="Review expenses at or above (₦)" name="amount" type="money" placeholder="0 disables the threshold" /></FinanceForm>
          </section>}
          {term && <section className={card}>
            <h2 className="text-xl font-bold">Accounting period</h2>
            <p className="text-sm text-slate-700">{start} to {end} · {period ? (closed?"Closed":"Open") : "Awaiting setup"}</p>
            {!period && <button className={primary} disabled={busy} onClick={()=>void openPeriod()}>Open accounting period</button>}
            {period && canApprove && <FinanceForm disabled={busy} submitLabel={closed?"Reopen period":"Close period"} onSubmit={async row => {
              if (window.confirm(closed?"Reopen this accounting period?":"Close this accounting period and lock new entries?"))
                await write("ledger",closed?"reopenPeriod":"closePeriod",{ period,note:row.note });
            }}><Field name="note" label="Reason for changing the period status" maxLength={1000} /></FinanceForm>}
            {period && <Expand title="Finance audit history"><FinanceAudit p={p} /></Expand>}
            {period && <Expand title="Review adjustment approvals"><Approvals p={p} /></Expand>}
          </section>}
        </>}
        </>}
      </>}
    </>}
  </main>;
}
