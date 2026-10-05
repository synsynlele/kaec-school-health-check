import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposOpsKpiStatus =
  | "unbaselined"
  | "green"
  | "amber"
  | "red"
  | "critical";

export type KhposOpsKpiDirection =
  | "baseline_only"
  | "higher_is_better"
  | "lower_is_better"
  | "binary_control";

export interface KhposOpsKpiMeasurement {
  id: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  status: KhposOpsKpiStatus;
  note: string | null;
  evidenceReference: string | null;
  recordedAt: string;
}

export interface KhposOpsKpi {
  id: string;
  code: string;
  name: string;
  domain: string;
  versionId: string;
  version: number;
  definition: string;
  ownerRoleId: string;
  ownerRoleTitle: string;
  scopeType: "role" | "team" | "system" | "campus" | "institution";
  scopeRoleId: string | null;
  scopeRoleTitle: string | null;
  campusId: string | null;
  campusName: string | null;
  unitId: string | null;
  unitName: string | null;
  systemCode: string | null;
  indicatorType: "outcome" | "process" | "risk";
  unit:
    | "number"
    | "percent"
    | "currency"
    | "days"
    | "hours"
    | "minutes"
    | "boolean"
    | "ratio";
  direction: KhposOpsKpiDirection;
  cadence: "weekly" | "monthly" | "termly" | "quarterly" | "annual" | "ad_hoc";
  sourceType:
    | "manual"
    | "operational_engine"
    | "third_party"
    | "ksi"
    | "pipupath";
  sourceKey: string | null;
  targetConfig: Record<string, unknown>;
  criticalControl: boolean;
  canRecord: boolean;
  latest: KhposOpsKpiMeasurement | null;
  previous: Pick<KhposOpsKpiMeasurement, "value" | "status"> | null;
}

export interface KhposOpsKpiStarterSuggestion {
  id: string;
  processCode: string;
  processTitle: string;
  sourceKpi: string;
  code: string;
  name: string;
  definition: string;
  domain: string;
  ownerRoleId: string;
  ownerRoleTitle: string;
  systemCode: string;
  indicatorType: "outcome" | "process" | "risk";
  unit:
    | "number"
    | "percent"
    | "currency"
    | "days"
    | "hours"
    | "minutes"
    | "boolean"
    | "ratio";
  cadence: "weekly" | "monthly" | "termly" | "quarterly" | "annual" | "ad_hoc";
  criticalControl: boolean;
}

export interface KhposOpsPerformanceWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canGovernKpis: boolean;
  roles: Array<{ id: string; code: string; title: string; level: number }>;
  campuses: Array<{ id: string; code: string; name: string }>;
  units: Array<{
    id: string;
    code: string;
    name: string;
    campusId: string | null;
  }>;
  operationalPulse: {
    work: { open: number; overdue: number; blocked: number };
    issues: { open: number; p1: number; p2: number; overdue: number };
    decisions: { pending: number; overdue: number };
    roles: { total: number; assigned: number; unassigned: number };
    processes: { total: number; active: number; notPublished: number };
  };
  coreScorecard: {
    total: 6;
    adopted: number;
    missing: number;
  };
  starterSuggestions: KhposOpsKpiStarterSuggestion[];
  scorecardSummary: {
    activeKpis: number;
    unbaselined: number;
    green: number;
    amber: number;
    red: number;
    critical: number;
    criticalControlsFailing: number;
  };
  derivedPerformance: {
    periodDays: 30;
    executionCoverage: {
      percent: number | null;
      configured: number;
      approved: number;
    };
    workCompletionReliability: {
      percent: number | null;
      completed: number;
      due: number;
    };
    onTimeCompletion: {
      percent: number | null;
      onTime: number;
      completedWithDeadline: number;
    };
    verificationFirstPass: {
      percent: number | null;
      firstPass: number;
      verified: number;
    };
    issueClosure: {
      percent: number | null;
      closed: number;
      opened: number;
    };
    decisionActionClosure: {
      percent: number | null;
      implemented: number;
      requiringAction: number;
    };
    recordsSubmitted: number;
  };
  items: KhposOpsKpi[];
}

