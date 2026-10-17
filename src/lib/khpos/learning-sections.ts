import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LearningStage } from "./learning-stages";
export type LearningSection = {
  id: string;
  campusId: string;
  name: string;
  stage: LearningStage;
  status: string;
  updatedAt: string;
  canManage: boolean;
};
export type LearningSections = {
  campuses: { id: string; name: string; canManage: boolean }[];
  items: LearningSection[];
};
let client: SupabaseClient | null = null;
function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Learning sections are not configured.");
  return (client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}
export async function getLearningSections(
  actor: string,
  school: string,
): Promise<LearningSections> {
  const { data, error } = await service().rpc(
    "khpos_learning_sections_server",
    { p_actor: actor, p_school: school },
  );
  if (error) throw new Error(error.message);
  return data as LearningSections;
}
export async function saveLearningSection(
  actor: string,
  school: string,
  input: Record<string, unknown>,
) {
  const { error } = await service().rpc(
    "khpos_learning_section_action_server",
    { p_actor: actor, p_school: school, p_input: input },
  );
  if (error) throw new Error(error.message);
}
