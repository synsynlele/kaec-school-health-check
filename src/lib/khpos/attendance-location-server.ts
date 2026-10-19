import { createClient } from "@supabase/supabase-js";
import { KhposPresenceError } from "@/lib/khpos/ops/presence";
import { getSchoolDesk } from "@/lib/khpos/hq-schools";
import type { VerifiedKhposUser } from "@/lib/khpos/auth";
import type { AttendanceLocation, CampusLocation } from "./attendance-location";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new KhposPresenceError("Attendance location service is unavailable.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function campusLocations(user: VerifiedKhposUser, school: string, hq: boolean, input?: Record<string, unknown>): Promise<CampusLocation[]> {
  if (hq) {
    const desk = await getSchoolDesk(user);
    if (!desk.engagements.some(e => e.organisation_id === school && e.engagement_status === "active"))
      throw new KhposPresenceError("School is outside your assigned HQ scope.", 403);
  }
  if (input) {
    const { error } = await db().rpc("khpos_attendance_campus_save_server", {
      p_actor: user.id, p_school: school, p_hq: hq, p_input: input,
    });
    if (error) throw new KhposPresenceError(error.message, /only|authorised|membership|scope/i.test(error.message) ? 403 : 400);
  }
  const { data, error } = await db().rpc("khpos_attendance_campuses_server", { p_actor: user.id, p_school: school, p_hq: hq });
  if (error) throw new KhposPresenceError(error.message, /only|authorised|membership|scope/i.test(error.message) ? 403 : 400);
  return data as CampusLocation[];
}
export async function evaluateAttendanceLocation(input: unknown, campus: string | null): Promise<AttendanceLocation> {
  const { data, error } = await db().rpc("khpos_attendance_location_evaluate_server", { p_input: input ?? null, p_campus: campus });
  if (error) throw new KhposPresenceError(error.message);
  return data as AttendanceLocation;
}
