import { cookies } from "next/headers";
import { bearerTokenFromRequest, verifyKhposAccessToken, type VerifiedKhposUser } from "@/lib/khpos/auth";
import { getAssessmentState } from "@/lib/storage";
import { createClient } from "@supabase/supabase-js";
import type { KhposPartnerSnapshot } from "@/lib/khpos/partnership";

export const KSHC_SESSION_COOKIE = "kshc_session";
const LEADERSHIP_CATEGORIES = ["leadership", "academic_leadership", "skills_leadership", "section_leadership"];

function reportDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

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
  const db = reportDb();
  if (!db) return false;
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
    .in("category", LEADERSHIP_CATEGORIES)
    .in("id", assignments.map((assignment) => assignment.role_id));
  return !rolesError && Boolean(roles?.length);
}

/** Completed school reports for leaders; never includes another school's records. */
export async function listKshcLeadershipReports(userId: string, partnerships: KhposPartnerSnapshot[]) {
  const db = reportDb();
  if (!db) return [];
  const active = partnerships.filter((partner) => partner.partnerStatus === "active" && partner.membershipStatus === "active");
  if (!active.length) return [];
  const eligible = new Set(active.filter((partner) => ["executive", "transformation_lead"].includes(partner.membershipRole)).map((partner) => partner.organisationId));
  const { data: assignments, error: assignmentError } = await db.from("khpos_ops_role_assignments")
    .select("role_id").eq("user_id", userId).eq("status", "active");
  if (assignmentError) throw assignmentError;
  if (assignments?.length) {
    const { data: roles, error: rolesError } = await db.from("khpos_ops_roles")
      .select("organisation_id").eq("status", "active")
      .in("organisation_id", active.map((partner) => partner.organisationId))
      .in("category", LEADERSHIP_CATEGORIES)
      .in("id", assignments.map((assignment) => assignment.role_id));
    if (rolesError) throw rolesError;
    for (const role of roles ?? []) eligible.add(role.organisation_id);
  }
  if (!eligible.size) return [];
  const { data: assessments, error } = await db.from("assessments")
    .select("id,organisation_id,completed_at").in("organisation_id", [...eligible])
    .eq("status", "completed").order("completed_at", { ascending: false }).limit(100);
  if (error) throw error;
  const names = new Map(active.map((partner) => [partner.organisationId, partner.name]));
  return (assessments ?? []).map((assessment) => ({
    id: assessment.id as string,
    schoolName: names.get(assessment.organisation_id as string) ?? "School",
    completedAt: assessment.completed_at as string | null,
  }));
}
