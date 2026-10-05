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

export async function getKhposOpsPerformance(
  organisationId: string,
  userId: string,
): Promise<KhposOpsPerformanceWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_performance_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsPerformanceError(
      error?.message ?? "Performance workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  const workspace = data as unknown as Omit<
    KhposOpsPerformanceWorkspace,
    "derivedPerformance"
  >;
  const derivedPerformance = await getDerivedPerformance(organisationId);

  return {
    ...workspace,
    derivedPerformance,
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
