import { cookies } from "next/headers";
import { bearerTokenFromRequest, verifyKhposAccessToken, type VerifiedKhposUser } from "@/lib/khpos/auth";
import { getAssessmentState } from "@/lib/storage";
import { createClient } from "@supabase/supabase-js";
import type { KhposPartnerSnapshot } from "@/lib/khpos/partnership";

export const KSHC_SESSION_COOKIE = "kshc_session";

/**
 * A current, independently appointed leadership position—not an ordinary
 * school membership or ownership of the original assessment—authorises
 * reading an active partner school's School Health Report.
 *
 * Teachers with a SECOND active leadership position remain leaders for
 * this purpose. A TEACHER-only or SKILLS_FACILITATOR-only member does not.
 */
export const KSHC_REPORT_LEADERSHIP_CATEGORIES = [
  "leadership",
  "academic_leadership",
  "skills_leadership",
  "section_leadership",
] as const;

const LEADERSHIP_CATEGORIES: string[] = [...KSHC_REPORT_LEADERSHIP_CATEGORIES];

function reportDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
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

/** Active appointment + active school membership + active partnership, all in the SAME school. */
export async function canViewKshcLinkedSchoolReport(
  organisationId: string,
  userId: string,
): Promise<boolean> {
  const db = reportDb();
  if (!db) return false;

  const [{ data: organisation, error: orgError }, { data: member, error: memberError }] = await Promise.all([
    db.from("organisations").select("id,status,partner_status").eq("id", organisationId).maybeSingle(),
    db.from("organisation_memberships").select("user_id").eq("organisation_id", organisationId)
      .eq("user_id", userId).eq("status", "active").maybeSingle(),
  ]);
  if (orgError || memberError || organisation?.status !== "active" || organisation.partner_status !== "active" || !member) return false;

  const { data: assignments, error: assignmentError } = await db.from("khpos_ops_role_assignments")
    .select("role_id").eq("user_id", userId).eq("status", "active");
  if (assignmentError || !assignments?.length) return false;

  const { data: leadershipRoles, error: roleError } = await db.from("khpos_ops_roles")
    .select("id").eq("organisation_id", organisationId).eq("status", "active")
    .in("category", LEADERSHIP_CATEGORIES)
    .in("id", assignments.map((assignment) => assignment.role_id));
  return !roleError && Boolean(leadershipRoles?.length);
}

/**
 * An unlinked, standalone free School Health Check is still viewable by its
 * verified original account. Once an assessment belongs to a partner school,
 * only that school's active leadership positions can view its report.
 * Crucially, owning the assessment email does NOT bypass the school policy.
 */
export async function canAccessKshcReport(id: string, user: VerifiedKhposUser): Promise<boolean> {
  const db = reportDb();
  if (!db) return false;
  const { data: assessment, error } = await db.from("assessments")
    .select("organisation_id").eq("id", id).maybeSingle();
  if (error || !assessment) return false;
  if (assessment.organisation_id) {
    return canViewKshcLinkedSchoolReport(assessment.organisation_id as string, user.id);
  }
  return canAccessKshcAssessment(id, user.email);
}

/** Find schools where this member holds at least one CURRENT leadership appointment. */
async function leadershipSchoolIds(
  userId: string,
  partnerships: KhposPartnerSnapshot[],
): Promise<Set<string>> {
  const eligible = new Set<string>();
  const active = partnerships.filter(
    (partner) => partner.partnerStatus === "active" && partner.membershipStatus === "active",
  );
  if (!active.length) return eligible;
  const db = reportDb();
  if (!db) return eligible;
  const { data: assignments, error: assignmentError } = await db.from("khpos_ops_role_assignments")
    .select("role_id").eq("user_id", userId).eq("status", "active");
  if (assignmentError) throw assignmentError;
  if (!assignments?.length) return eligible;
  const { data: roles, error: rolesError } = await db.from("khpos_ops_roles")
    .select("organisation_id").eq("status", "active")
    .in("organisation_id", active.map((partner) => partner.organisationId))
    .in("category", LEADERSHIP_CATEGORIES)
    .in("id", assignments.map((assignment) => assignment.role_id));
  if (rolesError) throw rolesError;
  for (const role of roles ?? []) eligible.add(role.organisation_id);
  return eligible;
}

export interface KshcOwnedAssessment {
  id: string;
  schoolName: string;
  completed: boolean;
  createdAt: string;
}

/**
 * Remove restricted completed partner-school reports from the owner's /account
 * listing. Leave incomplete assessments and standalone/unlinked free KSHC
 * reports untouched. This is only a UI/listing filter; direct URLs are
 * independently denied by canAccessKshcReport.
 */
export async function filterKshcOwnedAssessments(
  userId: string,
  partnerships: KhposPartnerSnapshot[],
  assessments: KshcOwnedAssessment[],
): Promise<KshcOwnedAssessment[]> {
  const completedIds = assessments.filter((item) => item.completed).map((item) => item.id);
  if (!completedIds.length) return assessments;
  const db = reportDb();
  if (!db) return assessments.filter((item) => !item.completed);
  const [eligible, result] = await Promise.all([
    leadershipSchoolIds(userId, partnerships),
    db.from("assessments").select("id,organisation_id").in("id", completedIds),
  ]);
  if (result.error) throw result.error;
  const ownership = new Map((result.data ?? []).map((item) => [item.id as string, item.organisation_id as string | null]));
  return assessments.filter((item) => {
    if (!item.completed) return true;
    if (!ownership.has(item.id)) return false;
    const schoolId = ownership.get(item.id);
    return !schoolId || eligible.has(schoolId);
  });
}

/** Completed reports for appointed school leaders, scoped to active school memberships. */
export async function listKshcLeadershipReports(userId: string, partnerships: KhposPartnerSnapshot[]) {
  const db = reportDb();
  if (!db) return [];
  const eligible = await leadershipSchoolIds(userId, partnerships);
  if (!eligible.size) return [];
  const { data: assessments, error } = await db.from("assessments")
    .select("id,organisation_id,completed_at").in("organisation_id", [...eligible])
    .eq("status", "completed").order("completed_at", { ascending: false }).limit(100);
  if (error) throw error;
  const names = new Map(partnerships.map((partner) => [partner.organisationId, partner.name]));
  return (assessments ?? []).map((assessment) => ({
    id: assessment.id as string,
    schoolName: names.get(assessment.organisation_id as string) ?? "School",
    completedAt: assessment.completed_at as string | null,
  }));
}
