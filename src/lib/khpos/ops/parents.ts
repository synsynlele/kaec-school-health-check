import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let service: SupabaseClient | undefined;
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("KHP-OS Operations is not configured.");
  return (service ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}
export type ParentCase = {
  id: string; campusId: string; learnerId: string | null; parentReference: string;
  category: string; channel: string; summary: string; ownerAssignmentId: string;
  dueDate: string; status: string; responseSummary: string | null;
  responseEvidence: string | null; responseBy: string | null;
  escalationReason: string | null; closureNote: string | null;
  isOwner: boolean; canManage: boolean; isGuardian: boolean;
  events: { id: string; type: string; channel: string | null; note: string; evidenceReference: string | null; createdAt: string }[];
};
export type ParentWorkspace = {
  campuses: { id: string; name: string }[];
  learners: { id: string; name: string; classLabel: string; campusId: string }[];
  assignments: { id: string; title: string; campusId: string | null; isMine: boolean }[];
  cases: ParentCase[];
};
export async function getParentCases(org: string, actor: string): Promise<ParentWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_parent_cases_server", { p_actor: actor, p_org: org });
  if (error) throw new Error(error.message);
  return data as ParentWorkspace;
}
export async function parentCaseAction(org: string, actor: string, mode: string, input: Record<string, unknown>): Promise<ParentWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_parent_case_action_server", { p_actor: actor, p_org: org, p_mode: mode, p_input: input });
  if (error) throw new Error(error.message);
  return data as ParentWorkspace;
}
