import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: SupabaseClient | null = null;

export class KhposOpsLearningError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsLearningError";
  }
}

export interface KhposOperationalLearningSignal {
  processId: string;
  processCode: string;
  processTitle: string;
  criticality: "P0" | "P1" | "P2";
  severity: "critical" | "high" | "medium";
  workCreated: number;
  completed: number;
  overdueOpen: number;
  blockedOpen: number;
  returnedRecords: number;
  issues: number;
  p1Issues: number;
  completionReliability: number | null;
  reason: string;
  recommendation: string;
}

export interface KhposOperationalLearningWorkspace {
  organisation: { id: string; name: string };
  generatedAt: string;
  windowDays: 90;
  signals: KhposOperationalLearningSignal[];
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsLearningError(
      "KHP-OS operational learning is not configured.",
      503,
    );
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
    throw new KhposOpsLearningError(
      membershipError?.message ?? "Active school membership is required.",
      403,
    );
  }

  const organisation = Array.isArray(membership.organisations)
    ? membership.organisations[0]
    : membership.organisations;

  if (
    !organisation ||
    organisation.status !== "active" ||
    organisation.partner_status !== "active" ||
    !Array.isArray(organisation.partner_entitlements) ||
    !organisation.partner_entitlements.includes("khpos_core")
  ) {
    throw new KhposOpsLearningError(
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
    throw new KhposOpsLearningError(assignmentError.message, 500);
  }

  const roleIds = (assignments ?? []).map((item) => item.role_id);
  const { data: roles, error: rolesError } = roleIds.length
    ? await client
        .from("khpos_ops_roles")
        .select("code")
        .eq("organisation_id", organisationId)
        .eq("status", "active")
        .in("id", roleIds)
    : { data: [], error: null };

  if (rolesError) throw new KhposOpsLearningError(rolesError.message, 500);

  const allowed = new Set([
    "VISION_CUSTODIAN",
    "SCHOOL_CUSTODIAN",
    "SCHOOL_GUARDIAN",
    "ACADEMIC_INSPECTOR",
    "SKILL_INSPECTOR",
    "SECTIONAL_PROMOTER",
  ]);

  if (!(roles ?? []).some((role) => allowed.has(String(role.code)))) {
    throw new KhposOpsLearningError(
      "Operational learning is available to authorised school leaders.",
      403,
    );
  }

  return {
    id: String(organisation.id),
    name: String(organisation.name),
  };
}

function severityRank(value: KhposOperationalLearningSignal["severity"]) {
  if (value === "critical") return 0;
  if (value === "high") return 1;
  return 2;
}

