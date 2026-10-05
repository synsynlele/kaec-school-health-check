import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: SupabaseClient | null = null;

export type KhposIntegritySeverity = "critical" | "high" | "medium";
export type KhposIntegrityCategory =
  | "access"
  | "people"
  | "process"
  | "automation"
  | "work"
  | "governance"
  | "decision";

export interface KhposIntegrityFinding {
  id: string;
  severity: KhposIntegritySeverity;
  category: KhposIntegrityCategory;
  title: string;
  detail: string;
  count: number;
  href: string;
  remediation: string;
}

export interface KhposIntegritySnapshot {
  organisation: { id: string; name: string };
  generatedAt: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
  };
  findings: KhposIntegrityFinding[];
}

export class KhposIntegrityError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposIntegrityError";
  }
}

function admin(): SupabaseClient {
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

async function authorise(organisationId: string, userId: string) {
  const client = admin();
  const { data: membership, error: membershipError } = await client
    .from("organisation_memberships")
    .select("organisations!inner(id,name,status,partner_status,partner_entitlements)")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new KhposIntegrityError(
      membershipError?.message ?? "Active school membership is required.",
      403,
    );
  }

  const org = Array.isArray(membership.organisations)
    ? membership.organisations[0]
    : membership.organisations;

  if (
    !org ||
    org.status !== "active" ||
    org.partner_status !== "active" ||
    !Array.isArray(org.partner_entitlements) ||
    !org.partner_entitlements.includes("khpos_core")
  ) {
    throw new KhposIntegrityError(
      "An active KHP-OS school partnership is required.",
      403,
    );
  }

  const { data: assignments, error: assignmentError } = await client
    .from("khpos_ops_role_assignments")
    .select("role_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (assignmentError) {
    throw new KhposIntegrityError(assignmentError.message, 500);
  }

  const roleIds = (assignments ?? []).map((item) => item.role_id);
  const { data: roles, error: roleError } = roleIds.length
    ? await client
        .from("khpos_ops_roles")
        .select("code")
        .eq("organisation_id", organisationId)
        .eq("status", "active")
        .in("id", roleIds)
    : { data: [], error: null };

  if (roleError) {
    throw new KhposIntegrityError(roleError.message, 500);
  }

  const allowed = new Set([
    "VISION_CUSTODIAN",
    "SCHOOL_CUSTODIAN",
    "SCHOOL_GUARDIAN",
  ]);
  if (!(roles ?? []).some((role) => allowed.has(role.code))) {
    throw new KhposIntegrityError(
      "System Integrity is restricted to whole-school institutional leadership.",
      403,
    );
  }

  return { id: org.id, name: org.name };
}

function rank(value: KhposIntegritySeverity) {
  return { critical: 0, high: 1, medium: 2 }[value];
}

