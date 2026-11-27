"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { currency } from "@/lib/khpos/ops/school-finance-shared";

export type Row = Record<string, unknown>;
export type FinanceSurface = "register" | "ledger" | "report" | "oversight";
export type FinanceCall = <T = Row>(surface: FinanceSurface, action: string, input?: Row) => Promise<T>;
export type Option = [string, string];
export type Write = (surface: FinanceSurface, action: string, input: Row, notice?: string) => Promise<Row | null>;
export const selectClass = "min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-950";
export const primary = "min-h-11 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50";
export const secondary = "min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-50";
export const card = "khpos-interface-card min-w-0 space-y-4 p-4 sm:p-6";
export const str = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
export const options = (rows: Row[], label = "name"): Option[] => rows.map(row => [str(row.id), str(row[label])]);
export const money = (row: Row, key: string) => currency(row[key]);

export async function financeFetch<T>(school: string, campus: string | null, surface: FinanceSurface, action: string, input: Row = {}) {
  const supabase = createBrowserSupabaseClient();
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session) throw new Error("Sign in to open School Finance.");
  const response = await fetch("/api/khpos/ops/finance/" + school, {
    method: "POST", cache: "no-store",
    headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ surface, action, campus, input }),
  });
  const body = await response.json() as { result: T; error?: string };
  if (!response.ok) throw new Error(body.error ?? "School Finance could not complete this request.");
  return body.result;
}

export function useFinanceData<T>(call: FinanceCall, surface: FinanceSurface, action: string, input: Row, refresh: number, enabled = true): { loading: boolean; data?: T; error?: string } {
  const inputKey = JSON.stringify(input);
  const requestKey = JSON.stringify([surface,action,inputKey]);
  const [state, setState] = useState<{ key: string; call: FinanceCall; data?: T; error?: string }>();
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void call<T>(surface, action, JSON.parse(inputKey) as Row).then(
      data => { if (current) setState({ key: requestKey, call, data }); },
      error => { if (current) setState({ key: requestKey, call, error: error.message }); },
    );
    return () => { current = false; };
  }, [call,surface,action,inputKey,requestKey,enabled,refresh]);
  if (!enabled) return { loading: false };
  if (state?.key !== requestKey || state?.call !== call) return { loading: true };
  return { ...state, loading: false };
}

export function Field({ label, name, choices, required = true, type = "text", value, placeholder, maxLength = 240 }: {
  label: string; name: string; choices?: Option[]; required?: boolean; type?: string; value?: string; placeholder?: string; maxLength?: number;
}) {
  const labelId = useId();
  return <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-800">
    <span id={labelId}>{label}</span>
    {choices ? <select aria-labelledby={labelId} name={name} required={required} defaultValue={value ?? ""} className={selectClass}>
      <option value="">{required ? "Choose…" : "Optional"}</option>
      {choices.map(([key,title]) => <option key={key} value={key}>{title}</option>)}
    </select> : <input aria-labelledby={labelId} name={name} required={required} type={type === "money" ? "text" : type}
      inputMode={type === "money" ? "decimal" : undefined} defaultValue={value} maxLength={maxLength} placeholder={placeholder} className={selectClass} />}
  </label>;
}

export function FinanceForm({ title, submit, onSubmit, disabled, children, submitLabel = "Save" }: {
  title?: string; submit?: ReactNode; onSubmit: (row: Record<string,string>) => void | Promise<void>;
  disabled: boolean; children: ReactNode; submitLabel?: string;
}) {
  const [error,setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setError("");
    const values = Object.fromEntries(Array.from(new FormData(event.currentTarget), ([key,value]) => [key,String(value)]));
    try { await onSubmit(values); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The action could not be completed."); }
  }
  return <form onSubmit={save} className="space-y-3">
    {title && <h3 className="font-bold text-slate-950">{title}</h3>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    {submit ?? <button disabled={disabled} className={primary}>{submitLabel}</button>}
  </form>;
}

export function Expand({ title, children }: { title: string; children: ReactNode }) {
  return <details className="rounded-xl border border-slate-200 bg-slate-50">
    <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-slate-900">{title}</summary>
    <div className="border-t border-slate-200 p-4">{children}</div>
  </details>;
}

export function Grid({ rows, columns, empty = "No records match this view." }: {
  rows: Row[]; columns: [string,(row: Row) => ReactNode][]; empty?: string;
}) {
  if (!rows.length) return <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">{empty}</p>;
  return <div className="overflow-x-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label="Finance records">
    <table className="w-full text-left text-sm text-slate-900">
      <thead className="bg-slate-100">{<tr>{columns.map(([label]) => <th key={label} scope="col" className="whitespace-nowrap px-3 py-3">{label}</th>)}</tr>}</thead>
      <tbody className="divide-y divide-slate-100">{rows.map((row,i) => <tr key={str(row.id ?? row.number) || i}>
        {columns.map(([label,render]) => <td key={label} className="px-3 py-2 align-middle">{render(row)}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function Pager({ offset, setOffset, more }: { offset: number; setOffset:(n: number) => void; more: boolean }) {
  if (!offset && !more) return null;
  return <nav aria-label="Result pages" className="flex flex-wrap items-center gap-2">
    <button className={secondary} disabled={!offset} onClick={() => setOffset(offset - 50)}>Previous</button>
    <span className="px-2 text-sm text-slate-700">Page {offset / 50 + 1}</span>
    <button className={secondary} disabled={!more} onClick={() => setOffset(offset + 50)}>Next</button>
  </nav>;
}

export function LoadingState({ loading, error }: { loading?: boolean; error?: string }) {
  if (error) return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>;
  if (loading) return <p role="status" className="text-sm text-slate-600">Finance records are being retrieved.</p>;
  return null;
}

export function Search({ label, onSearch }: { label: string; onSearch: (value: string) => void }) {
  return <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
    event.preventDefault();
    onSearch(str(new FormData(event.currentTarget).get("search")).trim());
  }}>
    <Field name="search" label={label} required={false} />
    <button className={secondary}>Search</button>
  </form>;
}
