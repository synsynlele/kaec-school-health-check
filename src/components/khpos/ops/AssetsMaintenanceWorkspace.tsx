"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AssetsWorkspace, CampusAsset } from "@/lib/khpos/ops/assets";

const categories = ["facility", "equipment", "technology", "transport", "safety", "other"];
const activeIssue = (asset: CampusAsset) => asset.issues.find((issue) => issue.status !== "closed");

export function AssetsMaintenanceWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [data, setData] = useState<AssetsWorkspace | null>(null);
  const [actorId, setActorId] = useState("");
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
        const response = await fetch(`/api/khpos/ops/assets/${organisationId}`, { headers: { Authorization: `Bearer ${session.session.access_token}` }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Assets could not be loaded.");
        if (active) { setData(result.assets); setActorId(session.session.user.id); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Assets could not be loaded."); }
    });
    return () => { active = false; };
  }, [organisationId, supabase]);
  async function act(mode: string, input: Record<string, unknown>) {
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Sign in to continue.");
      const response = await fetch(`/api/khpos/ops/assets/${organisationId}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session.access_token}` }, body: JSON.stringify({ mode, ...input }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Asset action failed.");
      setData(result.assets); setFields({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Asset action failed."); }
    finally { setBusy(false); }
  }
  const input = (key: string, title: string, type = "text") => <label className="block text-sm font-medium text-slate-700">{title}<input type={type} value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" /></label>;
  const note = (key: string, title: string) => <label className="block text-sm font-medium text-slate-700">{title}<textarea rows={2} value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" /></label>;
  const select = (key: string, title: string, options: { value: string; label: string }[]) => <label className="block text-sm font-medium text-slate-700">{title}<select value={fields[key] || ""} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"><option value="">Choose…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  const button = (title: string, action: () => void, disabled = false) => <button type="button" disabled={busy || disabled} onClick={action} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : title}</button>;
  const dueCount = data?.assets.filter((asset) => asset.status === "active" && asset.nextServiceDate <= data.today).length || 0;
  const faultCount = data?.assets.filter((asset) => asset.status === "active" && activeIssue(asset)).length || 0;

  return <main className="mx-auto max-w-6xl space-y-6 p-5 text-slate-900"><header><h1 className="text-3xl font-bold">Assets & Maintenance</h1><p className="mt-2 text-slate-600">Keep an asset register, see service due dates, and verify maintenance evidence. Faults go to the shared <Link href={`/khpos/${organisationId}/issues`} className="underline">Issues queue</Link> for ownership and closure.</p><p className="mt-2 text-sm font-semibold text-rose-800">For a child safety concern, use the protected <Link href={`/khpos/${organisationId}/safeguarding`} className="underline">Safeguarding pathway</Link>. Keep disclosures out of asset notes.</p></header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800">{error}</p>}
    {!data && !error && <p>Loading assets…</p>}
    {data && <><div className="flex flex-wrap gap-3 text-sm font-bold"><span className="rounded-lg bg-slate-100 p-3">{data.assets.filter((asset) => asset.status === "active").length} active assets</span><span className={`rounded-lg p-3 ${dueCount ? "bg-amber-50 text-amber-900" : "bg-slate-100"}`}>{dueCount} service due</span><span className={`rounded-lg p-3 ${faultCount ? "bg-rose-50 text-rose-800" : "bg-slate-100"}`}>{faultCount} open faults</span></div>
      {data.campuses.some((campus) => campus.canManage) && <section className="space-y-3 rounded-xl border border-slate-200 p-4"><h2 className="text-xl font-bold">Register an asset</h2><div className="grid gap-3 md:grid-cols-3">
        {select("campus", "Campus", data.campuses.filter((campus) => campus.canManage).map((campus) => ({ value: campus.id, label: campus.name })))}
        {input("code", "Campus asset code")}{input("label", "Asset name")}
        {select("category", "Category", categories.map((value) => ({ value, label: value })))}
        {input("location", "Location")}{input("interval", "Service interval (days)", "number")}{input("due", "First service due", "date")}
      </div>{button("Register asset", () => void act("create", { campusId: fields.campus, code: fields.code, label: fields.label, category: fields.category, location: fields.location, intervalDays: fields.interval, nextServiceDate: fields.due }), !fields.campus || !fields.code?.trim() || !fields.label?.trim() || !fields.category || !fields.location?.trim() || !fields.interval || !fields.due)}</section>}
      {data.assets.length === 0 && <p className="rounded-xl border border-slate-200 p-4 text-slate-600">No assets recorded on your campuses yet.</p>}
      {data.assets.map((asset) => {
        const campus = data.campuses.find((item) => item.id === asset.campusId);
        const issue = activeIssue(asset);
        const pending = asset.services.find((service) => ["submitted", "returned"].includes(service.status));
        const due = asset.status === "active" && asset.nextServiceDate <= data.today;
        const key = asset.id;
        return <section key={asset.id} className="space-y-4 rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xl font-bold">{asset.label} <span className="text-sm text-slate-500">· {asset.code}</span></h2><p className="mt-1 text-sm text-slate-600">{campus?.name} · {asset.location} · {asset.category} · Owner: {asset.ownerRoleTitle} · Every {asset.intervalDays} days</p></div><span className={`rounded-lg px-3 py-2 text-sm font-bold ${asset.status === "retired" ? "bg-slate-100 text-slate-600" : due ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{asset.status === "retired" ? "Retired" : `${due ? "Service due" : "Next service"} ${asset.nextServiceDate}`}</span></div>
          {issue && <p className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-900">Open fault · {issue.severity} · {issue.status} · <Link href={`/khpos/${organisationId}/issues#issue-${issue.id}`} className="underline">Resolve in Issues</Link></p>}
          {asset.status === "active" && <div className="grid gap-3 lg:grid-cols-2">
            {!pending && <div className="space-y-2 rounded-lg bg-slate-50 p-3"><h3 className="font-bold">Record service completed</h3>{note(`service-${key}`, "Work performed")}{input(`evidence-${key}`, "Service evidence reference")}{button("Submit for verification", () => void act("submit_service", { assetId: key, note: fields[`service-${key}`], evidenceReference: fields[`evidence-${key}`] }), !fields[`service-${key}`]?.trim() || !fields[`evidence-${key}`]?.trim())}</div>}
            {!issue && <div className="space-y-2 rounded-lg bg-slate-50 p-3"><h3 className="font-bold">Report a fault</h3>{note(`fault-${key}`, "What failed?")}{input(`immediate-${key}`, "Immediate action taken")}{select(`severity-${key}`, "Severity", [{ value: "P2", label: "P2 · High (within 7 days)" }, { value: "P3", label: "P3 · Standard (within 14 days)" }, { value: "P4", label: "P4 · Planned (within 30 days)" }])}{input(`faultDue-${key}`, "Resolution due", "date")}{button("Open issue", () => void act("report_fault", { assetId: key, note: fields[`fault-${key}`], immediateAction: fields[`immediate-${key}`], severity: fields[`severity-${key}`], dueDate: fields[`faultDue-${key}`] }), !fields[`fault-${key}`]?.trim() || !fields[`immediate-${key}`]?.trim() || !fields[`severity-${key}`] || !fields[`faultDue-${key}`])}</div>}
          </div>}
          {pending && <div className="space-y-3 rounded-lg border border-amber-200 p-3"><h3 className="font-bold">Service awaiting {pending.status === "returned" ? "correction" : "verification"}</h3><p className="text-sm">{pending.note} · Evidence: {pending.evidenceReference}</p>{pending.reviewNote && <p className="text-sm text-amber-900">Review: {pending.reviewNote}</p>}
            {pending.status === "returned" && pending.submittedBy === actorId && <div className="space-y-2">{note(`resubmit-${pending.id}`, "Corrected service details")}{input(`resubmitEvidence-${pending.id}`, "Updated evidence")}{button("Resubmit service", () => void act("resubmit_service", { assetId: key, serviceId: pending.id, note: fields[`resubmit-${pending.id}`], evidenceReference: fields[`resubmitEvidence-${pending.id}`] }), !fields[`resubmit-${pending.id}`]?.trim() || !fields[`resubmitEvidence-${pending.id}`]?.trim())}</div>}
            {pending.status === "submitted" && campus?.canManage && pending.submittedBy !== actorId && <div className="space-y-2">{note(`review-${pending.id}`, "Independent review finding")}{button("Verify service", () => void act("verify_service", { assetId: key, serviceId: pending.id, note: fields[`review-${pending.id}`] }), !fields[`review-${pending.id}`]?.trim())} {button("Return for correction", () => void act("return_service", { assetId: key, serviceId: pending.id, note: fields[`review-${pending.id}`] }), !fields[`review-${pending.id}`]?.trim())}</div>}
          </div>}
          <details className="rounded-lg border border-slate-200 p-3 text-sm"><summary className="cursor-pointer font-semibold">Service and fault history ({asset.services.length} services · {asset.issues.length} issues)</summary><div className="mt-3 space-y-3">{asset.services.map((service) => <div key={service.id} className="border-t border-slate-100 pt-2"><p className="font-semibold">{service.status} · {new Date(service.submittedAt).toLocaleString()} · {service.note}</p><p className="text-slate-600">Evidence: {service.evidenceReference}{service.nextDueDate ? ` · Next due ${service.nextDueDate}` : ""}</p><ol className="mt-1 text-xs text-slate-500">{service.events.map((event) => <li key={event.id}>{event.type}: {event.note}</li>)}</ol></div>)}{asset.issues.map((record) => <p key={record.id}><Link href={`/khpos/${organisationId}/issues#issue-${record.id}`} className="underline">{record.severity} · {record.title} · {record.status}</Link></p>)}</div></details>
          {campus?.canManage && asset.status === "active" && !issue && !pending && <details className="rounded-lg border border-slate-200 p-3 text-sm"><summary className="cursor-pointer font-semibold">Retire asset</summary><div className="mt-3 space-y-2">{note(`retire-${key}`, "Reason and disposition")}{button("Retire asset", () => void act("retire", { assetId: key, note: fields[`retire-${key}`] }), !fields[`retire-${key}`]?.trim())}</div></details>}
        </section>;
      })}
    </>}
  </main>;
}
