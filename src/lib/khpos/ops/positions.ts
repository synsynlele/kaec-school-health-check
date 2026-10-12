import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export interface SchoolPositions {
  staffId: string | null;
  canManage: boolean;
  canAppointGuardian: boolean;
  activePositions: Array<{ assignmentId: string; roleId: string; roleCode: string; title: string; primary: boolean; campusName: string | null; unitName: string | null; reportsTo: string | null }>;
  appointments: Array<{
    id: string; roleId: string; title: string; status: "pending" | "active" | "ended";
    campusName: string; unitName: string | null; acknowledged: boolean; canAcknowledge: boolean; canManage: boolean;
    blockers: string[];
    charter: { mission: string | null; responsibilities: string[] | null; decisionRights: string[] | null; escalation: string[] | null };
    requiredPolicies: Array<{ code: string; name: string | null; versionId: string | null; published: boolean; acknowledged: boolean }>;
  }>;
}
export class SchoolPositionsError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
let client: SupabaseClient | null = null;
function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new SchoolPositionsError("School positions are not configured.", 503);
  return client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function fail(message: string) {
  throw new SchoolPositionsError(message, /does not exist|not configured/i.test(message) ? 503 : /authority|membership|only|different authorised|outside/i.test(message) ? 403 : 400);
}
export async function getSchoolPositions(org: string, actor: string, staffId: string | null = null): Promise<SchoolPositions> {
  const { data, error } = await service().rpc("khpos_ops_get_role_positions_server", { p_actor: actor, p_org: org, p_staff_id: staffId });
  if (error) fail(error.message);
  if (!data || typeof data !== "object") fail("Positions could not be loaded.");
  return data as SchoolPositions;
}
export async function actOnSchoolPosition(org: string, actor: string, mode: string, input: Record<string, unknown>) {
  const { error } = await service().rpc("khpos_ops_role_position_action_server", { p_actor: actor, p_org: org, p_mode: mode, p_input: input });
  if (error) fail(error.message);
}
