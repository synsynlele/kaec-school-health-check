import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let service: SupabaseClient | undefined;
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("KHP-OS Operations is not configured.");
  return (service ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}
export type SafeguardingWorkspace = {
  campuses: { id: string; name: string; canConfigure: boolean; isDesignated: boolean; configured: boolean }[];
  learners: { id: string; name: string; campusId: string }[];
  eligibleAssignments: { id: string; role: string; campusId: string | null; userId: string; name: string }[];
  contacts: { campusId: string; leadName: string; leadEmail: string; deputyName: string; deputyEmail: string }[];
  designations: { campusId: string; leadAssignmentId: string; deputyAssignmentId: string }[];
  cases: { id: string; campusId: string; learnerId: string | null; category: string; urgency: string;
    reportedFacts: string; immediateProtection: string; status: string; reportedAt: string;
    triageProtection: string | null; referralDecision: string | null; reviewDueAt: string | null;
    closureNote: string | null; steps: { id: string; type: string; actionTaken: string; evidenceReference: string | null; occurredAt: string }[];
  }[];
};
export async function getSafeguarding(org: string, actor: string): Promise<SafeguardingWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_safeguarding_server", {
    p_actor_user_id: actor, p_organisation_id: org,
  });
  if (error) throw new Error(error.message);
  return data as SafeguardingWorkspace;
}
export async function safeguardingAction(org: string, actor: string, mode: string, input: Record<string, unknown>) {
  const { data, error } = await admin().rpc("khpos_ops_safeguarding_action_server", {
    p_actor_user_id: actor, p_organisation_id: org, p_mode: mode, p_input: input,
  });
  if (error) throw new Error(error.message);
  return data as { receiptId?: string; accepted?: boolean; ok?: boolean };
}
