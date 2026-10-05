import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getKhposWorkspaceSnapshot } from "@/lib/khpos/workspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export class KhposImprovementError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "KhposImprovementError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposImprovementError("KHP-OS improvement intelligence is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export type ImprovementClassification =
  | "strong_improvement"
  | "improved"
  | "mixed"
  | "stable"
  | "regressed";

export interface KhposIndicatorChange {
  indicatorId: string;
  chapter: string | null;
  baselineScore: number;
  previousScore: number;
  reassessmentScore: number;
  deltaFromBaseline: number;
  deltaFromPrevious: number;
  classification: "improved" | "stable" | "regressed";
}

export interface KhposAreaChange {
  chapter: string;
  baselineScore: number;
  previousScore: number;
  reassessmentScore: number;
  deltaFromBaseline: number;
  deltaFromPrevious: number;
  classification: "improved" | "stable" | "regressed";
}

export interface KhposSystemChange {
  systemId: string;
  baselineScore: number;
  previousScore: number;
  reassessmentScore: number;
  deltaFromBaseline: number;
  deltaFromPrevious: number;
  classification: "improved" | "stable" | "regressed";
}

export interface KhposPriorityOutcome {
  priorityId: string;
  sourceIndicatorId: string;
  sourceScore: number;
  reassessmentScore: number;
  scoreDelta: number;
  outcome: "resolved" | "improving" | "unchanged" | "regressed";
  nextState: string;
}

export interface KhposReassessmentSummary {
  id: string;
  assessmentId: string;
  sequence: number;
  status: "in_progress" | "complete" | "invalid";
  baselineOverallScore: number | null;
  previousOverallScore: number | null;
  reassessmentOverallScore: number | null;
  deltaFromBaseline: number | null;
  deltaFromPrevious: number | null;
  improvedIndicatorCount: number;
  stableIndicatorCount: number;
  regressedIndicatorCount: number;
  classification: ImprovementClassification | null;
  verifiedImprovement: boolean;
  startedAt: string;
  completedAt: string | null;
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

export interface KhposImprovementWorkspace {
  organisation: {
    id: string;
    name: string;
  };
  membership: {
    role: string;
    canStartReassessment: boolean;
  };
  baseline: {
    assessmentId: string;
    completedAt: string | null;
    overallScore: number | null;
    healthRating: string | null;
    frameworkVersion: string;
  } | null;
  inProgress: {
    assessmentId: string;
    sequence: number | null;
    answeredCount: number;
    createdAt: string | null;
  } | null;
  reassessments: KhposReassessmentSummary[];
  latest: KhposReassessmentSummary | null;
  indicatorChanges: KhposIndicatorChange[];
  areaChanges: KhposAreaChange[];
  systemChanges: KhposSystemChange[];
  priorityOutcomes: KhposPriorityOutcome[];
  operationalLearning: {
    windowDays: 90;
    generatedAt: string;
    access: boolean;
    signals: KhposOperationalLearningSignal[];
  };
}

interface ReassessmentRow {
  id: string;
  reassessment_assessment_id: string;
  sequence_no: number;
  status: "in_progress" | "complete" | "invalid";
  baseline_overall_score: number | string | null;
  previous_overall_score: number | string | null;
  reassessment_overall_score: number | string | null;
  delta_from_baseline: number | string | null;
  delta_from_previous: number | string | null;
  improved_indicator_count: number;
  stable_indicator_count: number;
  regressed_indicator_count: number;
  improvement_classification: ImprovementClassification | null;
  verified_improvement: boolean;
  started_at: string;
  completed_at: string | null;
}

function numeric(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}


async function getOperationalLearning(
  organisationId: string,
  userId: string,
): Promise<KhposImprovementWorkspace["operationalLearning"]> {
  const client = admin();
  const generatedAt = new Date().toISOString();
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const { data: assignments, error: assignmentError } = await client
    .from("khpos_ops_role_assignments")
    .select("role_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (assignmentError) {
    throw new KhposImprovementError(
      "Operational learning access could not be checked.",
      500,
    );
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
    throw new KhposImprovementError(
      "Operational learning access could not be checked.",
      500,
    );
  }

  const leadershipCodes = new Set([
    "VISION_CUSTODIAN",
    "SCHOOL_CUSTODIAN",
    "SCHOOL_GUARDIAN",
    "ACADEMIC_INSPECTOR",
    "SKILL_INSPECTOR",
    "SECTIONAL_PROMOTER",
  ]);
  const access = (roles ?? []).some((role) =>
    leadershipCodes.has(String(role.code)),
  );

  if (!access) {
    return {
      windowDays: 90,
      generatedAt,
      access: false,
      signals: [],
    };
  }

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
      .select("work_item_id,status,reviewed_at,created_at")
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
    throw new KhposImprovementError(
      firstError?.message ??
        "Operational learning signals could not be calculated.",
      500,
    );
  }

  const now = generatedAt;
  const processById = new Map(
    (processesResult.data ?? []).map((process) => [process.id, process]),
  );
  const work = workResult.data ?? [];
  const workById = new Map(work.map((item) => [item.id, item]));
  const stats = new Map<
    string,
    {
      workCreated: number;
      completed: number;
      overdueOpen: number;
      blockedOpen: number;
      returnedRecords: number;
      issues: number;
      p1Issues: number;
    }
  >();

  function bucket(processId: string) {
    const existing = stats.get(processId);
    if (existing) return existing;
    const created = {
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
    const itemStats = bucket(item.process_id);
    itemStats.workCreated += 1;
    if (item.status === "completed") itemStats.completed += 1;
    if (item.status === "blocked") itemStats.blockedOpen += 1;
    if (
      item.status !== "completed" &&
      item.due_at &&
      item.due_at < now
    ) {
      itemStats.overdueOpen += 1;
    }
  }

  for (const issue of issuesResult.data ?? []) {
    if (!issue.process_id || !processById.has(issue.process_id)) continue;
    const itemStats = bucket(issue.process_id);
    itemStats.issues += 1;
    if (issue.severity === "P1") itemStats.p1Issues += 1;
  }

  for (const record of returnedRecordsResult.data ?? []) {
    const workItem = workById.get(record.work_item_id);
    if (!workItem?.process_id || !processById.has(workItem.process_id)) {
      continue;
    }
    bucket(workItem.process_id).returnedRecords += 1;
  }

  const signals: KhposOperationalLearningSignal[] = [];

  for (const [processId, itemStats] of stats) {
    const process = processById.get(processId);
    if (!process) continue;

    const completionReliability =
      itemStats.workCreated >= 3
        ? Math.round(
            (1000 * itemStats.completed) / itemStats.workCreated,
          ) / 10
        : null;

    const qualifies =
      itemStats.p1Issues > 0 ||
      itemStats.overdueOpen >= 2 ||
      itemStats.blockedOpen >= 2 ||
      itemStats.returnedRecords >= 2 ||
      itemStats.issues >= 3 ||
      (completionReliability !== null &&
        itemStats.workCreated >= 5 &&
        completionReliability < 80);

    if (!qualifies) continue;

    const score =
      itemStats.p1Issues * 8 +
      itemStats.overdueOpen * 4 +
      itemStats.blockedOpen * 3 +
      itemStats.returnedRecords * 3 +
      itemStats.issues * 2 +
      (completionReliability !== null && completionReliability < 80 ? 4 : 0) +
      (process.criticality === "P0" ? 4 : process.criticality === "P1" ? 2 : 0);

    const severity: KhposOperationalLearningSignal["severity"] =
      itemStats.p1Issues > 0 ||
      (process.criticality === "P0" &&
        (itemStats.overdueOpen > 0 || itemStats.blockedOpen > 0))
        ? "critical"
        : score >= 12
          ? "high"
          : "medium";

    let reason =
      String(itemStats.issues) +
      " issue(s), " +
      String(itemStats.overdueOpen) +
      " overdue, " +
      String(itemStats.blockedOpen) +
      " blocked, " +
      String(itemStats.returnedRecords) +
      " returned record(s) in the last 90 days.";

    if (completionReliability !== null) {
      reason +=
        " Completion reliability is " +
        String(completionReliability) +
        "% across " +
        String(itemStats.workCreated) +
        " work item(s).";
    }

    let recommendation =
      "Review the process owner, trigger, steps, SLA and dependencies before changing staff accountability.";

    if (itemStats.returnedRecords >= 2) {
      recommendation =
        "Review the required evidence, report/checklist design and verification standard; repeated returns suggest the control is unclear or difficult to execute correctly.";
    } else if (itemStats.p1Issues > 0) {
      recommendation =
        "Open a root-cause review of this process before the next cycle. A P1 issue is evidence that the current control may not be containing material risk.";
    } else if (itemStats.overdueOpen >= 2 || itemStats.blockedOpen >= 2) {
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
      workCreated: itemStats.workCreated,
      completed: itemStats.completed,
      overdueOpen: itemStats.overdueOpen,
      blockedOpen: itemStats.blockedOpen,
      returnedRecords: itemStats.returnedRecords,
      issues: itemStats.issues,
      p1Issues: itemStats.p1Issues,
      completionReliability,
      reason,
      recommendation,
    });
  }

  const severityRank = { critical: 0, high: 1, medium: 2 };
  signals.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      b.p1Issues - a.p1Issues ||
      b.overdueOpen + b.blockedOpen - (a.overdueOpen + a.blockedOpen) ||
      a.processCode.localeCompare(b.processCode),
  );

  return {
    windowDays: 90,
    generatedAt,
    access: true,
    signals: signals.slice(0, 12),
  };
}

