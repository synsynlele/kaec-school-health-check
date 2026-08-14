"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  Building2,
  CheckCircle2,
  CircleAlert,
  Gauge,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRoundCog,
  Users,
} from "lucide-react";
import {
  createBrowserSupabaseClient,
  createEmailLinkSupabaseClient,
} from "@/lib/supabase/client";
import type {
  KhposAdminDashboard,
  KhposPlatformRole,
} from "@/lib/khpos/platform-admin";

const roleLabel: Record<KhposPlatformRole, string> = {
  super_admin: "Super Admin",
  portfolio_admin: "Portfolio Admin",
  support_reviewer: "Support Reviewer",
};

const attentionLabel: Record<string, string> = {
  baseline_required: "Baseline required",
  regression: "Regression detected",
  critical_priorities: "Critical priorities",
  reassessment_required: "Reassessment required",
  monitor: "Monitor",
};

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

export function AdminConsoleWorkspace() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [dashboard, setDashboard] = useState<KhposAdminDashboard | null>(null);
  const [state, setState] = useState<"checking" | "signed_out" | "ready" | "denied">(
    supabase ? "checking" : "denied",
  );
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [targetRole, setTargetRole] = useState<KhposPlatformRole>("portfolio_admin");
  const [governanceAction, setGovernanceAction] = useState<"grant" | "reactivate" | "suspend">("grant");
  const [reason, setReason] = useState("");
  const [mfaSetup, setMfaSetup] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

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
      const response = await fetch("/api/khpos/admin", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        dashboard?: KhposAdminDashboard;
        error?: string;
      };
      if (!active) return;
      if (!response.ok || !body.ok || !body.dashboard) {
        setError(body.error ?? "Admin Console could not be loaded.");
        setState(response.status === 401 ? "signed_out" : "denied");
        return;
      }
      setDashboard(body.dashboard);
      setState("ready");
      setError("");
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  async function signInGoogle() {
    if (!supabase) return;
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/khpos/admin")}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (authError) setError("Google sign-in could not start. Please try again.");
  }

  async function signInEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = createEmailLinkSupabaseClient();
    if (!client || !email.trim()) return;
    setBusy("email");
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/khpos/admin")}`;
    const { error: authError } = await client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo, shouldCreateUser: false },
    });
    setBusy("");
    if (authError) {
      setError("The secure sign-in link could not be sent.");
      return;
    }
    setEmailSent(true);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function startMfaEnrollment() {
    if (!supabase) return;
    setBusy("mfa-enroll");
    setError("");
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "KHP-OS Platform Admin",
    });
    setBusy("");
    if (enrollError) {
      setError(enrollError.message);
      return;
    }
    setMfaSetup({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verifyMfa() {
    if (!supabase || !mfaCode.trim()) return;
    setBusy("mfa-verify");
    setError("");
    let factorId = mfaSetup?.factorId ?? "";
    if (!factorId) {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setBusy("");
        setError(listError.message);
        return;
      }
      factorId = data.totp.find((factor) => factor.status === "verified")?.id ?? "";
    }
    if (!factorId) {
      setBusy("");
      setError("No verified authenticator factor is available. Set one up first.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: mfaCode.trim(),
    });
    if (verifyError) {
      setBusy("");
      setError("That authenticator code could not be verified.");
      return;
    }
    await supabase.auth.refreshSession();
    window.location.reload();
  }

  async function applyGovernanceChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !dashboard) return;
    setBusy("governance");
    setError("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusy("");
      setState("signed_out");
      return;
    }
    const response = await fetch("/api/khpos/admin", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: governanceAction,
        targetEmail: targetEmail.trim().toLowerCase(),
        role: targetRole,
        reason: reason.trim(),
      }),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      dashboard?: KhposAdminDashboard;
      error?: string;
    };
    setBusy("");
    if (!response.ok || !body.ok || !body.dashboard) {
      setError(body.error ?? "Platform access could not be changed.");
      return;
    }
    setDashboard(body.dashboard);
    setTargetEmail("");
    setReason("");
  }

  if (state === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="size-9 animate-spin text-mint-300" />
      </main>
    );
  }

  if (state === "signed_out") {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-[32px] border border-white/10 bg-white/5 p-7 shadow-2xl sm:p-10">
          <ShieldCheck className="size-10 text-mint-300" />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-mint-300">
            KHP-OS | KAEC-NG Platform Administration
          </p>
          <h1 className="mt-2 text-3xl font-black">Sign in to the Admin Console</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Authentication alone does not grant access. Your verified KHP-OS identity must also be explicitly authorised as a Platform Administrator.
          </p>
          <button
            type="button"
            onClick={() => void signInGoogle()}
            className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-slate-950"
          >
            <GoogleMark /> Continue with Google
          </button>
          <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            <span className="h-px flex-1 bg-white/10" /> secure fallback <span className="h-px flex-1 bg-white/10" />
          </div>
          {emailSent ? (
            <div className="rounded-2xl border border-mint-400/30 bg-mint-400/10 p-4 text-sm text-mint-100">
              Check your email for the secure sign-in link.
            </div>
          ) : (
            <form onSubmit={signInEmail} className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="authorised@email.com"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={busy === "email"}
                className="rounded-xl bg-mint-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {busy === "email" ? "Sending…" : "Email link"}
              </button>
            </form>
          )}
          {error && <p className="mt-4 text-sm font-semibold text-red-300">{error}</p>}
        </div>
      </main>
    );
  }

  if (!dashboard || state === "denied") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <LockKeyhole className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">Platform access not authorised</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-950"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const { console, portfolio } = dashboard;
  const summary = console.summary;
  const governanceUnlocked = console.session.governanceChangesUnlocked;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="text-xs font-bold text-slate-300 hover:text-white">
              KSHC / KHP-OS
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-black"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-mint-300">
                KHP-OS | KAEC-NG Admin Console
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                Institutional transformation at portfolio level.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                Monitor institutional health, transformation queues, integrations and governance without entering learner-level or evidence-file surveillance.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Signed in as</p>
              <p className="mt-1 font-black">{console.admin.email}</p>
              <p className="mt-1 text-xs text-mint-300">{roleLabel[console.admin.role]}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Active institutions", summary.activeInstitutions],
            ["Verified improvement", summary.verifiedImprovementInstitutions],
            ["Active priorities", summary.activePriorities],
            ["Reviews due", summary.reviewsDue],
            ["Awaiting decisions", summary.reviewsAwaitingDecision],
            ["Evidence attention", summary.evidenceNeedsAttention],
            ["Integrations attention", summary.integrationsNeedAttention],
            ["Reassessments active", summary.reassessmentsInProgress],
          ].map(([label, value]) => (
            <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Security posture</p>
                <h2 className="mt-2 text-2xl font-black">Administrator assurance</h2>
              </div>
              <KeyRound className="size-7 text-brand-700" />
            </div>
            {console.session.aal === "aal2" ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-2 font-black text-emerald-800">
                  <CheckCircle2 className="size-5" /> MFA verified for this session
                </div>
                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  AAL2 is active. Super Admin governance changes are unlocked for this session.
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center gap-2 font-black text-amber-900">
                  <CircleAlert className="size-5" /> MFA verification required for access changes
                </div>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Monitoring remains available. Granting or suspending platform administrators stays locked until this session reaches AAL2.
                </p>
                {!console.admin.mfaEnrolled && !mfaSetup && (
                  <button
                    type="button"
                    disabled={busy === "mfa-enroll"}
                    onClick={() => void startMfaEnrollment()}
                    className="mt-4 rounded-full bg-slate-950 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50"
                  >
                    {busy === "mfa-enroll" ? "Preparing…" : "Set up authenticator MFA"}
                  </button>
                )}
                {mfaSetup && (
                  <div className="mt-5 rounded-2xl bg-white p-5">
                    <p className="text-sm font-black text-slate-900">Scan with your authenticator app</p>
                    <Image
                      src={mfaSetup.qrCode}
                      alt="KHP-OS administrator MFA QR code"
                      width={180}
                      height={180}
                      unoptimized
                      className="mt-4 rounded-xl border border-slate-200"
                    />
                    <p className="mt-3 break-all text-xs text-slate-500">Manual secret: {mfaSetup.secret}</p>
                  </div>
                )}
                {(console.admin.mfaEnrolled || mfaSetup) && (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value)}
                      placeholder="6-digit authenticator code"
                      className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy === "mfa-verify" || !mfaCode.trim()}
                      onClick={() => void verifyMfa()}
                      className="rounded-xl bg-amber-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                    >
                      {busy === "mfa-verify" ? "Verifying…" : "Verify MFA"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[30px] bg-slate-950 p-6 text-white sm:p-8">
            <Gauge className="size-7 text-mint-300" />
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-mint-300">Portfolio intelligence</p>
            <h2 className="mt-2 text-2xl font-black">{portfolio.summary.activeInstitutions} institutions under transformation oversight</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Portfolio Intelligence identifies where support is needed without exposing schools to one another or creating public rankings.
            </p>
            <Link
              href="/khpos/portfolio"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              <Building2 className="size-4" /> Open Portfolio Intelligence
            </Link>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Institutions needing attention</p>
            <h2 className="mt-2 text-2xl font-black">Transformation portfolio pulse</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {portfolio.institutions.length === 0 ? (
              <p className="p-8 text-sm text-slate-500">No institution has activated KHP-OS yet.</p>
            ) : (
              portfolio.institutions.slice(0, 10).map((institution) => (
                <div key={institution.organisationId} className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black">{institution.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Current score {institution.currentOverallScore ?? "—"} · {institution.activePriorityCount} active priorities
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${institution.attention === "monitor" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                    {attentionLabel[institution.attention] ?? institution.attention}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Platform access governance</p>
                <h2 className="mt-2 text-2xl font-black">Administrators</h2>
              </div>
              <Users className="size-7 text-brand-700" />
            </div>
            <div className="mt-5 space-y-3">
              {console.admins.map((entry) => (
                <div key={entry.userId} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black">{entry.email}</p>
                      <p className="mt-1 text-xs text-slate-500">{roleLabel[entry.role]} · {entry.status}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black ${entry.mfaEnrolled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                      {entry.mfaEnrolled ? "MFA enrolled" : "MFA pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {console.admin.canManageAdmins && (
              <form onSubmit={applyGovernanceChange} className="mt-6 space-y-3 rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-black">Approve a platform-access change</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="email"
                    required
                    value={targetEmail}
                    onChange={(event) => setTargetEmail(event.target.value)}
                    placeholder="Existing KHP-OS user email"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                  <select
                    value={targetRole}
                    onChange={(event) => setTargetRole(event.target.value as KhposPlatformRole)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  >
                    <option value="portfolio_admin">Portfolio Admin</option>
                    <option value="support_reviewer">Support Reviewer</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <select
                    value={governanceAction}
                    onChange={(event) => setGovernanceAction(event.target.value as "grant" | "reactivate" | "suspend")}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  >
                    <option value="grant">Grant / update access</option>
                    <option value="reactivate">Reactivate access</option>
                    <option value="suspend">Suspend access</option>
                  </select>
                  <input
                    required
                    minLength={12}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Governance reason (12+ characters)"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!governanceUnlocked || busy === "governance"}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UserRoundCog className="size-4" />
                  {busy === "governance" ? "Applying…" : governanceUnlocked ? "Approve access change" : "Verify MFA to unlock"}
                </button>
              </form>
            )}
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Platform audit</p>
                <h2 className="mt-2 text-2xl font-black">Recent governance events</h2>
              </div>
              <Activity className="size-7 text-brand-700" />
            </div>
            <div className="mt-5 space-y-3">
              {console.recentEvents.length === 0 ? (
                <p className="text-sm text-slate-500">No platform governance events yet.</p>
              ) : (
                console.recentEvents.map((event) => (
                  <article key={event.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-black">{event.eventType.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {event.actorEmail ?? "System"}{event.targetEmail ? ` → ${event.targetEmail}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{new Date(event.createdAt).toLocaleString()}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
          <ShieldCheck className="size-8 text-mint-300" />
          <h2 className="mt-4 text-xl font-black">Platform governance is separate from school authority.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            Platform administrators can monitor institutional transformation and govern KHP-OS access. They do not automatically become school executives, approve a school&apos;s priorities, alter reassessments, or access learner-level PipuPath data.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-xs font-black"
          >
            <RefreshCw className="size-4" /> Refresh console
          </button>
        </section>
      </div>
    </main>
  );
}
