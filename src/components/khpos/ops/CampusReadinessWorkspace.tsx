"use client";

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
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (key: string, value: string) => setFields((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data: session }) => {
      if (!session.session?.access_token) { if (active) setError("Sign in to continue."); return; }
      try {
        const response = await fetch(`/api/khpos/ops/campus-readiness/${organisationId}`, { headers: { Authorization: `Bearer ${session.session.access_token}` }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Campus readiness could not be loaded.");
        if (active) setData(result.readiness);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Campus readiness could not be loaded."); }
    });
    return () => { active = false; };
  }, [organisationId, supabase]);
  async function act(mode: string, input: Record<string, unknown>) {
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Sign in to continue.");
      const response = await fetch(`/api/khpos/ops/campus-readiness/${organisationId}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session.access_token}` }, body: JSON.stringify({ mode, ...input }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Campus readiness action failed.");
      setData(result.readiness); setFields({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Campus readiness action failed."); }
    finally { setBusy(false); }
  }
  const input = (key: string, title: string) => <label className="block text-sm font-medium text-slate-700">{title}<input value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" /></label>;
  const note = (key: string, title: string) => <label className="block text-sm font-medium text-slate-700">{title}<textarea rows={2} value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" /></label>;
  const button = (title: string, action: () => void, disabled = false) => <button type="button" disabled={busy || disabled} onClick={action} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : title}</button>;
  const exceptions = data?.checks.filter((check) => ["exception", "resolved"].includes(check.status)) || [];

  return <main className="mx-auto max-w-6xl space-y-6 p-5 text-slate-900"><header><h1 className="text-3xl font-bold">Campus Readiness</h1><p className="mt-2 text-slate-600">Record daily checks. A failed check stays visible until a campus leader resolves it and another leader verifies the result. For a new fault after today’s check, <Link href={`/khpos/${organisationId}/issues`} className="underline">raise an issue</Link>.</p></header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800">{error}</p>}
    {!data && !error && <p>Loading campus readiness…</p>}
    {data && <><p className="rounded-lg bg-slate-100 p-3 text-sm font-semibold">Operating date: {data.operatingDate} · {exceptions.length} unresolved exception{exceptions.length === 1 ? "" : "s"}</p>
      {data.campuses.map((campus) => <section key={campus.id} className="space-y-4 rounded-xl border border-slate-200 p-4"><h2 className="text-xl font-bold">{campus.name}</h2><div className="grid gap-3 md:grid-cols-2">
        {checks.map((item) => {
          const recorded = data.checks.find((entry) => entry.campusId === campus.id && entry.operatingDate === data.operatingDate && entry.code === item.code);
          const key = `${campus.id}-${item.code}`;
          return <div key={item.code} className="space-y-2 rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><h3 className="font-bold">{item.title}</h3><span className={`text-xs font-bold ${recorded?.status === "exception" ? "text-rose-700" : recorded?.status === "resolved" ? "text-amber-700" : "text-slate-600"}`}>{recorded?.status || "Not recorded"}</span></div><p className="text-sm text-slate-600">{item.guidance}</p>
            {!recorded && <>{note(`${key}-note`, "What did you observe?")}{input(`${key}-evidence`, "Evidence or checklist reference")}{button("Pass", () => void act("record", { campusId: campus.id, code: item.code, result: "passed", note: fields[`${key}-note`], evidenceReference: fields[`${key}-evidence`] }), !fields[`${key}-note`]?.trim() || !fields[`${key}-evidence`]?.trim())} {button("Report exception", () => void act("record", { campusId: campus.id, code: item.code, result: "exception", note: fields[`${key}-note`], evidenceReference: fields[`${key}-evidence`] }), !fields[`${key}-note`]?.trim() || !fields[`${key}-evidence`]?.trim())}</>}
            {recorded && <><p className="text-sm">{recorded.observation} · {recorded.evidenceReference}</p>{recorded.resolutionNote && <p className="text-sm text-slate-600">Resolution: {recorded.resolutionNote} · {recorded.resolutionEvidence}</p>}{recorded.verificationNote && <p className="text-sm text-slate-600">Review: {recorded.verificationNote}</p>}</>}
          </div>;
        })}</div></section>)}
      {exceptions.length > 0 && <section className="space-y-3"><h2 className="text-xl font-bold">Exceptions needing action</h2>{exceptions.map((entry) => {
        const campus = data.campuses.find((item) => item.id === entry.campusId);
        const key = `resolution-${entry.id}`;
        return <div key={entry.id} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4"><h3 className="font-bold">{campus?.name} · {entry.operatingDate} · {checks.find((item) => item.code === entry.code)?.title} · {entry.status}</h3><p className="text-sm">{entry.observation}</p>
          {campus?.canManage && entry.status === "exception" && <div className="grid gap-2 md:grid-cols-2">{note(`${key}-note`, "How was it resolved?")}{input(`${key}-evidence`, "Resolution evidence reference")}{button("Submit resolution", () => void act("resolve", { checkId: entry.id, note: fields[`${key}-note`], evidenceReference: fields[`${key}-evidence`] }), !fields[`${key}-note`]?.trim() || !fields[`${key}-evidence`]?.trim())}</div>}
          {campus?.canManage && entry.status === "resolved" && <div className="space-y-2">{note(`${key}-review`, "Independent review finding")}{button("Verify resolution", () => void act("verify", { checkId: entry.id, note: fields[`${key}-review`] }), !fields[`${key}-review`]?.trim())} {button("Return for further work", () => void act("return", { checkId: entry.id, note: fields[`${key}-review`] }), !fields[`${key}-review`]?.trim())}<p className="text-xs text-slate-600">The leader who submitted the resolution cannot verify it.</p></div>}
          <details className="text-sm"><summary className="cursor-pointer font-semibold">History ({entry.events.length})</summary><ol className="mt-2 space-y-1">{entry.events.map((event) => <li key={event.id}>{event.type} · {new Date(event.createdAt).toLocaleString()} · {event.note}</li>)}</ol></details>
        </div>;
      })}</section>}
    </>}
  </main>;
}
