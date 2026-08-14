"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposPartnerSnapshot } from "@/lib/khpos/partnership";

const statusView = {
  pending: {
    icon: Clock3,
    title: "Partnership request received",
    body: "KAEC-NG is reviewing this institution. Your free KSHC account and report remain available, but KHP-OS is locked until the partnership is explicitly approved.",
  },
  active: {
    icon: CheckCircle2,
    title: "Partnership active",
    body: "KAEC-NG has approved this institution for KHP-OS. Authorised school members may now enter the transformation workspace.",
  },
  suspended: {
    icon: CircleAlert,
    title: "Partnership suspended",
    body: "KHP-OS access is temporarily disabled. KSHC records are preserved while KAEC-NG resolves the partnership status.",
  },
  ended: {
    icon: CircleAlert,
    title: "Partnership ended",
    body: "This institution no longer has KHP-OS access. Historical KSHC records remain separate and preserved.",
  },
} as const;

export function PartnershipStatusWorkspace({ organisationId }: { organisationId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [state, setState] = useState<"loading" | "signed_out" | "ready" | "error">("loading");
  const [partnership, setPartnership] = useState<KhposPartnerSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setError("Account sign-in is not configured.");
      setState("error");
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const token = data.session?.access_token;
      if (!token) {
        setState("signed_out");
        return;
      }
      const response = await fetch(`/api/khpos/partnership/${organisationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as { ok?: boolean; partnership?: KhposPartnerSnapshot; error?: string };
      if (!active) return;
      if (!response.ok || !body.ok || !body.partnership) {
        setError(body.error ?? "Partnership status could not be loaded.");
        setState(response.status === 401 ? "signed_out" : "error");
        return;
      }
      setPartnership(body.partnership);
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  if (state === "loading") {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-white"><Loader2 className="size-9 animate-spin text-mint-300" /></main>;
  }

  if (state === "signed_out") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white">
        <div className="max-w-lg rounded-[30px] border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto size-9 text-mint-300" />
          <h1 className="mt-4 text-2xl font-black">Sign in to view this partnership</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Use the same verified account connected to the school&apos;s KSHC report.</p>
          <Link href="/account" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-950">Go to account <ArrowRight className="size-4" /></Link>
        </div>
      </main>
    );
  }

  if (state === "error" || !partnership) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-5"><div className="max-w-lg rounded-3xl border border-red-200 bg-white p-8"><h1 className="text-2xl font-black text-slate-950">Partnership unavailable</h1><p className="mt-3 text-sm leading-6 text-red-700">{error}</p><Link href="/account" className="mt-5 inline-flex font-bold text-brand-700">Return to account</Link></div></main>;
  }

  const view = statusView[partnership.partnerStatus];
  const Icon = view.icon;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/account" className="text-sm font-bold text-mint-300">← Back to account</Link>
        <div className="mt-8 rounded-[34px] border border-white/10 bg-white/5 p-7 sm:p-10">
          <Icon className="size-10 text-mint-300" />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-mint-300">KHP-OS partnership status</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">{partnership.name}</h1>
          <h2 className="mt-7 text-2xl font-black">{view.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{view.body}</p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
            <p><strong className="text-white">Account access:</strong> active</p>
            <p className="mt-2"><strong className="text-white">KHP-OS access:</strong> {partnership.partnerStatus === "active" ? "granted" : "not granted"}</p>
            <p className="mt-2"><strong className="text-white">Membership:</strong> {partnership.membershipRole} · {partnership.membershipStatus}</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            {partnership.partnerStatus === "active" && (
              <Link href={`/khpos/${partnership.organisationId}`} className="inline-flex items-center gap-2 rounded-full bg-mint-300 px-6 py-3 text-sm font-black text-slate-950">Open KHP-OS <ArrowRight className="size-4" /></Link>
            )}
            <Link href="/assessment" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-black text-white">Run another KSHC</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
