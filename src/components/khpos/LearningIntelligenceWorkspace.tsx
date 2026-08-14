"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BrainCircuit, CircleAlert, Link2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposKsiWorkspace, KsiSignalCard, KsiSignalState } from "@/lib/khpos/ksi-integration";

function tone(state: KsiSignalState): string {
  if (state === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (state === "developing") return "border-brand-200 bg-brand-50 text-brand-900";
  if (state === "attention") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatDate(value: string | null): string {
  if (!value) return "Not yet synced";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function SignalCard({ signal }: { signal: KsiSignalCard }) {
  return (
    <article className={`rounded-3xl border p-5 ${tone(signal.state)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{signal.state}</p>
          <h3 className="mt-2 text-lg font-black">{signal.title}</h3>
        </div>
        <BrainCircuit className="size-5 shrink-0 opacity-70" />
      </div>
      <p className="mt-4 text-xl font-black tracking-tight">{signal.headline}</p>
      <p className="mt-2 text-sm leading-6 opacity-80">{signal.detail}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {signal.systems.map((system) => (
          <span key={system} className="rounded-full border border-current/15 bg-white/50 px-2.5 py-1 text-[10px] font-bold">
            {system}
          </span>
        ))}
      </div>
    </article>
  );
}

export function LearningIntelligenceWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] = useState<KhposKsiWorkspace | null>(null);
  const [error, setError] = useState(supabase ? "" : "KHP-OS sign-in is not configured.");
  const [busy, setBusy] = useState(false);

  async function token() {
    if (!supabase) throw new Error("KHP-OS sign-in is not configured.");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Your session has ended. Sign in again to continue.");
    return data.session.access_token;
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token;
      if (!active) return;
      if (!accessToken) {
        setError("Your session has ended. Sign in again to continue.");
        return;
      }
      const response = await fetch(`/api/khpos/integrations/ksi/${organisationId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = (await response.json()) as { ok?: boolean; workspace?: KhposKsiWorkspace; error?: string };
      if (!active) return;
      if (!response.ok || !body.ok || !body.workspace) {
        setError(body.error ?? "Learning intelligence could not be loaded.");
        return;
      }
      setWorkspace(body.workspace);
      setError("");
    });
    return () => { active = false; };
  }, [organisationId, supabase]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const accessToken = await token();
      const response = await fetch(`/api/khpos/integrations/ksi/${organisationId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_pairing" }),
      });
      const body = (await response.json()) as { ok?: boolean; pairing?: { pairingUrl: string }; error?: string };
      if (!response.ok || !body.ok || !body.pairing?.pairingUrl) throw new Error(body.error ?? "Secure KSI pairing could not be created.");
      window.location.assign(body.pairing.pairingUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "KSI connection could not be started.");
      setBusy(false);
    }
  }

  if (!workspace && !error) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-white"><Loader2 className="size-8 animate-spin text-mint-300" /></main>;
  }
  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Learning intelligence unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link href={`/khpos/${organisationId}`} className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950">Command Centre</Link>
        </div>
      </main>
    );
  }

  const connected = workspace.integration.status === "active";
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
          <Link href={`/khpos/${organisationId}/improvement`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="size-4" /> Improvement Intelligence
          </Link>
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-mint-300">KHP-OS × KSI</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">Learning quality becomes institutional context.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                KSI remains the specialist learning engine. KHP-OS receives only governed school-level signals that help leadership understand whether learning systems are operating consistently.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Connection</p>
              <p className="mt-1 text-lg font-black capitalize">{workspace.integration.status.replaceAll("_", " ")}</p>
              <p className="mt-1 text-xs text-slate-400">Last sync: {formatDate(workspace.integration.lastSyncedAt)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {error && <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><CircleAlert className="mt-0.5 size-5" />{error}</div>}

        <section className="rounded-[30px] border border-amber-200 bg-amber-50 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">Epistemic boundary</p>
          <h2 className="mt-2 text-xl font-black text-amber-950">KSI context does not resolve KSHC priorities.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-amber-900/80">
            These signals can strengthen interpretation, intervention review and institutional learning. Only a fresh KSHC reassessment can verify improvement or resolve a diagnosed priority.
          </p>
        </section>

        {!connected ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
            <Link2 className="size-7 text-brand-700" />
            <h2 className="mt-4 text-2xl font-black">Connect this school to its KSI workspace</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              One authorised KHP-OS leader starts the connection. In KSI, an Owner or Admin approves the exact school workspace once. After that, KSI syncs bounded 90-day aggregate learning signals automatically.
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500">No student records, teacher rankings, lesson content or diagnosis prose are transferred.</p>
            {workspace.membership.canConnect ? (
              <button type="button" disabled={busy} onClick={() => void connect()} className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Connect KSI securely
              </button>
            ) : (
              <p className="mt-6 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">Only an Executive or Transformation Lead can initiate the KSI connection.</p>
            )}
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              {workspace.signals.map((signal) => <SignalCard key={signal.key} signal={signal} />)}
            </section>
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Bound KSI workspace</p>
                  <h2 className="mt-2 text-xl font-black">{workspace.integration.externalWorkspaceName ?? "Connected school workspace"}</h2>
                  <p className="mt-2 text-xs text-slate-500">Contract v{workspace.integration.contractVersion} · source generated {formatDate(workspace.integration.lastSourceGeneratedAt)}</p>
                </div>
                {workspace.membership.canConnect && (
                  <button type="button" disabled={busy} onClick={() => void connect()} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">
                    <RefreshCw className="size-4" /> Reconnect / rotate binding
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