export async function getKhposOperationalLearning(
  organisationId: string,
  userId: string,
): Promise<KhposOperationalLearningWorkspace> {
  const client = admin();
  const organisation = await authorise(organisationId, userId);
  const generatedAt = new Date().toISOString();
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [
    processesResult,
    workResult,
    issuesResult,
    returnedRecordsResult,
  ] = await Promise.all([
    client
      .from("khpos_ops_processes")
      .select("id,code,title,criticality")
      .eq("organisation_id", organisationId)
      .neq("status", "retired"),
    client
      .from("khpos_ops_work_items")
      .select("id,process_id,status,due_at,completed_at,created_at")
      .eq("organisation_id", organisationId)
      .neq("status", "cancelled")
      .gte("created_at", cutoff)
      .limit(5000),
    client
      .from("khpos_ops_issues")
      .select("id,process_id,severity,status,created_at")
      .eq("organisation_id", organisationId)
      .gte("created_at", cutoff)
      .limit(5000),
    client
      .from("khpos_ops_work_records")
      .select("work_item_id,status,updated_at")
      .eq("organisation_id", organisationId)
      .eq("status", "returned")
      .gte("updated_at", cutoff)
      .limit(5000),
  ]);

  const firstError = [
    processesResult.error,
    workResult.error,
    issuesResult.error,
    returnedRecordsResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new KhposOpsLearningError(
      firstError?.message ??
        "Operational learning signals could not be calculated.",
      500,
    );
  }

  const processById = new Map(
    (processesResult.data ?? []).map((process) => [process.id, process]),
  );
  const work = workResult.data ?? [];
  const workById = new Map(work.map((item) => [item.id, item]));

  type Stats = {
    workCreated: number;
    completed: number;
    overdueOpen: number;
    blockedOpen: number;
    returnedRecords: number;
    issues: number;
    p1Issues: number;
  };

  const stats = new Map<string, Stats>();

  function bucket(processId: string): Stats {
    const existing = stats.get(processId);
    if (existing) return existing;
    const created: Stats = {
      workCreated: 0,
      completed: 0,
      overdueOpen: 0,
      blockedOpen: 0,
      returnedRecords: 0,
      issues: 0,
      p1Issues: 0,
    };
    stats.set(processId, created);
    return created;
  }

  for (const item of work) {
    if (!item.process_id || !processById.has(item.process_id)) continue;
    const current = bucket(item.process_id);
    current.workCreated += 1;
    if (item.status === "completed") current.completed += 1;
    if (item.status === "blocked") current.blockedOpen += 1;
    if (
      item.status !== "completed" &&
      item.due_at &&
      item.due_at < generatedAt
    ) {
      current.overdueOpen += 1;
    }
  }

  for (const issue of issuesResult.data ?? []) {
    if (!issue.process_id || !processById.has(issue.process_id)) continue;
    const current = bucket(issue.process_id);
    current.issues += 1;
    if (issue.severity === "P1") current.p1Issues += 1;
  }

  for (const record of returnedRecordsResult.data ?? []) {
    const workItem = workById.get(record.work_item_id);
    if (!workItem?.process_id || !processById.has(workItem.process_id)) continue;
    bucket(workItem.process_id).returnedRecords += 1;
  }

  const signals: KhposOperationalLearningSignal[] = [];

  for (const [processId, current] of stats) {
    const process = processById.get(processId);
    if (!process) continue;

    const completionReliability =
      current.workCreated >= 3
        ? Math.round((1000 * current.completed) / current.workCreated) / 10
        : null;

    const qualifies =
      current.p1Issues > 0 ||
      current.overdueOpen >= 2 ||
      current.blockedOpen >= 2 ||
      current.returnedRecords >= 2 ||
      current.issues >= 3 ||
      (completionReliability !== null &&
        current.workCreated >= 5 &&
        completionReliability < 80);

    if (!qualifies) continue;

    const score =
      current.p1Issues * 8 +
      current.overdueOpen * 4 +
      current.blockedOpen * 3 +
      current.returnedRecords * 3 +
      current.issues * 2 +
      (completionReliability !== null && completionReliability < 80 ? 4 : 0) +
      (process.criticality === "P0" ? 4 : process.criticality === "P1" ? 2 : 0);

    const severity: KhposOperationalLearningSignal["severity"] =
      current.p1Issues > 0 ||
      (process.criticality === "P0" &&
        (current.overdueOpen > 0 || current.blockedOpen > 0))
        ? "critical"
        : score >= 12
          ? "high"
          : "medium";

    let reason =
      String(current.issues) +
      " issue(s), " +
      String(current.overdueOpen) +
      " overdue, " +
      String(current.blockedOpen) +
      " blocked, " +
      String(current.returnedRecords) +
      " returned record(s) in the last 90 days.";

    if (completionReliability !== null) {
      reason +=
        " Completion reliability is " +
        String(completionReliability) +
        "% across " +
        String(current.workCreated) +
        " work item(s).";
    }

    let recommendation =
      "Review the process owner, trigger, steps, SLA and dependencies before changing staff accountability.";

    if (current.returnedRecords >= 2) {
      recommendation =
        "Review required evidence, report/checklist design and verification standard; repeated returns suggest the control is unclear or difficult to execute correctly.";
    } else if (current.p1Issues > 0) {
      recommendation =
        "Open a root-cause review before the next cycle. A P1 issue is evidence that the current control may not be containing material risk.";
    } else if (current.overdueOpen >= 2 || current.blockedOpen >= 2) {
      recommendation =
        "Review ownership, prerequisite inputs, hand-offs and SLA. Repeated delay should become a process redesign question, not repeated chasing.";
    } else if (
      completionReliability !== null &&
      completionReliability < 80
    ) {
      recommendation =
        "Review activation frequency, capacity and process friction. Low completion across repeated work indicates a system-design problem worth testing.";
    }

    signals.push({
      processId,
      processCode: String(process.code),
      processTitle: String(process.title),
      criticality: process.criticality as "P0" | "P1" | "P2",
      severity,
      workCreated: current.workCreated,
      completed: current.completed,
      overdueOpen: current.overdueOpen,
      blockedOpen: current.blockedOpen,
      returnedRecords: current.returnedRecords,
      issues: current.issues,
      p1Issues: current.p1Issues,
      completionReliability,
      reason,
      recommendation,
    });
  }

  signals.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      b.p1Issues - a.p1Issues ||
      b.overdueOpen + b.blockedOpen - (a.overdueOpen + a.blockedOpen) ||
      a.processCode.localeCompare(b.processCode),
  );

  return {
    organisation,
    generatedAt,
    windowDays: 90,
    signals: signals.slice(0, 12),
  };
}
