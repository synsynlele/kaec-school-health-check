"use client";

import Link from "next/link";
import Image from "next/image";
import { LoadingScreen } from "@/components/navigation/LoadingScreen";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, LogOut, Mail, ShieldCheck, UserPlus } from "lucide-react";
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
  const [state, setState] = useState<"checking" | "signed_out" | "ready">(
    supabase ? "checking" : "signed_out",
  );
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [partnerships, setPartnerships] = useState<KhposPartnerSnapshot[]>([]);
  const [assessments, setAssessments] = useState<Array<{ id: string; schoolName: string; completed: boolean; createdAt: string }>>([]);
  const [sharedReports, setSharedReports] = useState<Array<{ id: string; schoolName: string; completedAt: string | null }>>([]);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState(supabase ? "" : "Account sign-in is not configured.");

  useEffect(() => {
    if (!supabase) return;
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
        assessments?: Array<{ id: string; schoolName: string; completed: boolean; createdAt: string }>;
        sharedReports?: Array<{ id: string; schoolName: string; completedAt: string | null }>;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.account) {
        setError(body.error ?? "Your account could not be loaded.");
        setState(response.status === 401 ? "signed_out" : "ready");
        return;
      }
      setAccountEmail(body.account.email);
      setPartnerships(body.partnerships ?? []);
      setAssessments(body.assessments ?? []);
      setSharedReports(body.sharedReports ?? []);
      const sessionResponse = await fetch("/api/kshc/session", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!sessionResponse.ok) { setError("Could not establish your assessment session. Please sign in again."); setState("ready"); return; }
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
        window.location.replace(next);
        return;
      }
      setState("ready");
    }).catch(() => {
      if (!active) return;
      setLoadFailed(true);
      setError("Your account could not load. Check your connection and try again.");
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  async function continueWithGoogle() {
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/account${window.location.search}`)}`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (authError) throw authError;
    } catch {
      setError("Google sign-in could not start. Please try again.");
      setBusy(false);
    }
  }

  async function continueWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = createEmailLinkSupabaseClient();
    if (!client || !email.trim() || busy) return;
    setBusy(true);
    setError("");
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/account${window.location.search}`)}`;
    try {
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
    } catch {
      setError("Could not send your sign-in link. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/kshc/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Please try signing out again.");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      window.location.replace("/khpos");
    } catch {
      setError("Could not finish signing out. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (state === "checking") {
    return <LoadingScreen />;
  }

  if (loadFailed) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="max-w-md space-y-4 rounded-2xl border bg-white p-6">
        <h1 className="text-xl font-bold">Could not open your account</h1>
        <p role="alert" className="text-sm text-slate-600">{error}</p>
        <button type="button" className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white" onClick={() => window.location.reload()}>Try again</button>
        <Link href="/khpos" className="ml-4 text-sm font-bold text-brand-700 underline">Main entrance</Link>
      </section>
    </main>;
  }

  if (state === "signed_out") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-xl rounded-[32px] border border-slate-200 bg-white p-7 shadow-lift sm:p-10">
          <Link href="/khpos" className="text-sm font-bold text-brand-700">← Back to KHP-OS entrance</Link>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-brand-800">
            <Image src="/khpos-icon-192.png" alt="" width={24} height={24} className="rounded-md" /> KHP-OS · School account
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Sign in or create your account</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Use the email your school invited. New schools can create a free account for the School Health Check and request KHP-OS access after their report. Creating an account does not grant KHP-OS access. School workspaces require partnership approval and an authorised role.
          </p>

          <div className="mt-7 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            {(["signin", "signup"] as const).map((item) => (
              <button key={item} type="button" onClick={() => { setMode(item); setEmailSent(false); setError(""); }} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold ${mode === item ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
                {item === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <button type="button" disabled={busy} onClick={continueWithGoogle} className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 px-5 py-3.5 text-sm font-extrabold text-slate-900 transition hover:bg-slate-50">
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
              <label className="block text-sm font-bold text-slate-700">School email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.com" className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></label>
              <button disabled={busy} className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy ? "Sending…" : mode === "signin" ? "Email me a sign-in link" : "Create account with email"}</button>
            </form>
          )}
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">KAEC-NG secure account</p><h1 className="mt-2 text-3xl font-black text-slate-950">Welcome back</h1><p className="mt-1 text-sm text-slate-500">{accountEmail}</p></div>
          <button disabled={busy} onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"><LogOut className="size-4" /> {busy ? "Signing out…" : "Sign out"}</button>
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {partnerships.some(item=>item.partnerStatus === "active") && <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><h2 className="text-xl font-bold text-slate-950">Continue your work</h2><div className="mt-3 grid gap-3">{partnerships.filter(item=>item.partnerStatus === "active").map(item=><div key={item.organisationId} className="rounded-xl bg-white p-4"><p className="font-bold text-slate-950">{item.name}</p><div className="mt-3 flex flex-wrap gap-3"><Link className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white" href={`/khpos/${item.organisationId}/work`}>Open Today</Link><Link className="rounded-xl border px-4 py-3 text-blue-800" href={`/khpos/${item.organisationId}/onboarding`}>Get started / finish setup</Link></div></div>)}</div></section>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/assessment" className="rounded-[26px] bg-brand-700 p-6 text-white shadow-lift"><CheckCircle2 className="size-7" /><h2 className="mt-4 text-xl font-black">Start free School Health Check</h2><p className="mt-2 text-sm leading-6 text-brand-100">KSHC remains open whether or not your school is a KHP-OS partner.</p></Link>
          <Link href="/" className="rounded-[26px] border border-slate-200 bg-white p-6"><UserPlus className="size-7 text-slate-700" /><h2 className="mt-4 text-xl font-black text-slate-950">Explore KHP-OS</h2><p className="mt-2 text-sm leading-6 text-slate-500">See how the school operations app and School Health Check work together.</p></Link>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Manage your personal data: <Link href="/delete-account" className="font-bold text-brand-700 underline">Request account and associated data deletion</Link>.
        </div>

        <section className="mt-10">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">School Health Check</p><h2 className="mt-2 text-2xl font-black text-slate-950">Your assessments</h2></div>
          {assessments.length === 0 ? <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No assessments created under {accountEmail} yet. School reports shared with your leadership role appear below.</p> : (
            <div className="mt-4 grid gap-3">{assessments.map((item) => <Link key={item.id} href={item.completed ? `/report/${item.id}` : `/assessment?resume=${item.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 hover:border-brand-300"><span><strong className="block text-slate-950">{item.schoolName}</strong><span className="text-sm text-slate-500">{new Date(item.createdAt).toLocaleDateString()} · {item.completed ? "Report ready" : "Continue assessment"}</span></span><ArrowRight className="size-5 text-brand-700" /></Link>)}</div>
          )}
          {sharedReports.length > 0 && <div className="mt-7"><h3 className="text-lg font-black text-slate-950">School reports shared with leadership</h3><p className="mt-1 text-sm text-slate-600">You can read these completed reports through your active school leadership role.</p><div className="mt-3 grid gap-3">{sharedReports.map((report) => <Link key={report.id} href={`/report/${report.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 hover:border-brand-300"><span><strong className="block text-slate-950">{report.schoolName}</strong><span className="text-sm text-slate-500">{report.completedAt ? new Date(report.completedAt).toLocaleDateString() : "Completed"} · View report</span></span><ArrowRight className="size-5 text-brand-700" /></Link>)}</div></div>}
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Institutional access</p><h2 className="mt-2 text-2xl font-black text-slate-950">Your school partnerships</h2></div></div>
          {partnerships.length === 0 ? (
            <div className="mt-4 rounded-[26px] border border-dashed border-slate-300 bg-white p-7"><Building2 className="size-7 text-slate-500" /><p className="mt-3 font-extrabold text-slate-950">No school workspace is linked yet.</p><p className="mt-2 text-sm leading-6 text-slate-500">If you are a staff member, ask your school leader to add this email to your school. Sign in with that same email. If you represent a new school, complete the School Health Check and request a partnership.</p></div>
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
