"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { RecordQueueSearchControls, useRecordSearch } from "@/components/khpos/ops/RecordQueueSearch";
type RequestRow = { id: string; organisation_id: string; name: string; address: string; rationale: string; status: string; review_note: string | null; readiness_reference: string | null; created_at: string };
type Directory = { switchableSchools: {id: string; name: string}[]; canRequest: boolean; canReview: boolean; schools: { id: string; name: string; status: string }[]; campuses: { id: string; organisationId: string; name: string; status: string }[]; requests: RequestRow[] };
const field = "mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950";
export function SchoolsCampusesWorkspace({ organisationId }: { organisationId?: string }) {
 const [directory, setDirectory] = useState<Directory | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const [directoryQuery, setDirectoryQuery] = useState("");
 const [selection, setSelection] = useState<{ request: RequestRow; mode: string } | null>(null);
 const endpoint = `/api/khpos/schools-campuses${organisationId ? `?organisationId=${organisationId}` : ""}`;
 const fetchDirectory = useCallback(async (input?: Record<string, unknown>) => {
  const client = createBrowserSupabaseClient();
  const session = (await client?.auth.getSession())?.data.session;
  if (!session) throw new Error("Sign in to continue.");
  const res = await fetch(endpoint, { method: input ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, ...(input ? { body: JSON.stringify(input) } : {}) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Could not load Schools & Campuses.");
  return body.directory as Directory;
 }, [endpoint]);
 useEffect(() => { let active = true; void fetchDirectory().then(data => { if(active) setDirectory(data); }).catch(cause => { if(active) setError(cause.message); }); return () => { active = false; }; }, [fetchDirectory]);
 const search = useRecordSearch(directory?.requests ?? [], r => `${r.name} ${r.address} ${r.status}`, r => r.name, r => r.created_at);
 async function act(input: Record<string, unknown>, form?: HTMLFormElement) {
  setBusy(true); setError("");
  try { setDirectory(await fetchDirectory(input)); setSelection(null); form?.reset(); }
  catch (cause) { setError(cause instanceof Error ? cause.message : "Campus request failed."); }
  finally { setBusy(false); }
 }
 return <main className="mx-auto max-w-6xl space-y-6 p-4 text-slate-950 sm:p-6">
  <div><h1 className="text-3xl font-bold">Schools & Campuses</h1><p className="mt-2 text-slate-600">Each school keeps its own records. A school can have several campuses. KAEC oversees the network.</p></div>
  <div className="flex flex-wrap gap-3 text-sm font-semibold"><Link href={organisationId ? "/account" : "/khpos/admin/partnerships"} className="rounded-xl border p-3">{organisationId ? "School partnerships & school access" : "Independent school partnerships"}</Link>{organisationId && <><Link href={`/khpos/${organisationId}/people`} className="rounded-xl border p-3">Assign campus leaders</Link><Link href={`/khpos/${organisationId}/campus-readiness`} className="rounded-xl border p-3">Daily campus readiness</Link></>}</div>
  <p className="text-sm text-slate-600">New independent schools join through the existing KSHC partnership process. New campuses require a separate readiness review and KAEC approval. Approval alone does not activate a campus.</p>
  {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}<button type="button" disabled={busy} className="ml-3 underline" onClick={() => { setError(""); void fetchDirectory().then(setDirectory).catch(cause => setError(cause.message)); }}>Retry</button></div>}
  {!directory && !error && <p role="status">Loading schools and campuses…</p>}
  {directory && <>
   {directory.switchableSchools.length > 1 && <section><h2 className="text-xl font-bold">Switch school</h2><div className="mt-3 flex flex-wrap gap-2">{directory.switchableSchools.map(s => <Link key={s.id} aria-current={s.id === organisationId ? "page" : undefined} className="rounded-xl border bg-white p-3" href={`/khpos/${s.id}/schools-campuses`}>{s.name}</Link>)}</div></section>}
   <section className="space-y-3"><h2 className="text-xl font-bold">School & campus directory</h2><label className="block">Search schools and campuses<input type="search" className={field} value={directoryQuery} onChange={event => setDirectoryQuery(event.target.value)} /></label>{directory.schools.filter(s => `${s.name} ${directory.campuses.filter(c => c.organisationId === s.id).map(c => c.name).join(" ")}`.toLowerCase().includes(directoryQuery.trim().toLowerCase())).map(s => <article key={s.id} className="rounded-2xl border bg-white p-4"><h3 className="font-bold">{s.name} <span className="text-sm font-normal">· {s.status}</span></h3><ul className="mt-3 space-y-2">{directory.campuses.filter(c => c.organisationId === s.id).map(c => <li key={c.id}>{c.name} · {c.status}</li>)}</ul></article>)}</section>
   {directory.canRequest && <form className="space-y-3 rounded-2xl border bg-white p-4" onSubmit={event => { event.preventDefault(); const form = event.currentTarget, values = new FormData(form); void act({ mode: "submit", name: values.get("name"), address: values.get("address"), rationale: values.get("rationale") }, form); }}><h2 className="text-xl font-bold">Request a new campus</h2><label className="block">Campus name<input className={field} name="name" required minLength={2} maxLength={140} /></label><label className="block">Location and address<textarea className={field} name="address" required minLength={5} maxLength={600} /></label><label className="block">Purpose, proposed leadership and readiness plan<textarea className={field} name="rationale" required minLength={12} maxLength={2000} /></label><button disabled={busy} className="min-h-11 rounded-xl bg-slate-950 px-4 text-white disabled:opacity-50">{busy ? "Saving…" : "Submit campus request"}</button></form>}
   {(directory.canRequest || directory.canReview) && <section className="space-y-3"><h2 className="text-xl font-bold">Campus requests</h2><RecordQueueSearchControls {...search} shown={search.visibleItems.length} total={directory.requests.length} placeholder="Search campus requests" />{search.visibleItems.length === 0 && <p>No campus requests in this view.</p>}{search.visibleItems.map(r => <article key={r.id} className="space-y-2 break-words rounded-2xl border bg-white p-4"><h3 className="font-bold">{r.name} · {r.status}</h3><p className="text-sm text-slate-500">{directory.schools.find(s => s.id === r.organisation_id)?.name} · {new Date(r.created_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</p><p>{r.address}</p><p>{r.rationale}</p>{r.review_note && <p>Review: {r.review_note}</p>}{r.readiness_reference && <p>Readiness evidence: {r.readiness_reference}</p>}<div className="flex flex-wrap gap-2">{directory.canRequest && r.status === "submitted" && <button disabled={busy} className="min-h-11 rounded-lg border px-3" onClick={() => void act({ mode: "withdraw", requestId: r.id })}>Withdraw request</button>}{directory.canReview && (r.status === "submitted" ? ["approve", "reject"] : r.status === "approved" ? ["activate"] : []).map(mode => <button key={mode} disabled={busy} className="min-h-11 rounded-lg border px-3 capitalize" onClick={() => setSelection({ request: r, mode })}>{mode === "activate" ? "Activate approved campus" : mode}</button>)}</div>
    {selection?.request.id === r.id && <form className="space-y-3 rounded-xl bg-slate-50 p-3" onSubmit={event => {event.preventDefault(); const values = new FormData(event.currentTarget); void act({ mode: selection.mode, organisationId: r.organisation_id, requestId: r.id, note: values.get("note"), readinessReference: values.get("readinessReference") });}}><p className="font-semibold capitalize">{selection.mode} {r.name}</p>{selection.mode === "approve" && <label className="block">Campus readiness review reference<input name="readinessReference" required minLength={5} maxLength={600} className={field} /></label>}<label className="block">Governance note<textarea name="note" required minLength={12} maxLength={2000} className={field} /></label><button disabled={busy} className="min-h-11 rounded-xl bg-slate-950 px-4 text-white">{busy ? "Saving…" : "Confirm action"}</button><button type="button" className="ml-3 min-h-11 underline" onClick={() => setSelection(null)}>Cancel</button></form>}
   </article>)}</section>}
  </>}
 </main>;
}
