"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createBrowserSupabaseClient, createEmailLinkSupabaseClient } from "@/lib/supabase/client";

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

export function ActivationFlow({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [state, setState] = useState<"checking" | "signed_out" | "claiming" | "error">("checking");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  const claim = useCallback(
    async (accessToken: string) => {
      setState("claiming");
      setError("");
      try {
        const response = await fetch(`/api/khpos/claim/${assessmentId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = (await response.json()) as {
          ok?: boolean;
          organisationId?: string;
          error?: string;
        };
        if (!response.ok || !body.ok || !body.organisationId) {
          throw new Error(body.error ?? "KHP-OS activation failed.");
        }
        router.replace(`/khpos/${body.organisationId}`);
      } catch (claimError) {
        setError(claimError instanceof Error ? claimError.message : "KHP-OS activation failed.");
        setState("error");
      }
    },
    [assessmentId, router],
  );

  useEffect(() => {
    if (!supabase) {
      setError("KHP-OS sign-in is not configured yet.");
      setState("error");
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.access_token) {
        void claim(data.session.access_token);
      } else {
        setState("signed_out");
      }
    });

    return () => {
      active = false;
    };
  }, [claim, supabase]);

  async function continueWithGoogle() {
    if (!supabase) return;
    setError("");
    const next = `/activate/${assessmentId}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (authError) {
      setError("Google sign-in could not start. Please try again.");
      setState("error");
    }
  }

  async function continueWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    const emailClient = createEmailLinkSupabaseClient();
    if (!emailClient) {
      setError("Email sign-in is not configured yet.");
      setState("error");
      return;
    }
    setEmailBusy(true);
    setError("");
    const next = `/activate/${assessmentId}`;
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await emailClient.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo, shouldCreateUser: true },
    });
    setEmailBusy(false);
    if (authError) {
      setError("We could not send the sign-in link. Please try again.");
      setState("error");
      return;
    }
    setEmailSent(true);
  }

  const busy = state === "checking" || state === "claiming";

  return (
    <div className="mx-auto grid min-h-[calc(100vh-68px)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
      <section>
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand-800">
          <ShieldCheck className="size-4" /> KHP-OS | Schools
        </div>
        <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          Your school health report was the diagnosis. Now begin the transformation.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
          Activate a secure institutional workspace where this KSHC baseline becomes the first record in your school&apos;s improvement journey.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["Baseline preserved", "Your completed KSHC becomes institutional history."],
            ["Secure ownership", "Only the verified assessment email can activate it."],
            ["One improvement loop", "Diagnosis flows into priorities, action, evidence and review."],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <CheckCircle2 className="size-5 text-mint-600" />
              <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-lift sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-950 text-white">
            <LockKeyhole className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">Activate your school workspace</h2>
            <p className="mt-1 text-sm text-slate-500">Use the same email entered during this KSHC assessment.</p>
          </div>
        </div>

        {busy ? (
          <div className="mt-8 flex min-h-48 flex-col items-center justify-center rounded-2xl bg-slate-50 text-center">
            <Loader2 className="size-8 animate-spin text-brand-700" />
            <p className="mt-4 text-sm font-bold text-slate-800">
              {state === "claiming" ? "Securing your KHP-OS workspace…" : "Checking your sign-in…"}
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={continueWithGoogle}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-extrabold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"
            >
              <GoogleMark /> Continue with Google <ArrowRight className="size-4" />
            </button>
            <p className="mt-3 text-center text-xs font-medium text-slate-400">
              Recommended for the fastest and most secure activation.
            </p>

            <div className="my-7 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> or use email <span className="h-px flex-1 bg-slate-200" />
            </div>

            {emailSent ? (
              <div className="rounded-2xl border border-mint-200 bg-mint-50 p-5">
                <Mail className="size-5 text-mint-700" />
                <p className="mt-2 text-sm font-bold text-slate-900">Check your email</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  We sent a secure sign-in link to <span className="font-semibold">{email}</span>.
                </p>
              </div>
            ) : (
              <form onSubmit={continueWithEmail} className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="activation-email">
                  Email fallback
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="activation-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="school@email.com"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  />
                  <button
                    type="submit"
                    disabled={emailBusy}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {emailBusy ? "Sending…" : "Email me a link"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700">
            {error}
            {state === "error" && (
              <button type="button" className="ml-2 font-extrabold underline" onClick={() => setState("signed_out")}>
                Try another account
              </button>
            )}
          </div>
        )}

        <p className="mt-7 text-center text-[11px] leading-5 text-slate-400">
          Google sign-in creates an account automatically for first-time users and signs returning users into the same KHP-OS identity.
        </p>
      </section>
    </div>
  );
}
