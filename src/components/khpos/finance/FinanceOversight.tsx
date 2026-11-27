"use client";

import { useState } from "react";
import { currency } from "@/lib/khpos/ops/school-finance-shared";
import { LoadingState, card, selectClass, str, useFinanceData, type FinanceCall, type Row } from "./FinanceControls";

export function FinanceOversight({ call }: { call: FinanceCall }) {
  const [chosenPeriod, setChosenPeriod] = useState("");
  const periods = useFinanceData<Row[]>(call, "oversight", "periods", {}, 0);
  const period = periods.data?.find(row => row.id === chosenPeriod) ??
    periods.data?.find(row => row.status === "active") ?? periods.data?.[0];
  const periodId = str(period?.id);
  const summary = useFinanceData<Row>(call, "oversight", "summary", { period: periodId }, 0, Boolean(periodId));
  const report = summary.data;

  return <section className={card} aria-label="Campus finance overview">
    <div>
      <h2 className="text-xl font-bold">Campus finance overview</h2>
      <p className="text-sm text-slate-600">Read-only figures from the campus ledger.</p>
    </div>
    <LoadingState {...periods} />
    {periods.data?.length === 0 && <p className="text-sm text-slate-700">Finance/Admin has yet to open an accounting period for this campus.</p>}
    {period && <label className="grid max-w-md gap-1 text-sm font-bold">
      Accounting period
      <select value={periodId} className={selectClass} onChange={event => setChosenPeriod(event.target.value)}>
        {periods.data?.map(row => <option key={str(row.id)} value={str(row.id)}>
          {str(row.session)} · {str(row.name)}{row.closed ? " (closed)" : ""}
        </option>)}
      </select>
    </label>}
    <LoadingState {...summary} />
    {report?.future ? <p className="text-sm text-slate-700">This accounting period has yet to start.</p> : report && <>
      <p className="text-sm text-slate-600">Period activity from {str(report.from)} through {str(report.through)}. Outstanding and overdue fees are campus balances as of the end of that range.</p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Fees billed", report.invoiced], ["Fees collected", report.feeReceipts],
          ["Outstanding fees", report.balance], ["Overdue fees", report.overdue],
          ["Other income", report.otherIncome], ["Expenses", report.expenses],
          ["Planned budget", report.budget],
          ["Budget remaining", Number(report.budget) - Number(report.expenses)],
        ].map(([label, value]) => <div key={String(label)} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-sm text-slate-700">{String(label)}</dt>
          <dd className="mt-1 break-words text-lg font-bold tabular-nums">
            {label === "Budget remaining" && Number(report.budget) === 0 ? "No budget set" : currency(value)}
          </dd>
        </div>)}
      </dl>
    </>}
  </section>;
}
