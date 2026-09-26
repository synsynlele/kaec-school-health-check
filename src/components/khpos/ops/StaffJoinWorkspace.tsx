"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function StaffJoinWorkspace({ token }: { token: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(!!supabase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(supabase ? "" : "Sign-in is not configured.");
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) { setEmail(data.session?.user.email || ""); setLoading(false); } });
    return () => { active = false; };
  }, [supabase]);
  async function signIn() {
    if (!supabase) return;
    setError("");
    const next = `/khpos/join/${token}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (authError) setError("Google sign-in could not start. Please try again.");
  }
  async function switchAccount() {
    if (!supabase) return;
    await fetch("/api/kshc/session", { method: "DELETE" });
    await supabase.auth.signOut();
    setEmail(""); setError("");
  }
  async function join() {
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Sign in to continue.");
      const response = await fetch("/api/khpos/ops/staff-join", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ token }), cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Joining failed.");
      router.replace(`/khpos/${result.organisationId}/people`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Joining failed."); setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-5 text-white"><section className="w-full max-w-lg space-y-5 rounded-2xl border border-white/15 bg-white/5 p-7"><p className="text-xs font-bold uppercase tracking-widest text-mint-300">KHP-OS · Staff access</p><h1 className="text-3xl font-bold">Join your school team</h1><p className="text-sm text-slate-300">Use the Google account with the exact email on your staff appointment. Joining lets you complete onboarding; campus leadership activates your operating role after the required checks.</p>
    {loading ? <p>Checking sign-in…</p> : email ? <><p className="rounded-lg bg-white/10 p-3 text-sm">Signed in as <strong>{email}</strong></p><button type="button" disabled={busy} onClick={() => void join()} className="rounded-lg bg-mint-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">{busy ? "Joining…" : "Join school team"}</button><button type="button" onClick={() => void switchAccount()} className="ml-3 text-sm underline">Use another account</button></> : <button type="button" onClick={() => void signIn()} className="rounded-lg bg-mint-300 px-5 py-3 font-bold text-slate-950">Continue with Google</button>}
    {error && <p role="alert" className="rounded-lg bg-rose-950 p-3 text-sm text-rose-200">{error}</p>}
  </section></main>;
}
