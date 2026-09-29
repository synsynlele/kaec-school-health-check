import { cookies } from "next/headers";
import { bearerTokenFromRequest, verifyKhposAccessToken, type VerifiedKhposUser } from "@/lib/khpos/auth";
import { getAssessmentState } from "@/lib/storage";
import { createClient } from "@supabase/supabase-js";

export const KSHC_SESSION_COOKIE = "kshc_session";

export async function kshcUserFromRequest(request: Request): Promise<VerifiedKhposUser | null> {
  const token = bearerTokenFromRequest(request) ?? (await cookies()).get(KSHC_SESSION_COOKIE)?.value;
  if (!token) return null;
  try { return await verifyKhposAccessToken(token); } catch { return null; }
}

export async function kshcUserFromCookie(): Promise<VerifiedKhposUser | null> {
  const token = (await cookies()).get(KSHC_SESSION_COOKIE)?.value;
  if (!token) return null;
  try { return await verifyKhposAccessToken(token); } catch { return null; }
}

export async function canAccessKshcAssessment(id: string, email: string): Promise<boolean> {
  const state = await getAssessmentState(id);
  return Boolean(state && state.school.email.trim().toLowerCase() === email.trim().toLowerCase());
}

/** Report readers have a wider scope than assessment editors. */
export async function canAccessKshcReport(id: string, user: VerifiedKhposUser): Promise<boolean> {
  if (await canAccessKshcAssessment(id, user.email)) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: assessment, error } = await db.from("assessments")
    .select("organisation_id").eq("id", id).maybeSingle();
  if (error || !assessment?.organisation_id) return false;
  const orgId = assessment.organisation_id as string;
  const [{ data: organisation, error: orgError }, { data: membership, error: memberError }] = await Promise.all([
    db.from("organisations").select("partner_status").eq("id", orgId).maybeSingle(),
    db.from("organisation_memberships").select("role").eq("organisation_id", orgId)
      .eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  if (orgError || memberError || organisation?.partner_status !== "active" || !membership) return false;
  if (["executive", "transformation_lead"].includes(membership.role)) return true;
  const { data: assignments, error: assignmentError } = await db.from("khpos_ops_role_assignments")
    .select("role_id").eq("user_id", user.id).eq("status", "active");
  if (assignmentError || !assignments?.length) return false;
  const { data: roles, error: rolesError } = await db.from("khpos_ops_roles").select("id")
    .eq("organisation_id", orgId).eq("status", "active")
    .in("code", ["SCHOOL_CUSTODIAN", "SCHOOL_GUARDIAN", "VISION_CUSTODIAN"])
    .in("id", assignments.map((assignment) => assignment.role_id));
  return !rolesError && Boolean(roles?.length);
}
