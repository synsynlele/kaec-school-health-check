"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [message, setMessage] = useState("Completing secure sign-in…");

  useEffect(() => {
    if (!supabase) {
      setMessage("Sign-in is not configured.");
      return;
    }

    const code = searchParams.get("code");
    const rawNext = searchParams.get("next") ?? "/";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");

    let active = true;
    const complete = async () => {
      const result = accessToken && refreshToken
        ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        : code
          ? await supabase.auth.exchangeCodeForSession(code)
          : { error: new Error("Missing authentication response") };

      if (!active) return;
      if (result.error) {
        setMessage("We could not complete sign-in. Please return and try again.");
        return;
      }

      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      router.replace(next);
    };
    void complete();

    return () => {
      active = false;
    };
  }, [router, searchParams, supabase]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
      <div className="text-center">
        <Loader2 className="mx-auto size-9 animate-spin text-mint-400" />
        <h1 className="mt-5 text-xl font-extrabold">KHP-OS | Schools</h1>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
      </div>
    </main>
  );
}
