import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: SupabaseClient | null = null;

export type KhposIntegritySeverity = "critical" | "high" | "medium" | "info";

export interface KhposIntegrityFinding {
  key: string;
  category: "people" | "governance" | "execution" | "work" | "decisions" | "safeguarding" | "automation";
  severity: KhposIntegritySeverity;
  title: string;
  detail: string;
  count: number;
  href: string;
}

export interface KhposIntegrityPattern {
  key: string;
  severity: "high" | "medium";
  title: string;
  detail: string;
  evidenceCount: number;
  href: string;
}

export interface KhposIntegritySnapshot {
  organisation: { id: string; name: string };
  generatedAt: string;
  healthy: boolean;
  summary: {
    critical: number;
    high: number;
    medium: number;
    findings: number;
    patterns: number;
  };
  findings: KhposIntegrityFinding[];
  patterns: KhposIntegrityPattern[];
}

export class KhposIntegrityError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposIntegrityError";
  }
}

function admin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposIntegrityError("KHP-OS System Integrity is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function countBy<T>(rows: T[], keyFor: (row: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = keyFor(row);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export async function getKhposSystemIntegrity(
  organisationId: string,
  userId: string,
): Promise<KhposIntegritySnapshot> {
  const client = admin();

  const { data: membership, error: membershipError } = await client
    .from("organisation_memberships")
    .select("organisations!inner(id,name,status,partner_status,partner_entitlements)")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const organisation = membership
    ? Array.isArray(membership.organisations)
      ? membership.organisations[0]
      : membership.organisations
    : null;

  if (
    membershipError ||
    !organisation ||
    organisation.status !== "active" ||
    organisation.partner_status !== "active" ||
    !Array.isArray(organisation.partner_entitlements) ||
    !organisation.partner_entitlements.includes("khpos_core")
  ) {
    throw new KhposIntegrityError("Active KHP-OS school membership is required.", 403);
  }

  const { data: actorAssignments, error: actorAssignmentError } = await client
    .from("khpos_ops_role_assignments")
    .select("role_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (actorAssignmentError) throw new KhposIntegrityError(actorAssignmentError.message, 500);

  const actorRoleIds = (actorAssignments ?? []).map((row) => row.role_id);
  const { data: actorRoles, error: actorRoleError } = actorRoleIds.length
    ? await client
        .from("khpos_ops_roles")
        .select("code")
        .eq("organisation_id", organisationId)
        .eq("status", "active")
        .in("id", actorRoleIds)
    : { data: [], error: null };

  if (actorRoleError) throw new KhposIntegrityError(actorRoleError.message, 500);

  const allowed = new Set([
    "VISION_CUSTODIAN",
    "SCHOOL_CUSTODIAN",
    "SCHOOL_GUARDIAN",
    "ACADEMIC_INSPECTOR",
    "SKILL_INSPECTOR",
  ]);
  if (!(actorRoles ?? []).some((role) => allowed.has(role.code))) {
    throw new KhposIntegrityError(
      "An active school leadership role is required to inspect institutional system integrity.",
      403,
    );
  }

  const now = Date.now();
  const twoDaysAgo = new Date(now - 2 * 86_400_000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString();
  const today = new Date(now).toISOString().slice(0, 10);

  const [
    membershipsResult,
    rolesResult,
    assignmentsResult,
    processesResult,
    profilesResult,
    recurringResult,
    workResult,
    decisionsResult,
    campusesResult,
    designationsResult,
    triggerFailuresResult,
    policyVersionsResult,
    processVersionsResult,
    auditReturnsResult,
    issuesResult,
  ] = await Promise.all([
    client
      .from("organisation_memberships")
      .select("user_id")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_roles")
      .select("id,code,title")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_role_assignments")
      .select("id,user_id,role_id,campus_id,unit_id,status,created_at")
      .eq("status", "active"),
    client
      .from("khpos_ops_processes")
      .select("id,code,title,criticality,status")
      .eq("organisation_id", organisationId)
      .neq("status", "retired"),
    client
      .from("khpos_ops_process_execution_profiles")
      .select("id,process_id,status,activation_mode,owner_role_id")
      .eq("organisation_id", organisationId),
    client
      .from("khpos_ops_recurring_rules")
      .select("id,code,title,owner_role_id,status")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_work_items")
      .select("id,process_id,status,due_at,updated_at,submitted_for_verification_at,source_decision_id,verified_at")
      .eq("organisation_id", organisationId)
      .neq("status", "cancelled"),
    client
      .from("khpos_ops_decisions")
      .select("id,status,action_required,outcome_status")
      .eq("organisation_id", organisationId),
    client
      .from("khpos_ops_campuses")
      .select("id,name")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_safeguarding_designations")
      .select("campus_id")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_trigger_events")
      .select("id,error_message")
      .eq("organisation_id", organisationId)
      .eq("status", "failed")
      .gte("occurred_at", sevenDaysAgo),
    client
      .from("khpos_ops_policy_versions")
      .select("id,policy_id,review_date,khpos_ops_policies!inner(organisation_id)")
      .eq("status", "active")
      .not("review_date", "is", null)
      .lt("review_date", today)
      .eq("khpos_ops_policies.organisation_id", organisationId),
    client
      .from("khpos_ops_process_versions")
      .select("process_id")
      .eq("status", "active"),
    client
      .from("khpos_ops_audit_events")
      .select("object_id,created_at")
      .eq("organisation_id", organisationId)
      .eq("event_type", "ops_work_return")
      .gte("created_at", thirtyDaysAgo),
    client
      .from("khpos_ops_issues")
      .select("id,category,status,created_at")
      .eq("organisation_id", organisationId)
      .gte("created_at", thirtyDaysAgo),
  ]);

  const firstError = [
    membershipsResult.error,
    rolesResult.error,
    assignmentsResult.error,
    processesResult.error,
    profilesResult.error,
    recurringResult.error,
    workResult.error,
    decisionsResult.error,
    campusesResult.error,
    designationsResult.error,
    triggerFailuresResult.error,
    policyVersionsResult.error,
    processVersionsResult.error,
    auditReturnsResult.error,
    issuesResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new KhposIntegrityError(
      firstError?.message ?? "System integrity could not be evaluated.",
      500,
    );
  }

  const findings: KhposIntegrityFinding[] = [];
  const activeMemberIds = new Set((membershipsResult.data ?? []).map((row) => row.user_id));
  const roles = rolesResult.data ?? [];
  const roleIds = new Set(roles.map((row) => row.id));
  const assignments = (assignmentsResult.data ?? []).filter((row) => roleIds.has(row.role_id));
  const assignedMembers = new Set(
    assignments
      .filter((row) => activeMemberIds.has(row.user_id))
      .map((row) => row.user_id),
  );

  const unassignedMembers = [...activeMemberIds].filter((id) => !assignedMembers.has(id)).length;
  if (unassignedMembers) {
    findings.push({
      key: "people-unassigned",
      category: "people",
      severity: "high",
      title: "Active staff without an operating role",
      detail:
        "KHP-OS cannot route work, authority, verification or onboarding reliably until every active staff member who operates in the school has an active role assignment.",
      count: unassignedMembers,
      href: "/khpos/" + organisationId + "/team",
    });
  }

  const assignmentWithoutMembership = assignments.filter(
    (row) => !activeMemberIds.has(row.user_id),
  ).length;
  if (assignmentWithoutMembership) {
    findings.push({
      key: "people-orphan-assignment",
      category: "people",
      severity: "high",
      title: "Operating roles linked to inactive/non-member users",
      detail:
        "These assignments can create ownerless workflows or authority paths and should be corrected.",
      count: assignmentWithoutMembership,
      href: "/khpos/" + organisationId + "/team",
    });
  }

  const duplicateAssignments = new Map<string, number>();
  for (const row of assignments) {
    const key = [row.user_id, row.role_id, row.campus_id ?? "", row.unit_id ?? ""].join(":");
    duplicateAssignments.set(key, (duplicateAssignments.get(key) ?? 0) + 1);
  }
  const duplicateCount = [...duplicateAssignments.values()].filter((value) => value > 1).length;
  if (duplicateCount) {
    findings.push({
      key: "people-duplicate-assignment",
      category: "people",
      severity: "medium",
      title: "Duplicate active role assignments detected",
      detail: "Duplicate authority records can make routing and accountability ambiguous.",
      count: duplicateCount,
      href: "/khpos/" + organisationId + "/team",
    });
  }

  const activeProcessIds = new Set((processVersionsResult.data ?? []).map((row) => row.process_id));
  const approvedProcesses = (processesResult.data ?? []).filter((row) => activeProcessIds.has(row.id));
  const profileByProcess = new Map((profilesResult.data ?? []).map((row) => [row.process_id, row]));
  const unmapped = approvedProcesses.filter(
    (process) => profileByProcess.get(process.id)?.status !== "configured",
  );
  if (unmapped.length) {
    findings.push({
      key: "execution-unmapped",
      category: "execution",
      severity: unmapped.some((item) => item.criticality === "P0") ? "critical" : "high",
      title: "Approved processes without explicit execution mapping",
      detail:
        "Approved documentation exists, but KHP-OS still does not know exactly how these processes become work.",
      count: unmapped.length,
      href: "/khpos/" + organisationId + "/execution-control",
    });
  }

  const assignmentsByRole = countBy(assignments, (row) => row.role_id);
  const ownerlessSchedules = (recurringResult.data ?? []).filter(
    (rule) => (assignmentsByRole.get(rule.owner_role_id) ?? 0) === 0,
  );
  if (ownerlessSchedules.length) {
    findings.push({
      key: "automation-ownerless-schedule",
      category: "automation",
      severity: "critical",
      title: "Active recurring work has no active role holder",
      detail:
        "The schedule exists but there is nobody KHP-OS can legitimately assign the work to.",
      count: ownerlessSchedules.length,
      href: "/khpos/" + organisationId + "/execution-control",
    });
  }

  const triggerFailures = triggerFailuresResult.data ?? [];
  if (triggerFailures.length) {
    findings.push({
      key: "automation-trigger-failure",
      category: "automation",
      severity: "high",
      title: "Automation triggers failed in the last seven days",
      detail:
        "A configured institutional event or condition could not materialise its expected work. Open Execution Control and correct ownership or mapping.",
      count: triggerFailures.length,
      href: "/khpos/" + organisationId + "/execution-control",
    });
  }

  const work = workResult.data ?? [];
  const blockedStale = work.filter(
    (row) => row.status === "blocked" && row.updated_at < twoDaysAgo,
  );
  if (blockedStale.length) {
    findings.push({
      key: "work-stale-blocked",
      category: "work",
      severity: "high",
      title: "Blocked work has remained unresolved for more than 48 hours",
      detail: "Persistent blockers should become leadership exceptions rather than quietly ageing in a queue.",
      count: blockedStale.length,
      href: "/khpos/" + organisationId + "/work",
    });
  }

  const verificationStale = work.filter(
    (row) =>
      row.status === "awaiting_verification" &&
      row.submitted_for_verification_at &&
      row.submitted_for_verification_at < twoDaysAgo,
  );
  if (verificationStale.length) {
    findings.push({
      key: "work-stale-verification",
      category: "work",
      severity: "high",
      title: "Verification has been waiting for more than 48 hours",
      detail: "Submitted work should not stall after the performer has finished their part.",
      count: verificationStale.length,
      href: "/khpos/" + organisationId + "/work",
    });
  }

  const decisionWorkContradictions = work.filter(
    (row) =>
      row.source_decision_id &&
      row.status === "completed" &&
      !row.verified_at,
  );
  if (decisionWorkContradictions.length) {
    findings.push({
      key: "decision-work-unverified",
      category: "decisions",
      severity: "critical",
      title: "Decision implementation appears completed without independent verification",
      detail: "This violates the Decision → Action → Verification control and should be investigated immediately.",
      count: decisionWorkContradictions.length,
      href: "/khpos/" + organisationId + "/decisions",
    });
  }

  const workByDecision = new Set(
    work.filter((row) => row.source_decision_id).map((row) => row.source_decision_id),
  );
  const decisions = decisionsResult.data ?? [];
  const approvedWithoutWork = decisions.filter(
    (row) =>
      row.status === "approved" &&
      row.action_required &&
      !workByDecision.has(row.id),
  );
  if (approvedWithoutWork.length) {
    findings.push({
      key: "decision-missing-work",
      category: "decisions",
      severity: "critical",
      title: "Approved decisions requiring action have no implementation work",
      detail: "A decision that requires action must produce owned, deadline-bound implementation work.",
      count: approvedWithoutWork.length,
      href: "/khpos/" + organisationId + "/decisions",
    });
  }

  const legacyClosedWithoutOutcome = decisions.filter(
    (row) => row.status === "closed" && row.action_required && !row.outcome_status,
  );
  if (legacyClosedWithoutOutcome.length) {
    findings.push({
      key: "decision-missing-outcome",
      category: "decisions",
      severity: "medium",
      title: "Closed historical decisions have no verified outcome record",
      detail:
        "These may predate outcome verification. They should be reviewed only when materially useful rather than rewritten automatically.",
      count: legacyClosedWithoutOutcome.length,
      href: "/khpos/" + organisationId + "/decisions",
    });
  }

  const designationCampuses = new Set(
    (designationsResult.data ?? []).map((row) => row.campus_id),
  );
  const missingDesignations = (campusesResult.data ?? []).filter(
    (campus) => !designationCampuses.has(campus.id),
  );
  if (missingDesignations.length) {
    findings.push({
      key: "safeguarding-designation",
      category: "safeguarding",
      severity: "critical",
      title: "Active campus without safeguarding designation",
      detail: "Every active campus requires an accountable safeguarding authority before normal operations are considered healthy.",
      count: missingDesignations.length,
      href: "/khpos/" + organisationId + "/safeguarding",
    });
  }

  const overduePolicyReviews = policyVersionsResult.data ?? [];
  if (overduePolicyReviews.length) {
    findings.push({
      key: "governance-policy-review",
      category: "governance",
      severity: "high",
      title: "Active policies are past their controlled review date",
      detail: "An expired review date does not automatically invalidate a policy, but governance must explicitly review and reaffirm or revise it.",
      count: overduePolicyReviews.length,
      href: "/khpos/" + organisationId + "/library?tab=policies",
    });
  }

  const patterns: KhposIntegrityPattern[] = [];
  const returnCounts = countBy(auditReturnsResult.data ?? [], (row) => row.object_id);
  const repeatedReturns = [...returnCounts.values()].filter((value) => value >= 2);
  if (repeatedReturns.length) {
    patterns.push({
      key: "pattern-repeat-return",
      severity: "high",
      title: "Work is repeatedly failing verification",
      detail:
        "At least one work item has been returned more than once in the last 30 days. Leadership should check whether the real cause is training, role clarity or a defective process.",
      evidenceCount: repeatedReturns.reduce((sum, value) => sum + value, 0),
      href: "/khpos/" + organisationId + "/performance",
    });
  }

  const overdueByProcess = countBy(
    work.filter(
      (row) =>
        row.process_id &&
        row.due_at &&
        Date.parse(row.due_at) < now &&
        !["completed", "cancelled"].includes(row.status),
    ),
    (row) => row.process_id,
  );
  const recurringOverdue = [...overdueByProcess.entries()].filter(([, value]) => value >= 2);
  if (recurringOverdue.length) {
    patterns.push({
      key: "pattern-process-overdue",
      severity: "high",
      title: "The same operating processes are accumulating overdue work",
      detail:
        "Repeated lateness against the same process is a system signal, not simply a reminder problem. Review capacity, trigger timing, ownership and the process itself.",
      evidenceCount: recurringOverdue.reduce((sum, [, value]) => sum + value, 0),
      href: "/khpos/" + organisationId + "/performance",
    });
  }

  const issueCounts = countBy(
    (issuesResult.data ?? []).filter((row) => !["verified", "closed"].includes(row.status)),
    (row) => row.category,
  );
  for (const [category, value] of issueCounts) {
    if (value < 3) continue;
    patterns.push({
      key: "pattern-issue-" + category,
      severity: value >= 5 ? "high" : "medium",
      title: "Repeated " + category.replaceAll("_", " ") + " issues detected",
      detail:
        "The same issue category has appeared repeatedly in the last 30 days. This should trigger root-cause review rather than isolated fixes.",
      evidenceCount: value,
      href: "/khpos/" + organisationId + "/issues",
    });
  }

  const order: Record<KhposIntegritySeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    info: 3,
  };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);

  return {
    organisation: { id: organisationId, name: organisation.name },
    generatedAt: new Date().toISOString(),
    healthy: !findings.some((finding) => ["critical", "high"].includes(finding.severity)),
    summary: {
      critical: findings.filter((finding) => finding.severity === "critical").length,
      high: findings.filter((finding) => finding.severity === "high").length,
      medium: findings.filter((finding) => finding.severity === "medium").length,
      findings: findings.length,
      patterns: patterns.length,
    },
    findings,
    patterns,
  };
}
