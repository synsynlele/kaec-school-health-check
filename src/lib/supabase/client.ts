import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * KHP-OS browser authentication requires only Supabase's public project URL
 * and publishable key. These values are intentionally safe to ship in the
 * browser bundle; all privileged KHP-OS data access remains server-mediated
 * through SUPABASE_SERVICE_ROLE_KEY, which is never exposed here.
 *
 * Vercel NEXT_PUBLIC_* variables remain the preferred override so the public
 * configuration can be rotated without changing application code.
 */
const KHPOS_SUPABASE_PUBLIC_URL_FALLBACK =
  "https://rlpciatblisxnuuiekkf.supabase.co";
const KHPOS_SUPABASE_PUBLISHABLE_KEY_FALLBACK =
  "sb_publishable_mQdDxi-PTdN5AgpmC8k1Mw_0k5rQ_7u";

function browserConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? KHPOS_SUPABASE_PUBLIC_URL_FALLBACK;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    KHPOS_SUPABASE_PUBLISHABLE_KEY_FALLBACK;
  return { url, key };
}

export function createBrowserSupabaseClient(): SupabaseClient | null {
  const { url, key } = browserConfig();
  if (!url || !key) return null;

  if (!browserClient) {
    browserClient = createSupabaseClient(url, key, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return browserClient;
}

/**
 * Email fallback deliberately uses the implicit passwordless flow.
 * Google remains PKCE-first; this avoids requiring a customised PKCE magic-link template.
 * The callback page imports the returned fragment into the primary persisted session.
 */
export function createEmailLinkSupabaseClient(): SupabaseClient | null {
  const { url, key } = browserConfig();
  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