export async function getKhposImprovementWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposImprovementWorkspace> {
  const foundation = await getKhposWorkspaceSnapshot(organisationId, userId);
  const client = admin();
  const operationalLearningPromise = getOperationalLearning(
    organisationId,
    userId,
  );

  const { data: inProgressRows, error: inProgressError } = await client
    .from("assessments")
    .select("id,reassessment_sequence,created_at")
    .eq("organisation_id", organisationId)
    .eq("assessment_kind", "reassessment")
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1);
  if (inProgressError) {
    throw new KhposImprovementError("Reassessment state could not be loaded.", 500);
  }

  const inProgressRow = inProgressRows?.[0] ?? null;
  let answeredCount = 0;
  if (inProgressRow?.id) {
    const { count, error } = await client
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", inProgressRow.id);
    if (error) {
      throw new KhposImprovementError("Reassessment progress could not be loaded.", 500);
    }
    answeredCount = count ?? 0;
  }

  const { data: reassessmentRows, error: reassessmentError } = await client
    .from("khpos_reassessments")
    .select(
      "id,reassessment_assessment_id,sequence_no,status,baseline_overall_score,previous_overall_score,reassessment_overall_score,delta_from_baseline,delta_from_previous,improved_indicator_count,stable_indicator_count,regressed_indicator_count,improvement_classification,verified_improvement,started_at,completed_at",
    )
    .eq("organisation_id", organisationId)
    .order("sequence_no", { ascending: false });
  if (reassessmentError) {
    throw new KhposImprovementError("Improvement history could not be loaded.", 500);
  }

  const reassessments = ((reassessmentRows ?? []) as ReassessmentRow[]).map((row) => ({
    id: row.id,
    assessmentId: row.reassessment_assessment_id,
    sequence: row.sequence_no,
    status: row.status,
    baselineOverallScore: numeric(row.baseline_overall_score),
    previousOverallScore: numeric(row.previous_overall_score),
    reassessmentOverallScore: numeric(row.reassessment_overall_score),
    deltaFromBaseline: numeric(row.delta_from_baseline),
    deltaFromPrevious: numeric(row.delta_from_previous),
    improvedIndicatorCount: row.improved_indicator_count,
    stableIndicatorCount: row.stable_indicator_count,
    regressedIndicatorCount: row.regressed_indicator_count,
    classification: row.improvement_classification,
    verifiedImprovement: row.verified_improvement,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));

  const latest = reassessments.find((item) => item.status === "complete") ?? null;
  let indicatorChanges: KhposIndicatorChange[] = [];
  let areaChanges: KhposAreaChange[] = [];
  let systemChanges: KhposSystemChange[] = [];
  let priorityOutcomes: KhposPriorityOutcome[] = [];

  if (latest) {
    const [indicatorResult, areaResult, systemResult, priorityResult] = await Promise.all([
      client
        .from("khpos_indicator_changes")
        .select("indicator_id,chapter,baseline_score,previous_score,reassessment_score,delta_from_baseline,delta_from_previous,change_classification")
        .eq("reassessment_id", latest.id)
        .order("indicator_id", { ascending: true }),
      client
        .from("khpos_area_changes")
        .select("chapter,baseline_score,previous_score,reassessment_score,delta_from_baseline,delta_from_previous,change_classification")
        .eq("reassessment_id", latest.id)
        .order("delta_from_baseline", { ascending: false }),
      client
        .from("khpos_system_changes")
        .select("system_id,baseline_score,previous_score,reassessment_score,delta_from_baseline,delta_from_previous,change_classification")
        .eq("reassessment_id", latest.id)
        .order("delta_from_baseline", { ascending: false }),
      client
        .from("khpos_priority_reassessment_outcomes")
        .select("priority_id,source_indicator_id,source_score,reassessment_score,score_delta,outcome,next_state")
        .eq("reassessment_id", latest.id),
    ]);

    if (indicatorResult.error || areaResult.error || systemResult.error || priorityResult.error) {
      throw new KhposImprovementError("Improvement comparison details could not be loaded.", 500);
    }

    indicatorChanges = (indicatorResult.data ?? []).map((row) => ({
      indicatorId: String(row.indicator_id),
      chapter: (row.chapter as string | null) ?? null,
      baselineScore: Number(row.baseline_score),
      previousScore: Number(row.previous_score),
      reassessmentScore: Number(row.reassessment_score),
      deltaFromBaseline: Number(row.delta_from_baseline),
      deltaFromPrevious: Number(row.delta_from_previous),
      classification: row.change_classification as KhposIndicatorChange["classification"],
    }));
    areaChanges = (areaResult.data ?? []).map((row) => ({
      chapter: String(row.chapter),
      baselineScore: Number(row.baseline_score),
      previousScore: Number(row.previous_score),
      reassessmentScore: Number(row.reassessment_score),
      deltaFromBaseline: Number(row.delta_from_baseline),
      deltaFromPrevious: Number(row.delta_from_previous),
      classification: row.change_classification as KhposAreaChange["classification"],
    }));
    systemChanges = (systemResult.data ?? []).map((row) => ({
      systemId: String(row.system_id),
      baselineScore: Number(row.baseline_score),
      previousScore: Number(row.previous_score),
      reassessmentScore: Number(row.reassessment_score),
      deltaFromBaseline: Number(row.delta_from_baseline),
      deltaFromPrevious: Number(row.delta_from_previous),
      classification: row.change_classification as KhposSystemChange["classification"],
    }));
    priorityOutcomes = (priorityResult.data ?? []).map((row) => ({
      priorityId: String(row.priority_id),
      sourceIndicatorId: String(row.source_indicator_id),
      sourceScore: Number(row.source_score),
      reassessmentScore: Number(row.reassessment_score),
      scoreDelta: Number(row.score_delta),
      outcome: row.outcome as KhposPriorityOutcome["outcome"],
      nextState: String(row.next_state),
    }));
  }

  const role = foundation.membership.role;
  return {
    organisation: {
      id: foundation.organisation.id,
      name: foundation.organisation.name,
    },
    membership: {
      role,
      canStartReassessment: role === "executive" || role === "transformation_lead",
    },
    baseline: foundation.baseline,
    inProgress: inProgressRow
      ? {
          assessmentId: String(inProgressRow.id),
          sequence: inProgressRow.reassessment_sequence === null ? null : Number(inProgressRow.reassessment_sequence),
          answeredCount,
          createdAt: (inProgressRow.created_at as string | null) ?? null,
        }
      : null,
    reassessments,
    latest,
    indicatorChanges,
    areaChanges,
    systemChanges,
    priorityOutcomes,
    operationalLearning: await operationalLearningPromise,
  };
}

export async function startKhposReassessment(
  organisationId: string,
  userId: string,
): Promise<{ assessmentId: string; sequence: number | null; resumed: boolean }> {
  const client = admin();
  const { data, error } = await client.rpc("khpos_start_reassessment_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });
  if (error || !data || typeof data !== "object") {
    throw new KhposImprovementError(error?.message ?? "Reassessment could not be started.", 400);
  }
  const result = data as Record<string, unknown>;
  const assessmentId = String(result.assessmentId ?? "");
  if (!assessmentId) {
    throw new KhposImprovementError("Reassessment could not be started.", 500);
  }
  return {
    assessmentId,
    sequence: result.sequence === null || result.sequence === undefined ? null : Number(result.sequence),
    resumed: Boolean(result.resumed),
  };
}