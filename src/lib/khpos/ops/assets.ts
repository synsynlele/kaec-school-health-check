import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let service: SupabaseClient | undefined;
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("KHP-OS Operations is not configured.");
  return (service ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
}
export type AssetService = {
  id: string; status: string; note: string; evidenceReference: string; submittedBy: string;
  submittedAt: string; reviewNote: string | null; nextDueDate: string | null;
  events: { id: string; type: string; note: string; evidenceReference: string | null; createdAt: string }[];
};
export type CampusAsset = {
  id: string; campusId: string; code: string; label: string; category: string; location: string; ownerRoleTitle: string;
  intervalDays: number; nextServiceDate: string; status: string; retirementNote: string | null;
  services: AssetService[];
  issues: { id: string; status: string; severity: string; title: string; dueAt: string; createdAt: string }[];
};
export type AssetsWorkspace = { today: string; campuses: { id: string; name: string; canManage: boolean }[]; assets: CampusAsset[] };
export async function getAssets(org: string, actor: string): Promise<AssetsWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_assets_server", { p_actor: actor, p_org: org });
  if (error) throw new Error(error.message);
  return data as AssetsWorkspace;
}
export async function assetAction(org: string, actor: string, mode: string, input: Record<string, unknown>): Promise<AssetsWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_asset_action_server", { p_actor: actor, p_org: org, p_mode: mode, p_input: input });
  if (error) throw new Error(error.message);
  return data as AssetsWorkspace;
}