export interface KhposOpsCreateKpiInput {
  code: string;
  name: string;
  domain: string;
  definition: string;
  ownerRoleId: string;
  scopeType: "role" | "team" | "system" | "campus" | "institution";
  scopeRoleId?: string | null;
  campusId?: string | null;
  unitId?: string | null;
  systemCode?: string | null;
  indicatorType: "outcome" | "process" | "risk";
  unit:
    | "number"
    | "percent"
    | "currency"
    | "days"
    | "hours"
    | "minutes"
    | "boolean"
    | "ratio";
  direction: KhposOpsKpiDirection;
  cadence: "weekly" | "monthly" | "termly" | "quarterly" | "annual" | "ad_hoc";
  sourceType:
    | "manual"
    | "operational_engine"
    | "third_party"
    | "ksi"
    | "pipupath";
  sourceKey?: string | null;
  targetConfig: Record<string, unknown>;
  criticalControl: boolean;
}


const CORE_SCORECARD_CODES = [
  "KHP-CORE-EXEC-COVERAGE",
  "KHP-CORE-WORK-RELIABILITY",
  "KHP-CORE-ONTIME",
  "KHP-CORE-FIRST-PASS",
  "KHP-CORE-ISSUE-CLOSURE",
  "KHP-CORE-DECISION-CLOSURE",
] as const;

const PROCESS_KPI_STARTER_TEMPLATES = [
  {
    id: "academic-verified-delivery",
    processCode: "ACD-009",
    sourceKpi: "Verified targets",
    code: "ACD-VERIFIED-DELIVERY",
    name: "Verified curriculum delivery",
    domain: "learner_progress",
    definition:
      "Percentage of planned curriculum targets in the review period that have verified delivery evidence.",
    indicatorType: "outcome" as const,
    unit: "percent" as const,
    cadence: "weekly" as const,
    criticalControl: false,
  },
  {
    id: "academic-uncovered-streams",
    processCode: "ACD-003",
    sourceKpi: "Uncovered delivery streams",
    code: "ACD-UNCOVERED-STREAMS",
    name: "Uncovered delivery streams",
    domain: "learner_progress",
    definition:
      "Number of active academic delivery streams that do not currently have an effective teacher/deployment owner.",
    indicatorType: "risk" as const,
    unit: "number" as const,
    cadence: "weekly" as const,
    criticalControl: false,
  },
  {
    id: "learner-baseline-coverage",
    processCode: "LPI-001",
    sourceKpi: "Active learners with current baseline",
    code: "LPI-BASELINE-COVERAGE",
    name: "Learner baseline coverage",
    domain: "learner_progress",
    definition:
      "Percentage of active learners who have a current approved baseline appropriate to their entry or transition stage.",
    indicatorType: "process" as const,
    unit: "percent" as const,
    cadence: "termly" as const,
    criticalControl: false,
  },
  {
    id: "learner-intervention-evidence",
    processCode: "LPI-005",
    sourceKpi: "Interventions without activity evidence",
    code: "LPI-INTERVENTION-EVIDENCE-GAPS",
    name: "Interventions without activity evidence",
    domain: "learner_progress",
    definition:
      "Number of active learner interventions that have no current activity evidence for the review period.",
    indicatorType: "risk" as const,
    unit: "number" as const,
    cadence: "weekly" as const,
    criticalControl: false,
  },
  {
    id: "human-potential-competency",
    processCode: "HPD-004",
    sourceKpi: "Competency progression",
    code: "HPD-COMPETENCY-PROGRESS",
    name: "Skills competency progression",
    domain: "human_potential",
    definition:
      "Percentage of active skills learners whose latest verified competency evidence shows positive progression during the review period.",
    indicatorType: "outcome" as const,
    unit: "percent" as const,
    cadence: "termly" as const,
    criticalControl: false,
  },
  {
    id: "people-onboarding-ontime",
    processCode: "PEO-006",
    sourceKpi: "Onboarding completed by deadline",
    code: "PEO-ONBOARDING-ONTIME",
    name: "On-time staff onboarding",
    domain: "people",
    definition:
      "Percentage of staff onboarding cycles completed by their governed onboarding due date.",
    indicatorType: "process" as const,
    unit: "percent" as const,
    cadence: "monthly" as const,
    criticalControl: false,
  },
  {
    id: "governance-acknowledgement",
    processCode: "GOV-007",
    sourceKpi: "Required acknowledgements completed",
    code: "GOV-ACK-COVERAGE",
    name: "Controlled-document acknowledgement coverage",
    domain: "governance",
    definition:
      "Percentage of required acknowledgements for active controlled policies and processes that are completed for the review period.",
    indicatorType: "process" as const,
    unit: "percent" as const,
    cadence: "monthly" as const,
    criticalControl: false,
  },
  {
    id: "institution-founder-dependency",
    processCode: "IPA-008",
    sourceKpi: "Founder-dependency defects",
    code: "IPA-FOUNDER-DEPENDENCY",
    name: "Founder-dependency defects",
    domain: "governance",
    definition:
      "Count of operating or decision bottlenecks in the review period that required Vision Custodian intervention because authority, process, ownership or system capability was missing or ineffective.",
    indicatorType: "risk" as const,
    unit: "number" as const,
    cadence: "monthly" as const,
    criticalControl: false,
  },
] as const;

