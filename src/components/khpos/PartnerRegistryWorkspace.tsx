"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, CircleAlert, Clock3, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposPartnerAction,
  KhposPartnerRegistry,
  KhposPartnerRegistryEntry,
} from "@/lib/khpos/partnership";

const statusIcon = {
  pending: Clock3,
  active: CheckCircle2,
  suspended: CircleAlert,
  ended: CircleAlert,
};

const actionsByStatus: Record<KhposPartnerRegistryEntry["partnerStatus"], KhposPartnerAction[]> = {
  pending: ["approve", "end"],
  active: ["suspend", "end"],
  suspended: ["reactivate", "end"],
  ended: [],
};

export function PartnerRegistryWorkspace() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [registry, setRegistry] = useState<KhposPartnerRegistry | null>(null);
  const [state, setState] = useState<"loading" | "signed_out" | "ready" | "denied">("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{ organisationId: string; name: string; action: KhposPartnerAction } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!supabase) {
      setError("Platform authentication is not configured.");
      setState("denied");
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setState("signed_out");
      return;
    }
    const response = await fetch("/api/khpos/admin/partners", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = (await response.json()) as { ok?: boolean; registry?: KhposPartnerRegistry; error?: string };
    if (!response.ok || !body.ok || !body.registry) {
      setError(body.error ?? "Partnership Registry could not be loaded.");
      setState(response.status === 401 ? "signed_out" : "denied");
      return;
    }
    setRegistry(body.registry);
    setState("ready");
    setError("");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function applyChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selected) return;
    setBusy(true);
    setError("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusy(false);
      setState("signed_out");
      return;
    }
    const response = await fetch("/api/khpos/admin/partners", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...selected, reason: reason.trim() }),
    });
    const body = (await response.json()) as { ok?: boolean; registry?: KhposPartnerRegistry; error?: string };
    setBusy(false);
    if (!response.ok || !body.ok || !body.registry) {
      setError(body.error ?? "Partnership could not be changed.");
      return;
    }
    setRegistry(body.registry);
    setSelected(null);
    setReason("");
  }

  if (state === "loading") {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-white"><Loader2 className="size-9 animate-spin text-mint-300" /></main>;
  }

  if (state === "signed_out") {
    return <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white"><div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><ShieldCheck className="mx-auto size-9 text-mint-300" /><h1 className="mt-4 text-2xl font-black">Admin sign-in required</h1><p className="mt-3 text-sm leading-6 text-slate-300">Use the KAEC-NG Admin Console to sign in, then return to the Partnership Registry.</p><Link href="/khpos/admin" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-950">Open Admin Console <ArrowRight className="size-4" /></Link></div></main>;
  }

  if (state === "denied" || !registry) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-5"><div className="max-w-lg rounded-3xl border border-red-200 bg-white p-8"><h1 className="text-2xl font-black">Partnership Registry unavailable</h1><p className="mt-3 text-sm text-red-700">{error}</p><Link href="/khpos/admin" className="mt-5 inline-flex font-bold text-brand-700">Return to Admin Console</Link></div></main>;
  }

  const canManage = registry.viewerRole === "super_admin" || registry.viewerRole === "portfolio_admin";

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><Link href="/khpos/admin" className="text-sm font-bold text-mint-300">← Admin Console</Link><p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-mint-300">KAEC-NG governance</p><h1 className="mt-2 text-4xl font-black tracking-tight">School Partnership Registry</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Accounts are open. KHP-OS is not. Only institutions explicitly approved here can hold active KHP-OS memberships.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold"><RefreshCw className="size-4" /> Refresh</button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {(["pending", "active", "suspended", "ended"] as const).map((key) => <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">{key}</p><p className="mt-2 text-3xl font-black">{registry.summary[key]}</p></div>)}
        </div>

        {error && <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">{error}</div>}

        <section className="mt-9 space-y-4">
          {registry.partners.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-8"><Building2 className="size-8 text-slate-400" /><h2 className="mt-4 text-xl font-black">No partnership requests yet</h2><p className="mt-2 text-sm text-slate-400">Schools appear here after a verified KSHC report owner requests KHP-OS partnership.</p></div>
          ) : registry.partners.map((partner) => {
            const Icon = statusIcon[partner.partnerStatus];
            const actions = actionsByStatus[partner.partnerStatus];
            return <article key={partner.organisationId} className="rounded-[28px] border border-white/10 bg-white/5 p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl"><div className="flex items-center gap-2"><Icon className="size-5 text-mint-300" /><span className="text-xs font-black uppercase tracking-[0.15em] text-mint-300">{partner.partnerStatus}</span></div><h2 className="mt-3 text-2xl font-black">{partner.name}</h2><p className="mt-2 text-sm text-slate-400">{[partner.schoolLevel, partner.state, partner.country].filter(Boolean).join(" · ") || "School context not supplied"}</p><div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400"><span>{partner.memberCount} member{partner.memberCount === 1 ? "" : "s"}</span><span>Core entitlement: {partner.entitlements.includes("khpos_core") ? "configured" : "not configured"}</span>{partner.latestOverallScore !== null && <span>Latest KSHC: {partner.latestOverallScore}</span>}</div>{partner.statusReason && <p className="mt-4 text-sm leading-6 text-slate-300">Last governance note: {partner.statusReason}</p>}</div>{canManage && actions.length > 0 && <div className="flex flex-wrap gap-2">{actions.map((action) => <button key={action} onClick={() => { setSelected({ organisationId: partner.organisationId, name: partner.name, action }); setReason(""); setError(""); }} className="rounded-full border border-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide hover:bg-white/10">{action}</button>)}</div>}</div></article>;
          })}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
          <form onSubmit={applyChange} className="w-full max-w-lg rounded-[28px] bg-white p-7 text-slate-950 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-brand-700">Partnership governance</p>
            <h2 className="mt-2 text-2xl font-black">{selected.action} {selected.name}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">This changes real KHP-OS access. Administrator MFA (AAL2) is required.</p>
            <label className="mt-5 block text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="partner-reason">Governance reason</label>
            <textarea id="partner-reason" required minLength={12} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="Why is KAEC-NG making this partnership decision?" />
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold">Cancel</button><button disabled={busy} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{busy ? "Applying…" : `Confirm ${selected.action}`}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
