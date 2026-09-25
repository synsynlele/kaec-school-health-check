import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let service: SupabaseClient | undefined;
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("KHP-OS Operations is not configured.");
  return (service ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

export type CultureAction = {
  id: string; action: string; expectedChange: string; ownerAssignmentId: string;
  dueDate: string; status: string; completionNote: string | null;
  completionEvidence: string | null; submittedBy: string | null; isOwner: boolean;
};
export type CultureCase = {
  id: string; campusId: string; learnerId: string | null; category: string;
  summary: string; evidenceReference: string; ownerAssignmentId: string;
  dueDate: string; status: string; responseSummary: string | null;
  verificationNote: string | null; referralReference: string | null;
  isOwner: boolean; canManage: boolean; actions: CultureAction[];
};
export type CultureWorkspace = {
  campuses: { id: string; name: string }[];
  learners: { id: string; name: string; classLabel: string; campusId: string }[];
  assignments: { id: string; title: string; campusId: string | null; isMine: boolean }[];
  cases: CultureCase[];
};
export async function getCulture(org: string, actor: string): Promise<CultureWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_culture_server", {
    p_actor_user_id: actor, p_organisation_id: org,
  });
  if (error) throw new Error(error.message);
  return data as CultureWorkspace;
}
export async function cultureAction(org: string, actor: string, mode: string, input: Record<string, unknown>): Promise<CultureWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_culture_action_server", {
    p_actor_user_id: actor, p_organisation_id: org, p_mode: mode, p_input: input,
  });
  if (error) throw new Error(error.message);
  return data as CultureWorkspace;
}