export class KhposOpsPerformanceError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsPerformanceError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsPerformanceError(
      "KHP-OS Operations is not configured.",
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

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function statusFor(message: string | undefined) {
  return /membership|partnership|requires an active|not active|not found/i.test(
    message ?? "",
  )
    ? 403
    : /not configured|does not exist|function .* does not exist/i.test(
          message ?? "",
        )
      ? 503
      : 400;
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

async function getDerivedPerformance(organisationId: string) {
  const client = admin();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const nowIso = now.toISOString();

  const [
    profilesResult,
    dueWorkResult,
    verifiedWorkResult,
    issuesResult,
    decisionsResult,
    recordsResult,
  ] = await Promise.all([
    client
      .from("khpos_ops_process_execution_profiles")
      .select("id,status")
      .eq("organisation_id", organisationId)
      .neq("status", "not_applicable"),
    client
      .from("khpos_ops_work_items")
      .select("id,status,due_at,completed_at")
      .eq("organisation_id", organisationId)
      .neq("status", "cancelled")
      .gte("due_at", since)
      .lte("due_at", nowIso),
    client
      .from("khpos_ops_work_items")
      .select("id,verified_at")
      .eq("organisation_id", organisationId)
      .not("verified_at", "is", null)
      .gte("verified_at", since),
    client
      .from("khpos_ops_issues")
      .select("id,status")
      .eq("organisation_id", organisationId)
      .gte("created_at", since),
    client
      .from("khpos_ops_decisions")
      .select("id,status")
      .eq("organisation_id", organisationId)
      .eq("action_required", true)
      .not("decided_at", "is", null)
      .gte("decided_at", since),
    client
      .from("khpos_ops_work_records")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .gte("submitted_at", since),
  ]);

  const firstError = [
    profilesResult.error,
    dueWorkResult.error,
    verifiedWorkResult.error,
    issuesResult.error,
    decisionsResult.error,
    recordsResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new KhposOpsPerformanceError(
      firstError?.message ?? "Derived performance could not be calculated.",
      500,
    );
  }

  const profiles = profilesResult.data ?? [];
  const dueWork = dueWorkResult.data ?? [];
  const verifiedWork = verifiedWorkResult.data ?? [];
  const issues = issuesResult.data ?? [];
  const decisions = decisionsResult.data ?? [];

  const configured = profiles.filter((item) => item.status === "configured").length;
  const completed = dueWork.filter((item) => item.status === "completed");
  const onTime = completed.filter(
    (item) =>
      item.completed_at &&
      item.due_at &&
      Date.parse(item.completed_at) <= Date.parse(item.due_at),
  ).length;

  let returnedIds = new Set<string>();
  if (verifiedWork.length) {
    const { data: returns, error: returnsError } = await client
      .from("khpos_ops_audit_events")
      .select("object_id")
      .eq("organisation_id", organisationId)
      .eq("object_type", "work_item")
      .eq("event_type", "ops_work_return")
      .in(
        "object_id",
        verifiedWork.map((item) => item.id),
      );

    if (returnsError) {
      throw new KhposOpsPerformanceError(returnsError.message, 500);
    }
    returnedIds = new Set((returns ?? []).map((item) => item.object_id));
  }

  const closedIssues = issues.filter((item) =>
    ["resolved", "verified", "closed"].includes(item.status),
  ).length;
  const implementedDecisions = decisions.filter((item) =>
    ["implemented", "closed"].includes(item.status),
  ).length;
  const firstPass = verifiedWork.filter((item) => !returnedIds.has(item.id)).length;

  return {
    periodDays: 30 as const,
    executionCoverage: {
      percent: percent(configured, profiles.length),
      configured,
      approved: profiles.length,
    },
    workCompletionReliability: {
      percent: percent(completed.length, dueWork.length),
      completed: completed.length,
      due: dueWork.length,
    },
    onTimeCompletion: {
      percent: percent(onTime, completed.length),
      onTime,
      completedWithDeadline: completed.length,
    },
    verificationFirstPass: {
      percent: percent(firstPass, verifiedWork.length),
      firstPass,
      verified: verifiedWork.length,
    },
    issueClosure: {
      percent: percent(closedIssues, issues.length),
      closed: closedIssues,
      opened: issues.length,
    },
    decisionActionClosure: {
      percent: percent(implementedDecisions, decisions.length),
      implemented: implementedDecisions,
      requiringAction: decisions.length,
    },
    recordsSubmitted: recordsResult.count ?? 0,
  };
}


async function syncCoreScorecard(
  organisationId: string,
  userId: string,
  derived: KhposOpsPerformanceWorkspace["derivedPerformance"],
) {
  const metrics = {
    execution_coverage: derived.executionCoverage.percent,
    work_completion_reliability: derived.workCompletionReliability.percent,
    on_time_completion: derived.onTimeCompletion.percent,
    verification_first_pass: derived.verificationFirstPass.percent,
    issue_closure: derived.issueClosure.percent,
    decision_action_closure: derived.decisionActionClosure.percent,
  };

  const { error } = await admin().rpc(
    "khpos_ops_sync_core_scorecard_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_metrics: metrics,
    },
  );

  if (error) {
    throw new KhposOpsPerformanceError(
      error.message,
      statusFor(error.message),
    );
  }
}

async function getStarterKpiSuggestions(
  organisationId: string,
): Promise<KhposOpsKpiStarterSuggestion[]> {
  const client = admin();
  const processCodes = PROCESS_KPI_STARTER_TEMPLATES.map(
    (item) => item.processCode,
  );

  const [
    processResult,
    roleResult,
    assignmentResult,
    membershipResult,
    existingKpiResult,
  ] = await Promise.all([
    client
      .from("khpos_ops_processes")
      .select("id,code,title,operating_system,status")
      .eq("organisation_id", organisationId)
      .in("code", processCodes)
      .neq("status", "retired"),
    client
      .from("khpos_ops_roles")
      .select("id,code,title")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_role_assignments")
      .select("role_id,user_id")
      .eq("status", "active"),
    client
      .from("organisation_memberships")
      .select("user_id")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_kpis")
      .select("code")
      .eq("organisation_id", organisationId),
  ]);

  const firstError = [
    processResult.error,
    roleResult.error,
    assignmentResult.error,
    membershipResult.error,
    existingKpiResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new KhposOpsPerformanceError(
      firstError?.message ?? "KPI starter suggestions could not be loaded.",
      500,
    );
  }

  const processes = processResult.data ?? [];
  if (!processes.length) return [];

  const processIds = processes.map((process) => process.id);
  const [versionResult, profileResult] = await Promise.all([
    client
      .from("khpos_ops_process_versions")
      .select("process_id,kpis")
      .in("process_id", processIds)
      .eq("status", "active"),
    client
      .from("khpos_ops_process_execution_profiles")
      .select("process_id,owner_role_id,status")
      .eq("organisation_id", organisationId)
      .in("process_id", processIds)
      .eq("status", "configured"),
  ]);

  const detailError = [versionResult.error, profileResult.error].find(Boolean);
  if (detailError) {
    throw new KhposOpsPerformanceError(
      detailError?.message ?? "KPI starter lineage could not be loaded.",
      500,
    );
  }

  const processByCode = new Map(processes.map((process) => [process.code, process]));
  const versionByProcess = new Map(
    (versionResult.data ?? []).map((version) => [version.process_id, version]),
  );
  const profileByProcess = new Map(
    (profileResult.data ?? []).map((profile) => [profile.process_id, profile]),
  );
  const roleById = new Map(
    (roleResult.data ?? []).map((role) => [role.id, role]),
  );
  const activeMemberIds = new Set(
    (membershipResult.data ?? []).map((membership) => membership.user_id),
  );
  const staffedRoleIds = new Set(
    (assignmentResult.data ?? [])
      .filter((assignment) => activeMemberIds.has(assignment.user_id))
      .map((assignment) => assignment.role_id),
  );
  const existingCodes = new Set(
    (existingKpiResult.data ?? []).map((kpi) => kpi.code),
  );

  const suggestions: KhposOpsKpiStarterSuggestion[] = [];

  for (const template of PROCESS_KPI_STARTER_TEMPLATES) {
    if (existingCodes.has(template.code)) continue;

    const process = processByCode.get(template.processCode);
    if (!process) continue;

    const version = versionByProcess.get(process.id);
    const profile = profileByProcess.get(process.id);
    if (!version || !profile?.owner_role_id) continue;
    if (!staffedRoleIds.has(profile.owner_role_id)) continue;

    const role = roleById.get(profile.owner_role_id);
    if (!role) continue;

    const sourceKpis = Array.isArray(version.kpis)
      ? version.kpis.filter((value): value is string => typeof value === "string")
      : [];
    if (!sourceKpis.includes(template.sourceKpi)) continue;

    suggestions.push({
      id: template.id,
      processCode: process.code,
      processTitle: process.title,
      sourceKpi: template.sourceKpi,
      code: template.code,
      name: template.name,
      definition: template.definition,
      domain: template.domain,
      ownerRoleId: profile.owner_role_id,
      ownerRoleTitle: role.title,
      systemCode: process.operating_system,
      indicatorType: template.indicatorType,
      unit: template.unit,
      cadence: template.cadence,
      criticalControl: template.criticalControl,
    });
  }

  return suggestions;
}

export async function getKhposOpsPerformance(
  organisationId: string,
  userId: string,
): Promise<KhposOpsPerformanceWorkspace> {
  const first = await admin().rpc("khpos_ops_get_performance_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });

  if (first.error || !isObject(first.data)) {
    throw new KhposOpsPerformanceError(
      first.error?.message ?? "Performance workspace could not be loaded.",
      statusFor(first.error?.message),
    );
  }

  let workspace = first.data as unknown as Omit<
    KhposOpsPerformanceWorkspace,
    "derivedPerformance" | "coreScorecard" | "starterSuggestions"
  >;

  const derivedPerformance = await getDerivedPerformance(organisationId);
  const adoptedBefore = workspace.items.filter((item) =>
    CORE_SCORECARD_CODES.includes(
      item.code as (typeof CORE_SCORECARD_CODES)[number],
    ),
  ).length;

  if (adoptedBefore > 0) {
    await syncCoreScorecard(
      organisationId,
      userId,
      derivedPerformance,
    );

    const refreshed = await admin().rpc("khpos_ops_get_performance_server", {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    });

    if (refreshed.error || !isObject(refreshed.data)) {
      throw new KhposOpsPerformanceError(
        refreshed.error?.message ??
          "Performance workspace could not be refreshed after scorecard sync.",
        statusFor(refreshed.error?.message),
      );
    }

    workspace = refreshed.data as unknown as Omit<
      KhposOpsPerformanceWorkspace,
      "derivedPerformance" | "coreScorecard" | "starterSuggestions"
    >;
  }

  const adopted = workspace.items.filter((item) =>
    CORE_SCORECARD_CODES.includes(
      item.code as (typeof CORE_SCORECARD_CODES)[number],
    ),
  ).length;
  const starterSuggestions =
    await getStarterKpiSuggestions(organisationId);

  return {
    ...workspace,
    derivedPerformance,
    coreScorecard: {
      total: 6,
      adopted,
      missing: Math.max(0, 6 - adopted),
    },
    starterSuggestions,
  };
}

export async function createKhposOpsKpi(
  organisationId: string,
  userId: string,
  input: KhposOpsCreateKpiInput,
): Promise<KhposOpsPerformanceWorkspace> {
  const { error } = await admin().rpc("khpos_ops_create_kpi_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_input: input,
  });

  if (error) {
    throw new KhposOpsPerformanceError(error.message, statusFor(error.message));
  }

  return getKhposOpsPerformance(organisationId, userId);
}

export async function adoptKhposCoreScorecard(
  organisationId: string,
  userId: string,
): Promise<KhposOpsPerformanceWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_adopt_core_scorecard_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error) {
    throw new KhposOpsPerformanceError(
      error.message,
      statusFor(error.message),
    );
  }

  return getKhposOpsPerformance(organisationId, userId);
}