export async function getKhposSystemIntegrity(
  organisationId: string,
  userId: string,
): Promise<KhposIntegritySnapshot> {
  const client = admin();
  const organisation = await authorise(organisationId, userId);
  const now = new Date();
  const nowIso = now.toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const fortyEightHoursAgo = new Date(
    now.getTime() - 48 * 3_600_000,
  ).toISOString();

  const [
    rolesResult,
    assignmentsResult,
    membershipsResult,
    staffResult,
    chartersResult,
    processesResult,
    processVersionsResult,
    profilesResult,
    recurringResult,
    triggersResult,
    workResult,
    policiesResult,
    policyVersionsResult,
    decisionsResult,
  ] = await Promise.all([
    client
      .from("khpos_ops_roles")
      .select("id,code,title,status")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_role_assignments")
      .select("id,user_id,role_id,campus_id,unit_id,status,primary_assignment")
      .eq("status", "active"),
    client
      .from("organisation_memberships")
      .select("user_id,status")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_staff")
      .select(
        "id,staff_reference,status,user_id,desired_role_id,role_assignment_id,onboarding_due_date",
      )
      .eq("organisation_id", organisationId)
      .neq("status", "ended"),
    client
      .from("khpos_ops_role_charters")
      .select("role_id,status")
      .eq("status", "active"),
    client
      .from("khpos_ops_processes")
      .select("id,code,title,criticality,status")
      .eq("organisation_id", organisationId)
      .neq("status", "retired"),
    client
      .from("khpos_ops_process_versions")
      .select("process_id,status")
      .eq("status", "active"),
    client
      .from("khpos_ops_process_execution_profiles")
      .select("id,process_id,status,owner_role_id")
      .eq("organisation_id", organisationId),
    client
      .from("khpos_ops_recurring_rules")
      .select("id,code,title,owner_role_id,status")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_trigger_events")
      .select("id,event_type,error_message,occurred_at,status")
      .eq("organisation_id", organisationId)
      .eq("status", "failed")
      .gte("occurred_at", sevenDaysAgo),
    client
      .from("khpos_ops_work_items")
      .select(
        "id,title,status,due_at,submitted_for_verification_at,owner_assignment_id,process_id",
      )
      .eq("organisation_id", organisationId)
      .neq("status", "cancelled"),
    client
      .from("khpos_ops_policies")
      .select("id,code,name,status")
      .eq("organisation_id", organisationId)
      .neq("status", "retired"),
    client
      .from("khpos_ops_policy_versions")
      .select("id,policy_id,status,review_date")
      .eq("status", "active"),
    client
      .from("khpos_ops_decisions")
      .select("id,title,status,action_required,implemented_at,outcome_status")
      .eq("organisation_id", organisationId)
      .eq("status", "implemented"),
  ]);

  const firstError = [
    rolesResult.error,
    assignmentsResult.error,
    membershipsResult.error,
    staffResult.error,
    chartersResult.error,
    processesResult.error,
    processVersionsResult.error,
    profilesResult.error,
    recurringResult.error,
    triggersResult.error,
    workResult.error,
    policiesResult.error,
    policyVersionsResult.error,
    decisionsResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new KhposIntegrityError(
      firstError?.message ?? "System Integrity could not be calculated.",
      500,
    );
  }

  const roles = rolesResult.data ?? [];
  const roleIds = new Set(roles.map((role) => role.id));
  const assignments = (assignmentsResult.data ?? []).filter((item) =>
    roleIds.has(item.role_id),
  );
  const activeMembershipUsers = new Set(
    (membershipsResult.data ?? []).map((item) => item.user_id),
  );
  const assignmentsById = new Map(assignments.map((item) => [item.id, item]));
  const assignmentsByRole = new Map<string, number>();
  for (const assignment of assignments) {
    assignmentsByRole.set(
      assignment.role_id,
      (assignmentsByRole.get(assignment.role_id) ?? 0) + 1,
    );
  }

  const activeCharterRoleIds = new Set(
    (chartersResult.data ?? []).map((item) => item.role_id),
  );
  const activeProcessIds = new Set(
    (processVersionsResult.data ?? []).map((item) => item.process_id),
  );
  const profileByProcess = new Map(
    (profilesResult.data ?? []).map((item) => [item.process_id, item]),
  );
  const activePolicyIds = new Set(
    (policyVersionsResult.data ?? []).map((item) => item.policy_id),
  );

  const findings: KhposIntegrityFinding[] = [];
  const add = (finding: KhposIntegrityFinding) => {
    if (finding.count > 0) findings.push(finding);
  };

  const assignmentsWithoutMembership = assignments.filter(
    (item) => !activeMembershipUsers.has(item.user_id),
  );
  add({
    id: "access:assignment_without_membership",
    severity: "critical",
    category: "access",
    title: "Active operating roles without active school access",
    detail:
      String(assignmentsWithoutMembership.length) +
      " active role assignment(s) belong to users without an active organisation membership.",
    count: assignmentsWithoutMembership.length,
    href: "/khpos/" + organisationId + "/team",
    remediation:
      "Reconcile role assignments and organisation access. A person must not carry an active operating role without active school membership.",
  });

  const activeStaffWithMissingAssignment = (staffResult.data ?? []).filter(
    (staff) =>
      staff.status === "active" &&
      (!staff.role_assignment_id ||
        !assignmentsById.has(staff.role_assignment_id)),
  );
  add({
    id: "people:active_staff_without_role",
    severity: "critical",
    category: "people",
    title: "Active staff without an active operating-role assignment",
    detail:
      String(activeStaffWithMissingAssignment.length) +
      " active staff record(s) are not backed by an active operating assignment.",
    count: activeStaffWithMissingAssignment.length,
    href: "/khpos/" + organisationId + "/people",
    remediation:
      "Repair or deactivate the affected staff records so staff lifecycle state and operating authority cannot diverge.",
  });

  const inactiveStaffWithActiveAssignment = (staffResult.data ?? []).filter(
    (staff) =>
      ["inactive", "exiting"].includes(staff.status) &&
      staff.role_assignment_id &&
      assignmentsById.has(staff.role_assignment_id),
  );
  add({
    id: "access:inactive_staff_active_role",
    severity: "critical",
    category: "access",
    title: "Inactive or exiting staff still hold active operating authority",
    detail:
      String(inactiveStaffWithActiveAssignment.length) +
      " staff record(s) are inactive/exiting while their linked role assignment remains active.",
    count: inactiveStaffWithActiveAssignment.length,
    href: "/khpos/" + organisationId + "/staff-transition",
    remediation:
      "Complete access and role revocation through Progression & Exit before the person is treated as fully transitioned.",
  });

  const overdueOnboarding = (staffResult.data ?? []).filter(
    (staff) =>
      staff.status === "onboarding" &&
      staff.onboarding_due_date &&
      String(staff.onboarding_due_date) + "T23:59:59Z" < nowIso,
  );
  add({
    id: "people:overdue_onboarding",
    severity: "high",
    category: "people",
    title: "Staff onboarding is overdue",
    detail:
      String(overdueOnboarding.length) +
      " appointment(s) remain in onboarding beyond the controlled due date.",
    count: overdueOnboarding.length,
    href: "/khpos/" + organisationId + "/people",
    remediation:
      "Resolve the outstanding onboarding controls or formally reconsider the appointment. Do not activate around incomplete readiness.",
  });

  const activeRolesWithoutCharter = roles.filter(
    (role) => !activeCharterRoleIds.has(role.id),
  );
  add({
    id: "governance:roles_without_charter",
    severity: "high",
    category: "governance",
    title: "Active roles without an active Role Charter",
    detail:
      String(activeRolesWithoutCharter.length) +
      " active role definition(s) have no active Role Charter.",
    count: activeRolesWithoutCharter.length,
    href: "/khpos/" + organisationId + "/team",
    remediation:
      "Publish the missing Role Charters before assigning new authority to those roles.",
  });

  const approvedProcesses = (processesResult.data ?? []).filter((process) =>
    activeProcessIds.has(process.id),
  );
  const criticalUnmapped = approvedProcesses.filter((process) => {
    const profile = profileByProcess.get(process.id);
    return (
      process.criticality === "P0" &&
      profile?.status !== "configured"
    );
  });
  add({
    id: "process:p0_unmapped",
    severity: "critical",
    category: "process",
    title: "Approved critical processes are not executable yet",
    detail:
      String(criticalUnmapped.length) +
      " published P0 process(es) still lack a configured execution profile.",
    count: criticalUnmapped.length,
    href: "/khpos/" + organisationId + "/execution-control",
    remediation:
      "Map how each P0 process starts, who owns it, what evidence is required and whether verification/escalation applies.",
  });

  const publishedWithoutProfile = approvedProcesses.filter(
    (process) => !profileByProcess.has(process.id),
  );
  add({
    id: "process:no_profile",
    severity: "high",
    category: "process",
    title: "Published processes have no execution profile",
    detail:
      String(publishedWithoutProfile.length) +
      " published process(es) are missing the execution-profile record itself.",
    count: publishedWithoutProfile.length,
    href: "/khpos/" + organisationId + "/execution-control",
    remediation:
      "Reconcile the process registry so every published process has one canonical execution profile.",
  });

  const configuredOwnerRoles = new Set(
    (profilesResult.data ?? [])
      .filter(
        (profile) =>
          profile.status === "configured" && profile.owner_role_id,
      )
      .map((profile) => profile.owner_role_id as string),
  );
  const configuredOwnerRolesWithoutAssignments = Array.from(
    configuredOwnerRoles,
  ).filter((roleId) => (assignmentsByRole.get(roleId) ?? 0) === 0);

  add({
    id: "automation:configured_owner_unassigned",
    severity: "critical",
    category: "automation",
    title: "Automation points to roles with no active holder",
    detail:
      String(configuredOwnerRolesWithoutAssignments.length) +
      " configured execution-owner role(s) have zero active assignments.",
    count: configuredOwnerRolesWithoutAssignments.length,
    href: "/khpos/" + organisationId + "/team",
    remediation:
      "Assign the role or change the execution mapping. Automated work must never be materialised into an ownership vacuum.",
  });

  const recurringOwnerRolesWithoutAssignments = Array.from(
    new Set(
      (recurringResult.data ?? []).map((rule) => rule.owner_role_id),
    ),
  ).filter((roleId) => (assignmentsByRole.get(roleId) ?? 0) === 0);

  add({
    id: "automation:recurring_owner_unassigned",
    severity: "critical",
    category: "automation",
    title: "Recurring operations have no active role holder",
    detail:
      String(recurringOwnerRolesWithoutAssignments.length) +
      " recurring-rule owner role(s) currently have no active assignment.",
    count: recurringOwnerRolesWithoutAssignments.length,
    href: "/khpos/" + organisationId + "/team",
    remediation:
      "Assign the accountable role before the next scheduled occurrence or pause/reconfigure the recurring rule.",
  });

  const triggerFailures = triggersResult.data ?? [];
  add({
    id: "automation:trigger_failures",
    severity: "high",
    category: "automation",
    title: "Trigger engine failures occurred in the last seven days",
    detail:
      String(triggerFailures.length) +
      " trigger event(s) failed to materialise correctly.",
    count: triggerFailures.length,
    href: "/khpos/" + organisationId + "/execution-control",
    remediation:
      "Resolve missing owner assignments or invalid execution mappings, then confirm the next event can materialise work.",
  });

  const openWork = (workResult.data ?? []).filter(
    (work) => work.status !== "completed",
  );
  const overdueWork = openWork.filter(
    (work) => work.due_at && work.due_at < nowIso,
  );
  add({
    id: "work:overdue",
    severity: overdueWork.some((work) => work.status === "blocked")
      ? "critical"
      : "high",
    category: "work",
    title: "Operational work is overdue",
    detail:
      String(overdueWork.length) +
      " open work item(s) are beyond their deadline.",
    count: overdueWork.length,
    href: "/khpos/" + organisationId + "/work",
    remediation:
      "Resolve blockers or complete/reassign the work. Repeated lateness should become a process or capacity review, not perpetual chasing.",
  });

  const verificationStale = openWork.filter(
    (work) =>
      work.status === "awaiting_verification" &&
      work.submitted_for_verification_at &&
      work.submitted_for_verification_at < fortyEightHoursAgo,
  );
  add({
    id: "work:verification_stale",
    severity: "high",
    category: "work",
    title: "Verification queue contains stale submissions",
    detail:
      String(verificationStale.length) +
      " work item(s) have waited more than 48 hours for independent verification.",
    count: verificationStale.length,
    href: "/khpos/" + organisationId + "/work",
    remediation:
      "The authorised verifier should verify or return the work. Verification must not become an invisible bottleneck.",
  });

  const missingPolicyDocuments = (policiesResult.data ?? []).filter(
    (policy) => !activePolicyIds.has(policy.id),
  );
  add({
    id: "governance:policy_documents_missing",
    severity: "high",
    category: "governance",
    title: "Registered policies are not yet active documents",
    detail:
      String(missingPolicyDocuments.length) +
      " registered policy item(s) still lack an active approved version.",
    count: missingPolicyDocuments.length,
    href: "/khpos/" + organisationId + "/library?tab=policies",
    remediation:
      "Complete policy governance before treating these register entries as adopted institutional rules.",
  });

  const overduePolicyReviews = (policyVersionsResult.data ?? []).filter(
    (version) =>
      version.review_date &&
      String(version.review_date) + "T23:59:59Z" < nowIso,
  );
  add({
    id: "governance:policy_review_overdue",
    severity: "medium",
    category: "governance",
    title: "Active policies are past their review date",
    detail:
      String(overduePolicyReviews.length) +
      " active policy version(s) have passed their scheduled review date.",
    count: overduePolicyReviews.length,
    href: "/khpos/" + organisationId + "/library?tab=policies",
    remediation:
      "Review the policy through governance; do not silently edit the active version.",
  });

  const implementedWithoutOutcome = (decisionsResult.data ?? []).filter(
    (decision) =>
      decision.action_required &&
      !decision.outcome_status &&
      decision.implemented_at &&
      decision.implemented_at < sevenDaysAgo,
  );
  add({
    id: "decision:outcome_stale",
    severity: "medium",
    category: "decision",
    title: "Implemented decisions are waiting for outcome verification",
    detail:
      String(implementedWithoutOutcome.length) +
      " decision(s) have remained implemented for more than seven days without a verified outcome.",
    count: implementedWithoutOutcome.length,
    href: "/khpos/" + organisationId + "/decisions",
    remediation:
      "Verify whether the expected outcome was achieved, partially achieved or not achieved, then close the decision with evidence-based learning.",
  });

  const duplicateKeys = new Map<string, number>();
  for (const assignment of assignments) {
    const key = [
      assignment.user_id,
      assignment.role_id,
      assignment.campus_id ?? "-",
      assignment.unit_id ?? "-",
    ].join(":");
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
  }
  const duplicateAssignmentGroups = Array.from(
    duplicateKeys.values(),
  ).filter((count) => count > 1).length;

  add({
    id: "access:duplicate_assignment",
    severity: "high",
    category: "access",
    title: "Duplicate active operating assignments detected",
    detail:
      String(duplicateAssignmentGroups) +
      " duplicate user/role/campus/unit assignment group(s) exist.",
    count: duplicateAssignmentGroups,
    href: "/khpos/" + organisationId + "/team",
    remediation:
      "Keep one canonical active assignment per person/role/scope and retire accidental duplicates.",
  });

  findings.sort(
    (a, b) =>
      rank(a.severity) - rank(b.severity) ||
      b.count - a.count ||
      a.title.localeCompare(b.title),
  );

  return {
    organisation,
    generatedAt: now.toISOString(),
    summary: {
      total: findings.reduce((sum, item) => sum + item.count, 0),
      critical: findings
        .filter((item) => item.severity === "critical")
        .reduce((sum, item) => sum + item.count, 0),
      high: findings
        .filter((item) => item.severity === "high")
        .reduce((sum, item) => sum + item.count, 0),
      medium: findings
        .filter((item) => item.severity === "medium")
        .reduce((sum, item) => sum + item.count, 0),
    },
    findings,
  };
}
