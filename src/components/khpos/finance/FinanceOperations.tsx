"use client";

import Link from "next/link";
import { useState } from "react";
import { currency, financeCategories, financeDate, financeKinds, toKobo } from "@/lib/khpos/ops/school-finance-shared";
import { Expand, Field, FinanceForm, Grid, LoadingState, Pager, Search, card, money, options, secondary, str, useFinanceData,
  type FinanceCall, type Option, type Row, type Write } from "./FinanceControls";
import { allPages, excel, printFinance } from "./FinanceExports";
import { FinanceOpeningImport } from "./FinanceOpeningImport";
import { FinanceAttachment } from "./FinanceAttachment";
import { classChoices } from "./FinanceLearners";

export type OperationProps = {
  call: FinanceCall; write: Write; refresh: number; busy: boolean; period: string; closed: boolean;
  accounts: Row[]; school: string; schoolId: string; campusId: string; canApprove: boolean; start: string; end: string; reviewThreshold: string;
};
function defaultDate(start: string, end: string) {
  const today = financeDate();
  return today > end ? end : today < start ? start : today;
}
function dateField(p: OperationProps) {
  return <Field label="Accounting date" name="date" type="date" value={defaultDate(p.start,p.end)} />;
}

function Lookup({ call, select, target, refresh }: {
  call: FinanceCall; select: (id: string) => void; target: string; refresh: number;
}) {
  const [query,setQuery] = useState("");
  const found = useFinanceData<Row[]>(call,"register","learners",{ search:query },refresh,Boolean(query));
  return <div className="space-y-2">
    <Search label="Find learner by name or admission number" onSearch={setQuery} />
    <LoadingState {...found} />
    {found.data && <label className="grid gap-1 text-sm font-bold">Learner
      <select className="min-h-11 rounded-xl border border-slate-300 bg-white p-2 text-base" value={target} onChange={event => select(event.target.value)}>
        <option value="">Choose…</option>
        {found.data.slice(0,50).map(row => <option key={str(row.id)} value={str(row.id)}>{str(row.name)} · {str(row.admission)}</option>)}
      </select>
    </label>}
  </div>;
}

const amountField = <Field label="Amount (₦)" name="amount" type="money" placeholder="0.00" />;
const referenceField = <Field label="Unique reference" name="reference" maxLength={160} placeholder="Receipt book or deposit reference" />;

export function PostingForm({ p, kind, invoice, learner, original }: { p: OperationProps; kind: string; invoice?: Row; learner?: string; original?: Row }) {
  const [paymentAmount,setPaymentAmount] = useState("");
  const [epoch,setEpoch] = useState(0);
  const [receipt,setReceipt] = useState("");
  const [printError,setPrintError] = useState("");
  const review = ["credit","openingDebt","discount","scholarship","waiver","refund","reverse"].includes(kind);
  const account = ["payment","income","expense","transfer"].includes(kind);
  const categories = kind === "income" || kind === "expense" ? financeCategories[kind].map((category): Option => [category,category]) : null;
  return <div className="space-y-3"><FinanceForm key={epoch} disabled={p.busy || p.closed || (account && !p.accounts.length) || (kind==="payment" && Boolean(invoice) && Number(invoice?.balance)<=0)}
    submitLabel={review ? "Send for approval" : kind==="payment" ? "Record payment" : "Record transaction"}
    onSubmit={async data => {
      const result = await p.write("ledger","post",{ ...data,period:p.period,kind,invoice:invoice?.id,learner,
        original:original?.id,amount:kind==="reverse" ? str(original?.amount) : toKobo(data.amount) },
      review ? "Sent for School Custodian review." : "Transaction recorded.");
      if (result) {
        setEpoch(n=>n+1);
        if (kind==="payment") { setReceipt(str(result.id)); setPaymentAmount(""); }
      }
    }}>
    {kind==="reverse" ? <p className="text-sm font-bold">Reverse {currency(original?.amount)}</p> : kind==="payment" ?
      <div className="space-y-1">
        <label className="grid gap-1 text-sm font-semibold">Amount (₦)
          <input name="amount" inputMode="decimal" required value={paymentAmount} onChange={event=>setPaymentAmount(event.target.value)}
            placeholder="0.00" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base" />
        </label>
        {invoice && Number(invoice.balance)>0 && <button type="button" className="min-h-10 text-sm font-semibold text-brand-800 underline"
          onClick={()=>setPaymentAmount((Number(invoice.balance)/100).toFixed(2))}>Use outstanding amount ({currency(invoice.balance)})</button>}
      </div> : amountField}
    {account && <Field label={kind==="transfer" ? "From account" : "Cash or bank account"} name="account" choices={options(p.accounts)} value={p.accounts.length===1 ? str(p.accounts[0].id) : ""} />}
    {kind==="transfer" && <Field label="To account" name="destination" choices={options(p.accounts)} />}
    {dateField(p)}
    {kind!=="openingDebt" && referenceField}
    {categories && <Field label="Category" name="category" choices={categories} />}
    {kind==="expense" && <Field label="Department or responsibility area" name="department" required={false} />}
    <Field label={review ? "Reason for this request" : kind==="payment" ? "Notes (optional)" : "Description"} name="note" maxLength={1000} required={review} />
    {kind==="expense" && Number(p.reviewThreshold)>0 && <p className="text-sm text-slate-700">Expenses from {currency(p.reviewThreshold)} require review. Add a description of at least 10 characters.</p>}
  </FinanceForm>
  {receipt && <button className={secondary} onClick={()=>{
    setPrintError("");
    void p.call<Row[]>("ledger","receipt",{ period:p.period,id:receipt }).then(([row])=>{
      if (!row) throw new Error("The receipt is not available yet.");
      printReceipt(row,p.school);
    }).catch(error=>setPrintError(error.message));
  }}>Print or save this receipt as PDF</button>}
  {printError && <p className="text-sm text-rose-800" role="alert">{printError}</p>}
  </div>;
}