export async function adoptKhposStarterKpi(
  organisationId: string,
  userId: string,
  suggestionId: string,
): Promise<KhposOpsPerformanceWorkspace> {
  const suggestions = await getStarterKpiSuggestions(organisationId);
  const suggestion = suggestions.find((item) => item.id === suggestionId);
  if (!suggestion) {
    throw new KhposOpsPerformanceError(
      "This KPI suggestion is no longer available. Refresh Performance and review the current governed process.",
      409,
    );
  }

  return createKhposOpsKpi(organisationId, userId, {
    code: suggestion.code,
    name: suggestion.name,
    domain: suggestion.domain,
    definition: suggestion.definition,
    ownerRoleId: suggestion.ownerRoleId,
    scopeType: "system",
    systemCode: suggestion.systemCode,
    indicatorType: suggestion.indicatorType,
    unit: suggestion.unit,
    direction: "baseline_only",
    cadence: suggestion.cadence,
    sourceType: "manual",
    sourceKey:
      "process-kpi:" +
      suggestion.processCode +
      ":" +
      suggestion.id,
    targetConfig: {},
    criticalControl: suggestion.criticalControl,
  });
}

export async function recordKhposOpsKpiMeasurement(
  organisationId: string,
  userId: string,
  input: {
    kpiId: string;
    periodStart: string;
    periodEnd: string;
    value: number;
    note?: string | null;
    evidenceReference?: string | null;
  },
): Promise<KhposOpsPerformanceWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_record_kpi_measurement_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_kpi_id: input.kpiId,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_value: input.value,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );

  if (error) {
    throw new KhposOpsPerformanceError(error.message, statusFor(error.message));
  }

  return getKhposOpsPerformance(organisationId, userId);
}

export async function configureKhposOpsKpiTarget(
  organisationId: string,
  userId: string,
  input: {
    kpiId: string;
    direction: KhposOpsKpiDirection;
    targetConfig: Record<string, unknown>;
    note?: string | null;
  },
): Promise<KhposOpsPerformanceWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_configure_kpi_target_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_kpi_id: input.kpiId,
      p_direction: input.direction,
      p_target_config: input.targetConfig,
      p_note: input.note ?? null,
    },
  );

  if (error) {
    throw new KhposOpsPerformanceError(error.message, statusFor(error.message));
  }

  return getKhposOpsPerformance(organisationId, userId);
}

export async function retireKhposOpsKpi(
  organisationId: string,
  userId: string,
  kpiId: string,
  note: string,
): Promise<KhposOpsPerformanceWorkspace> {
  const { error } = await admin().rpc("khpos_ops_retire_kpi_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_kpi_id: kpiId,
    p_note: note,
  });

  if (error) {
    throw new KhposOpsPerformanceError(error.message, statusFor(error.message));
  }

  return getKhposOpsPerformance(organisationId, userId);
}
