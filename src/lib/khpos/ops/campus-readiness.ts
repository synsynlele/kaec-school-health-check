import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let service: SupabaseClient | undefined;
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("KHP-OS Operations is not configured.");
  return (service ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
}
export type CampusReadiness = {
  operatingDate: string;
  campuses: { id: string; name: string; canManage: boolean }[];
  checks: { id: string; campusId: string; operatingDate: string; code: string; status: string; observation: string; evidenceReference: string; resolutionNote: string | null; resolutionEvidence: string | null; verificationNote: string | null; resolvedBy: string | null; events: { id: string; type: string; note: string; evidenceReference: string | null; createdAt: string }[] }[];
};
export async function getCampusReadiness(org: string, actor: string): Promise<CampusReadiness> {
  const { data, error } = await admin().rpc("khpos_ops_get_campus_readiness_server", { p_actor: actor, p_org: org });
  if (error) throw new Error(error.message);
  return data as CampusReadiness;
}
export async function campusReadinessAction(org: string, actor: string, mode: string, input: Record<string, unknown>): Promise<CampusReadiness> {
  const { data, error } = await admin().rpc("khpos_ops_campus_readiness_action_server", { p_actor: actor, p_org: org, p_mode: mode, p_input: input });
  if (error) throw new Error(error.message);
  return data as CampusReadiness;
}
