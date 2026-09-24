"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [message, setMessage] = useState(
    supabase ? "Completing secure sign-in…" : "Sign-in is not configured.",
  );

  useEffect(() => {
    if (!supabase) return;

    const searchParams = new URLSearchParams(window.location.search);
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

      if (next === "/account") {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (token) {
          try {
            const response = await fetch("/api/account", {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            });
            const body = (await response.json()) as {
              ok?: boolean;
              platformAdmin?: { role?: string; status?: string } | null;
            };

            if (
              response.ok &&
              body.ok &&
              body.platformAdmin?.status === "active"
            ) {
              router.replace("/khpos/admin");
              return;
            }
          } catch {
            // If role discovery fails, fall back to the requested account route.
          }
        }
      }

      router.replace(next);
    };
    void complete();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
      <div className="text-center">
        {supabase && <Loader2 className="mx-auto size-9 animate-spin text-mint-400" />}
        <h1 className="mt-5 text-xl font-extrabold">KHP-OS | Schools</h1>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
      </div>
    </main>
  );
}
