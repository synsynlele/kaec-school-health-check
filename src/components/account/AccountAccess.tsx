"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Loader2, LogOut, Mail, ShieldCheck, UserPlus } from "lucide-react";
import {
  createBrowserSupabaseClient,
  createEmailLinkSupabaseClient,
} from "@/lib/supabase/client";
import type { KhposPartnerSnapshot } from "@/lib/khpos/partnership";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.24-.2-1.8h-9.2v3.34h5.4a4.64 4.64 0 0 1-2 2.95l-.02.11 2.91 2.26.2.02c1.86-1.72 2.91-4.25 2.91-6.88Z" />
      <path fill="#34A853" d="M12.2 21.8c2.66 0 4.89-.88 6.52-2.39l-3.1-2.4c-.83.56-1.95.95-3.42.95a5.93 5.93 0 0 1-5.6-4.1l-.1.01-3.03 2.35-.04.1A9.84 9.84 0 0 0 12.2 21.8Z" />
      <path fill="#FBBC05" d="M6.6 13.86a6.08 6.08 0 0 1-.33-1.96c0-.68.12-1.34.32-1.96v-.12L3.52 7.43l-.1.05A9.9 9.9 0 0 0 2.35 11.9c0 1.59.38 3.09 1.06 4.42l3.18-2.46Z" />
      <path fill="#EA4335" d="M12.2 5.84c1.85 0 3.1.8 3.82 1.46l2.77-2.7C17.1 3.02 14.86 2 12.2 2a9.84 9.84 0 0 0-8.78 5.48l3.17 2.46a5.96 5.96 0 0 1 5.61-4.1Z" />
    </svg>
  );
}

const statusCopy = {
  pending: ["Partnership under review", "Your KSHC account is active, but KHP-OS access begins only after KAEC-NG approves the institutional partnership."],
  active: ["KHP-OS partnership active", "This institution is approved for its granted KHP-OS entitlements."],
  suspended: ["Partnership suspended", "KHP-OS access is temporarily disabled by KAEC-NG. Your KSHC records remain available."],
  ended: ["Partnership ended", "KHP-OS access has ended. Historical KSHC records remain separate from the partnership entitlement."],
} as const;

export function AccountAccess() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [state, setState] = useState<"checking" | "signed_out" | "ready">("checking");
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [partnerships, setPartnerships] = useState<KhposPartnerSnapshot[]>([]);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setError("Account sign-in is not configured.");
      setState("signed_out");
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
      const response = await fetch("/api/account", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        account?: { email: string };
        partnerships?: KhposPartnerSnapshot[];
        error?: string;
      };
      if (!response.ok || !body.ok || !body.account) {
        setError(body.error ?? "Your account could not be loaded.");
        setState(response.status === 401 ? "signed_out" : "ready");
        return;
      }
      setAccountEmail(body.account.email);
      setPartnerships(body.partnerships ?? []);
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  async function continueWithGoogle() {
    if (!supabase) return;
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account")}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (authError) setError("Google sign-in could not start. Please try again.");
  }

  async function continueWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = createEmailLinkSupabaseClient();
    if (!client || !email.trim()) return;
    setBusy(true);
    setError("");
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account")}`;
    const { error: authError } = await client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo, shouldCreateUser: mode === "signup" },
    });
    setBusy(false);
    if (authError) {
      setError(
        mode === "signin"
          ? "We could not sign in with that email. If this is your first visit, choose Create account."
          : "We could not create the account. Please try again.",
      );
      return;
    }
    setEmailSent(true);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (state === "checking") {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="size-8 animate-spin text-brand-700" /></main>;
  }

  if (state === "signed_out") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-xl rounded-[32px] border border-slate-200 bg-white p-7 shadow-lift sm:p-10">
          <Link href="/" className="text-sm font-bold text-brand-700">← Back to KSHC</Link>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-brand-800">
            <ShieldCheck className="size-4" /> Free KSHC account
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Sign in or create your account</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your account lets you securely return to KAEC-NG services. Creating an account does <strong>not</strong> grant KHP-OS access; KHP-OS is reserved for approved partner institutions.
          </p>

          <div className="mt-7 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            {(["signin", "signup"] as const).map((item) => (
              <button key={item} type="button" onClick={() => { setMode(item); setEmailSent(false); setError(""); }} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold ${mode === item ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
                {item === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <button type="button" onClick={continueWithGoogle} className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 px-5 py-3.5 text-sm font-extrabold text-slate-900 transition hover:bg-slate-50">
            <GoogleMark /> Continue with Google <ArrowRight className="size-4" />
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">First-time Google users automatically receive a free KSHC account.</p>

          <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"><span className="h-px flex-1 bg-slate-200" /> or email <span className="h-px flex-1 bg-slate-200" /></div>

          {emailSent ? (
            <div className="rounded-2xl border border-mint-200 bg-mint-50 p-5 text-sm text-slate-700">
              <Mail className="size-5 text-mint-700" /><p className="mt-2 font-extrabold text-slate-950">Check your email</p><p className="mt-1">A secure link was sent to {email}.</p>
            </div>
          ) : (
            <form onSubmit={continueWithEmail} className="space-y-3">
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.com" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
              <button disabled={busy} className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy ? "Sending…" : mode === "signin" ? "Email me a sign-in link" : "Create account with email"}</button>
            </form>
          )}
          {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">KAEC-NG secure account</p><h1 className="mt-2 text-3xl font-black text-slate-950">Welcome back</h1><p className="mt-1 text-sm text-slate-500">{accountEmail}</p></div>
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"><LogOut className="size-4" /> Sign out</button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/assessment" className="rounded-[26px] bg-brand-700 p-6 text-white shadow-lift"><CheckCircle2 className="size-7" /><h2 className="mt-4 text-xl font-black">Start free School Health Check</h2><p className="mt-2 text-sm leading-6 text-brand-100">KSHC remains open whether or not your school is a KHP-OS partner.</p></Link>
          <Link href="/" className="rounded-[26px] border border-slate-200 bg-white p-6"><UserPlus className="size-7 text-slate-700" /><h2 className="mt-4 text-xl font-black text-slate-950">Explore KAEC-NG</h2><p className="mt-2 text-sm leading-6 text-slate-500">Return to the diagnostic platform and Human Potential Development resources.</p></Link>
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Institutional access</p><h2 className="mt-2 text-2xl font-black text-slate-950">Your school partnerships</h2></div></div>
          {partnerships.length === 0 ? (
            <div className="mt-4 rounded-[26px] border border-dashed border-slate-300 bg-white p-7"><Building2 className="size-7 text-slate-500" /><p className="mt-3 font-extrabold text-slate-950">No school partnership is linked yet.</p><p className="mt-2 text-sm leading-6 text-slate-500">Complete KSHC and use the partnership request on the report. KAEC-NG approval is required before KHP-OS becomes available.</p></div>
          ) : (
            <div className="mt-4 grid gap-4">
              {partnerships.map((item) => {
                const copy = statusCopy[item.partnerStatus];
                return <div key={item.organisationId} className="rounded-[26px] border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-lg font-black text-slate-950">{item.name}</p><p className="mt-1 text-sm font-bold text-brand-700">{copy[0]}</p><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{copy[1]}</p></div>{item.partnerStatus === "active" ? <Link href={`/khpos/${item.organisationId}`} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-extrabold text-white">Open KHP-OS <ArrowRight className="size-4" /></Link> : <Link href={`/khpos/partnership/${item.organisationId}`} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-extrabold text-slate-700">View status <ArrowRight className="size-4" /></Link>}</div></div>;
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
