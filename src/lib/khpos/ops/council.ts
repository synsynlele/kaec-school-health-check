import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("KHP-OS Operations is not configured.");
  return (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

export type CouncilCandidate = {
  id: string; learnerId: string; status: string; nominationStatement: string;
  nominationEvidence: string; eligibilityNote: string | null;
  studentVoiceSummary: string | null; studentVoiceEvidence: string | null;
  reviews: { id: string; type: string; finding: string; decision: string; createdAt: string }[];
};
export type CouncilWorkspace = {
  canManage: boolean;
  campuses: { id: string; name: string }[];
  learners: { id: string; name: string; classLabel: string; campusId: string }[];
  assignments: { id: string; title: string }[];
  cycles: { id: string; campusId: string; sessionLabel: string; status: string; seats: {
    id: string; title: string; seatType: string; classLabel: string | null;
    mission: string; status: string; candidates: CouncilCandidate[];
  }[] }[];
};

export async function getCouncil(org: string, actor: string): Promise<CouncilWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_council_server", {
    p_actor_user_id: actor, p_organisation_id: org,
  });
  if (error) throw new Error(error.message);
  return data as CouncilWorkspace;
}

export async function councilAction(org: string, actor: string, mode: string, input: Record<string, unknown>): Promise<CouncilWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_council_action_server", {
    p_actor_user_id: actor, p_organisation_id: org, p_mode: mode, p_input: input,
  });
  if (error) throw new Error(error.message);
  return data as CouncilWorkspace;
}
