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

export async function getKhposImprovementWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposImprovementWorkspace> {
  const foundation = await getKhposWorkspaceSnapshot(organisationId, userId);
  const client = admin();

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