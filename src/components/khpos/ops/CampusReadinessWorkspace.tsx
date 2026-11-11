"use client";

import { LoadingScreen } from "@/components/navigation/LoadingScreen";

import { ActionFeedback } from "./ActionFeedback";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { CampusReadiness } from "@/lib/khpos/ops/campus-readiness";

const checks = [
  { code: "opening", title: "Campus opening", guidance: "Gates, access and supervision ready" },
  { code: "sanitation", title: "Cleaning & sanitation", guidance: "Classrooms, toilets and grounds ready" },
  { code: "utilities", title: "Power & water", guidance: "Essential utilities available" },
  { code: "learning", title: "Learning readiness", guidance: "Spaces and materials ready for learning" },
  { code: "closing", title: "Secure closing", guidance: "Rooms, keys and remaining learners accounted for" },
] as const;

export function CampusReadinessWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [data, setData] = useState<CampusReadiness | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (key: string, value: string) => setFields((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (!supabase) { setError("KHP-OS sign-in is temporarily unavailable."); return; }
    let active = true;
    void supabase.auth.getSession().then(async ({ data: session }) => {
      if (!session.session?.access_token) { if (active) setError("Sign in to continue."); return; }
      try {
        const response = await fetch(`/api/khpos/ops/campus-readiness/${organisationId}`, { headers: { Authorization: `Bearer ${session.session.access_token}` }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Campus readiness could not be loaded.");
        if (active) setData(result.readiness);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Campus readiness could not be loaded."); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load school records. Check your connection and retry.");
    });
    return () => { active = false; };
  }, [organisationId, supabase]);
  async function act(mode: string, input: Record<string, unknown>) {
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Sign in to continue.");
      const response = await fetch(`/api/khpos/ops/campus-readiness/${organisationId}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session.access_token}` }, body: JSON.stringify({ mode, ...input }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Campus readiness action failed.");
      setData(result.readiness); setFields({}); setNotice("Campus readiness record saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Campus readiness action failed."); }
    finally { setBusy(false); }
  }
  const input = (key: string, title: string) => <label className="block text-sm font-medium text-slate-700">{title}<input value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950" /></label>;
  const note = (key: string, title: string) => <label className="block text-sm font-medium text-slate-700">{title}<textarea rows={2} value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950" /></label>;
  const button = (title: string, action: () => void, disabled = false) => <button type="button" disabled={busy || disabled} onClick={action} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-800 disabled:opacity-50">{busy ? "Saving…" : title}</button>;
  const exceptions = data?.checks.filter((check) => ["exception", "resolved"].includes(check.status)) || [];

  return <main className="khpos-interface-page mx-auto max-w-7xl space-y-6 px-4 py-6 text-slate-950 sm:px-6 sm:py-8">
      <ActionFeedback busy={Boolean(busy)} error={error ?? ""} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} /><header className="khpos-interface-card space-y-2 p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">School operations</p><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Campus Readiness</h1><p className="mt-2 text-slate-600">Record daily checks. A failed check stays visible until a campus leader resolves it and another leader verifies the result. For a new fault after today’s check, <Link href={`/khpos/${organisationId}/issues`} className="underline">raise an issue</Link>.</p></header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800">{error}</p>}
    {!data && !error && <LoadingScreen />}
    {data && <><p className="rounded-lg bg-slate-100 p-3 text-sm font-semibold">Operating date: {data.operatingDate} · {exceptions.length} unresolved exception{exceptions.length === 1 ? "" : "s"}</p>
      {data.campuses.map((campus) => <section key={campus.id} className="khpos-interface-card space-y-4 p-4 sm:p-6"><h2 className="text-xl font-bold">{campus.name}</h2><div className="grid gap-3 md:grid-cols-2">
        {checks.map((item) => {
          const recorded = data.checks.find((entry) => entry.campusId === campus.id && entry.operatingDate === data.operatingDate && entry.code === item.code);
          const key = `${campus.id}-${item.code}`;
          return <div key={item.code} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-bold">{item.title}</h3><span className={`text-xs font-bold ${recorded?.status === "exception" ? "text-rose-700" : recorded?.status === "resolved" ? "text-amber-700" : "text-slate-600"}`}>{recorded?.status || "Not recorded"}</span></div><p className="text-sm text-slate-600">{item.guidance}</p>
            {!recorded && <details className="group rounded-xl border border-brand-200 bg-white p-3"><summary className="cursor-pointer text-sm font-bold text-brand-700">Record this check <span aria-hidden="true" className="ml-1 group-open:hidden">+</span></summary><div className="mt-3 space-y-3">{note(`${key}-note`, "What did you observe?")}{input(`${key}-evidence`, "Evidence or checklist reference")}{button("Pass", () => void act("record", { campusId: campus.id, code: item.code, result: "passed", note: fields[`${key}-note`], evidenceReference: fields[`${key}-evidence`] }), !fields[`${key}-note`]?.trim() || !fields[`${key}-evidence`]?.trim())} {button("Report exception", () => void act("record", { campusId: campus.id, code: item.code, result: "exception", note: fields[`${key}-note`], evidenceReference: fields[`${key}-evidence`] }), !fields[`${key}-note`]?.trim() || !fields[`${key}-evidence`]?.trim())}</div></details>}
            {recorded && <><p className="text-sm">{recorded.observation} · {recorded.evidenceReference}</p>{recorded.resolutionNote && <p className="text-sm text-slate-600">Resolution: {recorded.resolutionNote} · {recorded.resolutionEvidence}</p>}{recorded.verificationNote && <p className="text-sm text-slate-600">Review: {recorded.verificationNote}</p>}</>}
          </div>;
        })}</div></section>)}
      {exceptions.length > 0 && <section className="space-y-3"><h2 className="text-xl font-bold">Campus checks needing action</h2>{exceptions.map((entry) => {
        const campus = data.campuses.find((item) => item.id === entry.campusId);
        const key = `resolution-${entry.id}`;
        return <div key={entry.id} className="min-w-0 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5"><h3 className="font-bold">{campus?.name} · {entry.operatingDate} · {checks.find((item) => item.code === entry.code)?.title} · {entry.status}</h3><p className="text-sm">{entry.observation}</p>
          {campus?.canManage && entry.status === "exception" && <div className="grid gap-2 md:grid-cols-2">{note(`${key}-note`, "How was it resolved?")}{input(`${key}-evidence`, "Resolution evidence reference")}{button("Submit resolution", () => void act("resolve", { checkId: entry.id, note: fields[`${key}-note`], evidenceReference: fields[`${key}-evidence`] }), !fields[`${key}-note`]?.trim() || !fields[`${key}-evidence`]?.trim())}</div>}
          {campus?.canManage && entry.status === "resolved" && <div className="space-y-2">{note(`${key}-review`, "Independent review finding")}{button("Verify resolution", () => void act("verify", { checkId: entry.id, note: fields[`${key}-review`] }), !fields[`${key}-review`]?.trim())} {button("Return for further work", () => void act("return", { checkId: entry.id, note: fields[`${key}-review`] }), !fields[`${key}-review`]?.trim())}<p className="text-xs text-slate-600">The leader who submitted the resolution cannot verify it.</p></div>}
          <details className="text-sm"><summary className="cursor-pointer font-semibold">History ({entry.events.length})</summary><ol className="mt-2 space-y-1">{entry.events.map((event) => <li key={event.id}>{event.type} · {new Date(event.createdAt).toLocaleString()} · {event.note}</li>)}</ol></details>
        </div>;
      })}</section>}
    </>}
  </main>;
}
