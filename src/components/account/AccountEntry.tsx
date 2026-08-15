"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AccountAccess } from "@/components/account/AccountAccess";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Resolve the destination after a successful account sign-in.
 *
 * Platform administration and school membership are deliberately separate
 * authorities. We therefore ask the existing server-authorised Admin API
 * whether the signed-in user has active platform access. Platform admins go
 * straight to the KAEC-NG Admin Console; everyone else remains in the school
 * account experience.
 */
export function AccountEntry() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [resolvingDestination, setResolvingDestination] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!active) return;

      if (!token) {
        setResolvingDestination(false);
        return;
      }

      try {
        const response = await fetch("/api/khpos/admin", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (!active) return;
        if (response.ok) {
          router.replace("/khpos/admin");
          return;
        }
      } catch {
        // A failed platform-access probe must never block the ordinary KSHC account.
      }

      if (active) setResolvingDestination(false);
    });

    return () => {
      active = false;
    };
  }, [router, supabase]);

  if (resolvingDestination) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-brand-700" />
          <p className="mt-3 text-sm font-semibold text-slate-500">Opening your KAEC-NG workspace…</p>
        </div>
      </main>
    );
  }

  return <AccountAccess />;
}
