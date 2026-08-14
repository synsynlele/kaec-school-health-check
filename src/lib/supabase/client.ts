import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function browserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
