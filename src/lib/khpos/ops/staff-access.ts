import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let service: SupabaseClient | undefined;
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("KHP-OS Operations is not configured.");
  return (service ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
}
export async function issueStaffAccess(org: string, actor: string, staff: string): Promise<{ token: string; expiresAt: string }> {
  const { data, error } = await admin().rpc("khpos_ops_issue_staff_access_server", { p_actor: actor, p_org: org, p_staff: staff });
  if (error) throw new Error(error.message);
  return data as { token: string; expiresAt: string };
}
export async function redeemStaffAccess(actor: string, token: string): Promise<{ organisationId: string; staffId: string }> {
  const { data, error } = await admin().rpc("khpos_ops_redeem_staff_access_server", { p_actor: actor, p_token: token });
  if (error) throw new Error(error.message);
  return data as { organisationId: string; staffId: string };
}