function printInvoice(row: Row, school: string) {
  printFinance(row.opening ? "Opening balance #" + str(row.number) : "Fee invoice #" + str(row.number),school,[{ title:str(row.learner_name),rows:[
    ["Admission number",str(row.admission_number)],["Charge",str(row.label)],["Issued",str(row.issued)],
    ["Due",str(row.due)],["Amount",money(row,"amount")],["Outstanding",money(row,"balance")],
  ] }]);
}

export function printReceipt(row: Row, school: string) {
  const refund = row.kind==="refund";
  printFinance((refund ? "Refund record #" : "Fee receipt #") + str(row.number),school,[{
    title:refund ? "Recorded fee refund" : "Recorded fee payment",
    rows:[["Learner",str(row.learner)],["Admission number",str(row.admission_number)],["Recorded date",str(row.posted)],["Reference",str(row.reference)],
      ["Account",str(row.account)],["Invoice",str(row.invoice) || "Unallocated"],
      ["Amount",money(row,"amount")],["Reconciliation",row.reconciled ? "Checked against statement or cash count" : "Awaiting reconciliation"]],
  }]);
}

export function LearnerStatement({ p, learner }: { p: OperationProps; learner: string }) {
  const [offset,setOffset] = useState(0);
  const [error,setError] = useState("");
  const [working,setWorking] = useState(false);
  const statement = useFinanceData<{ credit: number; invoices: Row[]; transactions: Row[] }>(
    p.call,"ledger","statement",{ period:p.period,learner,offset },p.refresh);
  async function exportStatement() {
    setWorking(true);setError("");
    try {
      const invoices: Row[] = [];
      const transactions: Row[] = [];
      let credit = 0;
      for (let offset = 0; offset <= 250000; offset += 50) {
        const page = await p.call<{ credit: number; invoices: Row[]; transactions: Row[] }>("ledger","statement",{ period:p.period,learner,offset });
        credit = page.credit;
        invoices.push(...page.invoices.slice(0,50));transactions.push(...page.transactions.slice(0,50));
        if (page.invoices.length<=50 && page.transactions.length<=50) break;
        if (offset===250000) throw new Error("This statement is too large to print at once.");
      }
      printFinance("Learner fee statement",p.school,[
        { title:str(invoices[0]?.learner_name) || "Learner account",rows:[["Through",p.end],["Available credit",currency(credit)]] },
        { title:"Invoices",rows:[["Number","Charge","Due","Billed","Outstanding"],...invoices.map(row => [
          str(row.number),str(row.label),str(row.due),money(row,"amount"),money(row,"balance"),
        ])] },
        { title:"Transactions",rows:[["Date","Type","Reference","Amount"],...transactions.map(row => [
          str(row.posted),financeKinds[str(row.kind)] ?? "",str(row.reference),money(row,"amount"),
        ])] },
      ]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Statement could not be prepared."); }
    finally { setWorking(false); }
  }
  return <div className="space-y-3">
    <LoadingState {...statement} />
    {statement.data && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Available credit {currency(statement.data.credit)}</p>
        <button className={secondary} disabled={working} onClick={() => void exportStatement()}>Print or save fee statement as PDF</button>
      </div>
      <Grid rows={statement.data.invoices.slice(0,50)} columns={[
        ["Invoice",r=>str(r.number)],["Charge",r=>str(r.label)],["Due",r=>str(r.due)],["Billed",r=>money(r,"amount")],["Outstanding",r=>money(r,"balance")],
      ]} empty="No invoices for this learner through the selected period." />
      <Grid rows={statement.data.transactions.slice(0,50)} columns={[
        ["Date",r=>str(r.posted)],["Type",r=>financeKinds[str(r.kind)]],["Reference",r=>str(r.reference)],["Amount",r=>money(r,"amount")],
      ]} empty="No transactions for this learner through the selected period." />
      <Pager offset={offset} setOffset={setOffset} more={statement.data.invoices.length>50 || statement.data.transactions.length>50} />
    </>}
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
  </div>;
}

function collectionLink(p: OperationProps, learner: string, invoice = "") {
  return `/khpos/${p.schoolId}/financial-health/fee-collection?` +
    new URLSearchParams({ campus:p.campusId, period:p.period, learner, invoice });
}

export function FinanceBilling({ p, classes, initialLearner, reload }: {
  p: OperationProps; classes: Row[]; initialLearner: string; reload: () => void;
}) {
  const [learner,setLearner] = useState(initialLearner);
  const [invoice,setInvoice] = useState<Row>();
  const [adjustment,setAdjustment] = useState("discount");
  const [search,setSearch] = useState("");
  const [offset,setOffset] = useState(0);
  const [scheduleOffset,setScheduleOffset] = useState(0);
  const [running,setRunning] = useState(false);
  const [progress,setProgress] = useState("");
  const [instalments,setInstalments] = useState(0);
  const [billingDate,setBillingDate] = useState(defaultDate(p.start,p.end));
  const [bulkError,setBulkError] = useState("");
  const result = useFinanceData<Row[]>(p.call,"ledger","invoices",{ period:p.period,search,offset },p.refresh);
  const schedules = useFinanceData<Row[]>(p.call,"ledger","schedules",{ period:p.period,offset:scheduleOffset },p.refresh);
  const locked = p.busy || running || p.closed;

  async function bulk(schedule: string, specificLearner?: string) {
    setRunning(true);setProgress("");setBulkError("");
    let cursor: string | null = null;
    let created = 0;
    try {
      do {
        const page: Row = await p.call("ledger","billSchedule",{ key:crypto.randomUUID(),period:p.period,schedule,cursor,date:billingDate,learner:specificLearner });
        created += Number(page.created);
        cursor = typeof page.cursor==="string" && !specificLearner ? page.cursor : null;
        setProgress(created + " invoices created.");
      } while (cursor);
      // Refresh the returned lists without changing accounting state.
      reload();
    } catch (cause) { setBulkError(cause instanceof Error ? cause.message : "Billing stopped. Run it again to continue safely."); }
    finally { setRunning(false); }
  }

  return <section className={card}>
    <h2 className="text-xl font-bold">Fees and invoices</h2>
    {p.closed && <p className="text-sm text-slate-700">This period is closed. View or export its records below.</p>}
    <Expand title="Fee schedules and bulk billing">
      <div className="space-y-4">
        <FinanceForm title="Create or revise a class fee" disabled={locked || !classes.length} submitLabel="Save fee schedule" onSubmit={async row => {
          const plan = Array.from({ length:instalments },(_,i) => ({ amount:toKobo(row["amount"+i]),due:row["due"+i] }));
          await p.write("ledger","saveSchedule",{ ...row,period:p.period,amount:toKobo(row.amount),annual:row.annual==="true",instalments:plan });
        }}>
          <Field label="Class and arm" name="class" choices={classChoices(classes)} />
          <Field label="Fee name" name="label" placeholder="Tuition" maxLength={140} />
          {amountField}
          <Field label="Due date" name="due" type="date" value={p.end} />
          <Field label="Fee category" name="feeCategory" required={false} placeholder="Use the learner’s fee category" />
          <label className="flex items-center gap-2 text-sm"><input name="annual" type="checkbox" value="true" /> Bill once per academic session</label>
          <label className="grid gap-1 text-sm font-semibold">Scheduled instalments
            <select className={secondary} value={instalments} onChange={event => setInstalments(Number(event.target.value))}>
              <option value={0}>Single bill</option>{Array.from({length:11},(_,i) => <option key={i} value={i+2}>{i+2} instalments</option>)}
            </select>
          </label>
          {Array.from({length:instalments},(_,i) => [
            <Field key={"amount"+i} label={"Instalment " + (i+1) + " amount (₦)"} name={"amount"+i} type="money" />,
            <Field key={"due"+i} label={"Instalment " + (i+1) + " due date"} name={"due"+i} type="date" />,
          ])}
        </FinanceForm>
        <label className="grid max-w-xs gap-1 text-sm font-semibold">Bulk invoice issue date
          <input type="date" className={secondary} value={billingDate} onChange={event => setBillingDate(event.target.value)} />
        </label>
        <LoadingState {...schedules} />
        {schedules.data && <><Grid rows={schedules.data.slice(0,50)} columns={[
          ["Fee",row=>str(row.label)],["Class",row=>[row.class_label,row.arm].map(str).filter(Boolean).join(" · ")],
          ["Category",row=>str(row.fee_category) || "All learners"],["Version",row=>str(row.version)],["Amount",row=>money(row,"amount")],
          ["Bill",row=><button className={secondary} disabled={locked || !billingDate} onClick={() => {
            if (window.confirm("Issue this charge for eligible learners in this class and period?")) void bulk(str(row.id));
          }}>Bill eligible learners</button>],
        ]} /><Pager offset={scheduleOffset} setOffset={setScheduleOffset} more={schedules.data.length>50} /></>}
        {progress && <p role="status" className="text-sm">{progress}</p>}
        {bulkError && <p role="alert" className="text-sm text-rose-800">{bulkError}</p>}
      </div>
    </Expand>
    <details open={Boolean(initialLearner) || undefined} className="rounded-xl border border-slate-200 bg-slate-50">
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold">Individual charges, fee statements and opening balances</summary>
      <div className="border-t border-slate-200 p-4">
      <div className="space-y-3">
        <Lookup call={p.call} target={learner} select={setLearner} refresh={p.refresh} />
        {learner && <>
          <LearnerStatement key={learner} p={p} learner={learner} />
          <Expand title="Issue an individual invoice">
            <FinanceForm key={learner} disabled={locked} submitLabel="Issue invoice" onSubmit={async row => {
              await p.write("ledger","billLearner",{ ...row,period:p.period,learner,amount:toKobo(row.amount) },"Invoice issued.");
            }}>
              <Field label="Charge" name="label" />{amountField}
              {dateField(p)}<Field label="Due date" name="due" type="date" value={p.end} />{referenceField}
            </FinanceForm>
          </Expand>
          <Link className={secondary} href={collectionLink(p,learner)}>Open fee collection</Link>
          <Expand title="Request a historical opening fee balance"><PostingForm key={learner} p={p} kind="openingDebt" learner={learner} /></Expand>
          <Expand title="Request a historical opening credit"><PostingForm key={learner} p={p} kind="credit" learner={learner} /></Expand>
        </>}
      </div>
      </div>
    </details>
    <Expand title="Import historical opening balances"><FinanceOpeningImport p={p} reload={reload} /></Expand>
    <Search label="Search invoices by name, admission number or charge" onSearch={query => {setSearch(query);setOffset(0);}} />
    {invoice && <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">Invoice #{str(invoice.number)} · {str(invoice.learner_name)}</h3>
        <button className={secondary} onClick={() => setInvoice(undefined)}>Close</button>
      </div>
      <Expand title="Apply credit or financial assistance">
        <div className="space-y-3">
          <label className="grid max-w-xs gap-1 text-sm font-semibold">Adjustment type
            <select className={secondary} value={adjustment} onChange={event => setAdjustment(event.target.value)}>
              {["discount","scholarship","waiver","apply"].map(kind => <option key={kind} value={kind}>{financeKinds[kind]}</option>)}
            </select>
          </label>
          <PostingForm key={str(invoice.id)+adjustment} p={p} kind={adjustment} invoice={invoice} />
        </div>
      </Expand>
    </div>}
    <LoadingState {...result} />
    {result.data && <><Grid rows={result.data.slice(0,50)} columns={[
      ["Invoice",row=><strong>#{str(row.number)}</strong>],["Learner",row=>str(row.learner_name)],["Charge",row=>str(row.label)],
      ["Due",row=>str(row.due)],["Billed",row=>money(row,"amount")],["Outstanding",row=>money(row,"balance")],
      ["Actions",row=><div className="flex flex-wrap gap-2">
        <Link className={secondary} href={collectionLink(p,str(row.learner_id),str(row.id))}>Collect payment</Link>
        <button className={secondary} disabled={locked} onClick={() => setInvoice(row)}>Adjust balance</button>
        <button className={secondary} onClick={() => printInvoice(row,p.school)}>Print invoice</button>
      </div>],
    ]} empty="No invoices yet. Set up a class fee or issue an individual invoice." />
      <Pager offset={offset} setOffset={setOffset} more={result.data.length>50} />
    </>}
  </section>;
}

function Approvals({ p }: { p: OperationProps }) {
  const [offset,setOffset] = useState(0);
  const [selected,setSelected] = useState<Row>();
  const result = useFinanceData<Row[]>(p.call,"ledger","requests",{ period:p.period,offset },p.refresh);
  return <div className="space-y-3">
    <LoadingState {...result} />
    {result.data && <><Grid rows={result.data.slice(0,50)} columns={[
      ["Request",row=>financeKinds[str(row.kind)]],["Amount",row=>currency((row.payload as Row).amount)],
      ["Reason",row=>str((row.payload as Row).note)],["Reference",row=>str((row.payload as Row).reference)],["Status",row=>str(row.status)],
      ["Review",row=>p.canApprove && row.status==="pending" && <button className={secondary} onClick={() => setSelected(row)}>Review</button>],
    ]} empty="There are no adjustment requests in this period." />
      <Pager offset={offset} setOffset={setOffset} more={result.data.length>50} />
    </>}
    {selected && <FinanceForm key={str(selected.id)} title={financeKinds[str(selected.kind)]+" · "+currency((selected.payload as Row).amount)}
      disabled={p.busy} submitLabel="Submit review" onSubmit={async row => {
        const result = await p.write("ledger",row.decision,{ period:p.period,id:selected.id,note:row.note },"Request reviewed.");
        if (result) setSelected(undefined);
      }}>
      <Field label="Decision" name="decision" choices={[["approveRequest","Approve and post"],["returnRequest","Return request"]]} />
      <Field label="Review note" name="note" maxLength={1000} />
    </FinanceForm>}
  </div>;
}

export function FinanceTransactions({ p }: { p: OperationProps }) {
  const [kind,setKind] = useState("expense");
  const [search,setSearch] = useState("");
  const [offset,setOffset] = useState(0);
  const [original,setOriginal] = useState<Row>();
  const [includeHistory,setIncludeHistory] = useState(false);
  const [exportError,setExportError] = useState("");
  const entries = useFinanceData<Row[]>(p.call,"ledger","entries",{ period:p.period,search,offset,includeHistory },p.refresh);
  return <section className={card}>
    <h2 className="text-xl font-bold">Income and expenses</h2>
    <Expand title="Record income, an expense or a transfer">
      <div className="space-y-3">
        <label className="grid max-w-xs gap-1 text-sm font-semibold">Transaction type
          <select className={secondary} value={kind} onChange={event => setKind(event.target.value)}>
            {["expense","income","transfer"].map(type=><option key={type} value={type}>{financeKinds[type]}</option>)}
          </select>
        </label>
        <PostingForm key={kind} p={p} kind={kind} />
      </div>
    </Expand>
    <div id="approvals" className="scroll-mt-24"><Expand title="Adjustment approvals"><Approvals p={p} /></Expand></div>
    {original && <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2"><h3 className="font-bold">Correct {str(original.reference)}</h3>
        <button className={secondary} onClick={() => setOriginal(undefined)}>Cancel</button></div>
      <PostingForm key={str(original.id)} p={p} kind={original.kind==="payment" ? "refund" : "reverse"} original={original} />
    </div>}
    <div className="flex flex-wrap items-end justify-between gap-2">
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={includeHistory}
        onChange={event=>{setIncludeHistory(event.target.checked);setOffset(0);}} /> Include earlier periods</label>
      <Search label="Search transaction history" onSearch={term=>{setSearch(term);setOffset(0);}} />
      <button className={secondary} onClick={() => {
        setExportError("");
        void allPages(offset => p.call<Row[]>("ledger","entries",{period:p.period,search,offset,includeHistory})).then(rows => excel("transaction-history",[
          { title:"Transactions",rows:[["Date","Reference","Type","Category","Account","Amount (kobo)","Status"],...rows.map(r=>[
            str(r.posted),str(r.reference),financeKinds[str(r.kind)] ?? "",str(r.category),str(r.account),str(r.amount),
            r.account ? (r.reconciled ? "Reconciled" : "Recorded") : "Non-cash",
          ])] },
        ])).catch(error => setExportError(error.message));
      }}>Export transactions</button>
    </div>
    {exportError && <p role="alert" className="text-sm text-rose-800">{exportError}</p>}
    <LoadingState {...entries} />
    {entries.data && <><Grid rows={entries.data.slice(0,50)} columns={[
      ["Date",r=>str(r.posted)],["Reference",r=>str(r.reference)],["Type",r=>financeKinds[str(r.kind)]],
      ["Account",r=>[r.account,r.destination].map(str).filter(Boolean).join(" → ")],
      ["Amount",r=>money(r,"amount")],["Status",r=>r.account ? (r.reconciled ? "Reconciled" : "Recorded") : "Non-cash"],
      ["Evidence",r=><FinanceAttachment school={p.schoolId} campus={p.campusId} entry={str(r.id)} />],
      ["Actions",r=><div className="flex gap-2">
        {["payment","refund"].includes(str(r.kind)) && <button className={secondary} onClick={() => printReceipt(r,p.school)}>Print receipt</button>}
        {["payment","income","expense","transfer","discount","scholarship","waiver","apply"].includes(str(r.kind)) && <button className={secondary} disabled={p.closed || p.busy}
          onClick={() => setOriginal(r)}>Request {r.kind==="payment" ? "refund" : "reversal"}</button>}
      </div>],
    ]} /><Pager offset={offset} setOffset={setOffset} more={entries.data.length>50} /></>}
  </section>;
}

export function FinanceAccounts({ p }: { p: OperationProps }) {
  const [offset,setOffset] = useState(0);
  const reconciliation = useFinanceData<Row[]>(p.call,"ledger","reconciliations",{ period:p.period,offset },p.refresh,Boolean(p.period));
  return <section className={card}>
    <h2 className="text-xl font-bold">Cash and bank accounts</h2>
    <Grid rows={p.accounts} columns={[
      ["Account",r=>str(r.name)],["Type",r=>str(r.kind)],["Balance as of today",r=>money(r,"balance")],
      ["Reconciled through",r=>str(r.reconciled) || "Awaiting reconciliation"],
    ]} empty="Add a cash or bank account to start recording money received or paid." />
    <Expand title="Add a cash or bank account">
      <FinanceForm disabled={p.busy} submitLabel="Add account" onSubmit={async row => {
        await p.write("ledger","addAccount",{ ...row,opening:toKobo(row.opening || "0",true) });
      }}>
        <Field label="Account name" name="name" placeholder="Office cash" />
        <Field label="Account type" name="kind" choices={[["cash","Cash"],["bank","Bank"]]} />
        <Field label="Opening date" name="date" type="date" value={p.start || financeDate()} />
        <Field label="Opening balance (₦)" name="opening" type="money" required={false} placeholder="0.00" />
      </FinanceForm>
    </Expand>
    {p.period && <>
      <Expand title="Reconcile a statement or cash count">
        <FinanceForm disabled={p.busy || p.closed || !p.accounts.length} submitLabel="Save reconciliation" onSubmit={async row => {
          await p.write("ledger","reconcile",{ ...row,period:p.period,balance:toKobo(row.balance,true),confirmed:row.confirmed==="true" },"Reconciliation saved.");
        }}>
          <Field label="Account" name="account" choices={options(p.accounts)} />{dateField(p)}
          <Field label="Statement or cash count balance (₦)" name="balance" type="money" />{referenceField}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" required name="confirmed" value="true" />
            I matched every entry through this date to the statement or cash count.
          </label>
        </FinanceForm>
      </Expand>
      <LoadingState {...reconciliation} />
      {reconciliation.data && <><Grid rows={reconciliation.data.slice(0,50)} columns={[
        ["Account",r=>str(r.account)],["Through",r=>str(r.through_date)],["Balance",r=>money(r,"statement_balance")],["Reference",r=>str(r.reference)],
      ]} empty="No reconciliations recorded for this period." />
        <Pager offset={offset} setOffset={setOffset} more={reconciliation.data.length>50} />
      </>}
    </>}
  </section>;
}

export { Approvals };
