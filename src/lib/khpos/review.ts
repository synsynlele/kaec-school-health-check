import OpenAI from "openai";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { KHPOS_SYSTEMS } from "@/lib/khpos/foundation";
import {
  getKhposWorkspaceSnapshot,
  type KhposWorkspaceSnapshot,
} from "@/lib/khpos/workspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REVIEW_MODEL =
  process.env.KHPOS_REVIEW_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const REVIEW_PROMPT_VERSION = "1.0";

let adminClient: SupabaseClient | null = null;

export type KhposReviewDecision =
  | "continue"
  | "adjust"
  | "escalate"
  | "complete"
  | "pause"
  | "stop";

export class KhposReviewError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "KhposReviewError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposReviewError("KHP-OS review automation is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

interface ReviewRow {
  id: string;
  organisation_id: string;
  review_schedule_id: string;
  implementation_plan_id: string;
  organisation_intervention_id: string;
  review_type: "midpoint" | "outcome";
  scheduled_for: string;
  status: "awaiting_decision" | "decided" | "superseded";
  action_count: number;
  completed_action_count: number;
  blocked_action_count: number;
  overdue_action_count: number;
  milestone_count: number;
  achieved_milestone_count: number;
  overdue_milestone_count: number;
  evidence_required_count: number;
  evidence_accepted_count: number;
  evidence_clarification_count: number;
  evidence_rejected_count: number;
  evidence_coverage_percent: number | string;
  evidence_summary: string;
  evidence_gaps: unknown[];
  plan_vs_actual: string;
  progress_summary: string;
  lessons: unknown[];
  recommended_decision: KhposReviewDecision;
  recommendation_reason: string;
  recommendation_confidence: number | string;
  recommendation_rules_version: string;
  operating_directive: string;
  narrative_provider: string;
  narrative_model: string | null;
  narrative_prompt_version: string;
  narrative_generated_at: string | null;
  approved_decision: KhposReviewDecision | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  next_step: string | null;
  next_implementation_plan_id: string | null;
  created_at: string;
  updated_at: string;
}

interface InterventionRow {
  id: string;
  priority_id: string;
  title: string;
  contextualised_description: string;
  status: string;
}

interface PriorityRow {
  id: string;
  title: string;
  source_indicator_id: string;
  indicator_score: number;
  khp_system_id: string;
  status: string;
}

export interface KhposTransformationReview {
  id: string;
  scheduleId: string;
  planId: string;
  interventionId: string;
  reviewType: "midpoint" | "outcome";
  scheduledFor: string;
  status: "awaiting_decision" | "decided" | "superseded";
  context: {
    interventionTitle: string;
    interventionDescription: string;
    interventionStatus: string;
    priorityTitle: string;
    priorityStatus: string;
    indicatorId: string;
    indicatorScore: number;
    systemId: string;
    systemName: string;
  };
  metrics: {
    actionCount: number;
    completedActionCount: number;
    blockedActionCount: number;
    overdueActionCount: number;
    milestoneCount: number;
    achievedMilestoneCount: number;
    overdueMilestoneCount: number;
    evidenceRequiredCount: number;
    evidenceAcceptedCount: number;
    evidenceClarificationCount: number;
    evidenceRejectedCount: number;
    evidenceCoveragePercent: number;
  };
  evidenceSummary: string;
  evidenceGaps: string[];
  planVsActual: string;
  progressSummary: string;
  lessons: string[];
  recommendation: {
    decision: KhposReviewDecision;
    reason: string;
    confidence: number;
    rulesVersion: string;
    operatingDirective: string;
  };
  narrative: {
    provider: string;
    model: string | null;
    promptVersion: string;
    generatedAt: string | null;
  };
  decision: {
    approved: KhposReviewDecision | null;
    note: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
    nextStep: string | null;
    nextPlanId: string | null;
  };
}

export interface KhposReviewWorkspace {
  organisation: KhposWorkspaceSnapshot["organisation"];
  membership: KhposWorkspaceSnapshot["membership"];
  canDecide: boolean;
  awaitingDecisionCount: number;
  reviews: KhposTransformationReview[];
}

function systemNameForId(id: string): string {
  return KHPOS_SYSTEMS.find((system) => system.id === id)?.name ?? id;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

const ReviewNarrativeSchema = z.object({
  planVsActual: z.string().min(40),
  progressSummary: z.string().min(40),
  lessons: z.array(z.string().min(15)).min(1).max(6),
});

type ReviewNarrative = z.infer<typeof ReviewNarrativeSchema>;

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function reviewPrompt(review: ReviewRow, intervention: InterventionRow, priority: PriorityRow): string {
  return `You are the KHP-OS institutional review analyst.
Your job is to explain a deterministic transformation review to school leadership.

HARD RULES
- The system recommendation is already fixed by rules. You may explain it but never change it.
- Do not claim that the underlying institutional weakness has improved unless a reassessment proves it.
- Evidence of implementation is not the same as verified institutional improvement.
- Do not invent meetings, observations, stakeholder views, causality, outcomes or evidence.
- Use plain professional English and make the review useful for a school executive.

REVIEW
Type: ${review.review_type}
Scheduled for: ${review.scheduled_for}
Intervention: ${intervention.title}
Priority: ${priority.title}
KSHC indicator: ${priority.source_indicator_id} (${priority.indicator_score}/5)
System: ${systemNameForId(priority.khp_system_id)}

SYSTEM-COMPUTED METRICS
Actions: ${review.completed_action_count}/${review.action_count} completed; ${review.blocked_action_count} blocked; ${review.overdue_action_count} overdue.
Milestones: ${review.achieved_milestone_count}/${review.milestone_count} achieved; ${review.overdue_milestone_count} overdue.
Evidence: ${review.evidence_accepted_count}/${review.evidence_required_count} required items accepted; ${Number(review.evidence_coverage_percent)}% coverage; ${review.evidence_clarification_count} require clarification; ${review.evidence_rejected_count} rejected submissions.
Evidence summary: ${review.evidence_summary}
Evidence gaps: ${JSON.stringify(stringArray(review.evidence_gaps))}

DETERMINISTIC RECOMMENDATION
Decision: ${review.recommended_decision}
Reason: ${review.recommendation_reason}
Directive: ${review.operating_directive}

Return STRICT JSON only:
{
  "planVsActual": "2-4 sentences comparing the generated execution path with the recorded implementation state without inventing facts.",
  "progressSummary": "2-4 sentences explaining what the accepted evidence supports, what it does not yet prove, and why the review is at this decision point.",
  "lessons": ["1-5 concise institutional lessons grounded only in the supplied metrics and evidence summary"]
}`;
}

async function enrichReviewNarrative(
  review: ReviewRow,
  intervention: InterventionRow,
  priority: PriorityRow,
): Promise<ReviewRow> {
  if (
    review.status !== "awaiting_decision" ||
    review.narrative_provider !== "system" ||
    !process.env.OPENAI_API_KEY
  ) {
    return review;
  }

  const client = admin();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.responses.create({
      model: REVIEW_MODEL,
      max_output_tokens: 1600,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: reviewPrompt(review, intervention, priority) }],
        },
      ],
    });

    const parsed = ReviewNarrativeSchema.safeParse(
      JSON.parse(stripJsonFence(response.output_text || "{}")),
    );
    if (!parsed.success) throw new Error("Review AI returned an invalid contract.");

    const narrative: ReviewNarrative = parsed.data;
    const now = new Date().toISOString();
    const { error } = await client
      .from("khpos_transformation_reviews")
      .update({
        plan_vs_actual: narrative.planVsActual,
        progress_summary: narrative.progressSummary,
        lessons: narrative.lessons,
        narrative_provider: "openai",
        narrative_model: REVIEW_MODEL,
        narrative_prompt_version: REVIEW_PROMPT_VERSION,
        narrative_generated_at: now,
        updated_at: now,
      })
      .eq("id", review.id)
      .eq("status", "awaiting_decision");

    if (error) return review;

    return {
      ...review,
      plan_vs_actual: narrative.planVsActual,
      progress_summary: narrative.progressSummary,
      lessons: narrative.lessons,
      narrative_provider: "openai",
      narrative_model: REVIEW_MODEL,
      narrative_prompt_version: REVIEW_PROMPT_VERSION,
      narrative_generated_at: now,
      updated_at: now,
    };
  } catch (error) {
    console.error("[khpos] review narrative generation failed; preserving deterministic review:", error);
    return review;
  }
}

async function prepareReviews(organisationId: string, userId: string): Promise<void> {
  const client = admin();
  const { error } = await client.rpc("khpos_prepare_reviews_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });
  if (error) {
    throw new KhposReviewError("Transformation reviews could not be prepared.", 500);
  }
}

export async function getKhposReviewWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposReviewWorkspace> {
  const workspace = await getKhposWorkspaceSnapshot(organisationId, userId);
  await prepareReviews(organisationId, userId);

  const client = admin();
  const { data: reviewData, error: reviewError } = await client
    .from("khpos_transformation_reviews")
    .select(
      "id,organisation_id,review_schedule_id,implementation_plan_id,organisation_intervention_id,review_type,scheduled_for,status,action_count,completed_action_count,blocked_action_count,overdue_action_count,milestone_count,achieved_milestone_count,overdue_milestone_count,evidence_required_count,evidence_accepted_count,evidence_clarification_count,evidence_rejected_count,evidence_coverage_percent,evidence_summary,evidence_gaps,plan_vs_actual,progress_summary,lessons,recommended_decision,recommendation_reason,recommendation_confidence,recommendation_rules_version,operating_directive,narrative_provider,narrative_model,narrative_prompt_version,narrative_generated_at,approved_decision,decision_note,decided_by,decided_at,next_step,next_implementation_plan_id,created_at,updated_at",
    )
    .eq("organisation_id", organisationId)
    .order("scheduled_for", { ascending: false })
    .order("created_at", { ascending: false });

  if (reviewError) {
    throw new KhposReviewError("Transformation reviews could not be loaded.", 500);
  }

  const rows = (reviewData ?? []) as ReviewRow[];
  if (!rows.length) {
    return {
      organisation: workspace.organisation,
      membership: workspace.membership,
      canDecide: ["executive", "transformation_lead"].includes(workspace.membership.role),
      awaitingDecisionCount: 0,
      reviews: [],
    };
  }

  const interventionIds = [...new Set(rows.map((row) => row.organisation_intervention_id))];
  const { data: interventionData, error: interventionError } = await client
    .from("khpos_organisation_interventions")
    .select("id,priority_id,title,contextualised_description,status")
    .in("id", interventionIds);
  if (interventionError) {
    throw new KhposReviewError("Review intervention context could not be loaded.", 500);
  }
  const interventions = (interventionData ?? []) as InterventionRow[];
  const interventionById = new Map(interventions.map((item) => [item.id, item]));

  const priorityIds = [...new Set(interventions.map((item) => item.priority_id))];
  const { data: priorityData, error: priorityError } = await client
    .from("khpos_priorities")
    .select("id,title,source_indicator_id,indicator_score,khp_system_id,status")
    .in("id", priorityIds);
  if (priorityError) {
    throw new KhposReviewError("Review priority context could not be loaded.", 500);
  }
  const priorities = (priorityData ?? []) as PriorityRow[];
  const priorityById = new Map(priorities.map((item) => [item.id, item]));

  const enrichedRows = await Promise.all(
    rows.map(async (row) => {
      const intervention = interventionById.get(row.organisation_intervention_id);
      const priority = intervention ? priorityById.get(intervention.priority_id) : undefined;
      if (!intervention || !priority) return row;
      return enrichReviewNarrative(row, intervention, priority);
    }),
  );

  const reviews = enrichedRows.flatMap((row) => {
    const intervention = interventionById.get(row.organisation_intervention_id);
    if (!intervention) return [];
    const priority = priorityById.get(intervention.priority_id);
    if (!priority) return [];

    return [
      {
        id: row.id,
        scheduleId: row.review_schedule_id,
        planId: row.implementation_plan_id,
        interventionId: row.organisation_intervention_id,
        reviewType: row.review_type,
        scheduledFor: row.scheduled_for,
        status: row.status,
        context: {
          interventionTitle: intervention.title,
          interventionDescription: intervention.contextualised_description,
          interventionStatus: intervention.status,
          priorityTitle: priority.title,
          priorityStatus: priority.status,
          indicatorId: priority.source_indicator_id,
          indicatorScore: priority.indicator_score,
          systemId: priority.khp_system_id,
          systemName: systemNameForId(priority.khp_system_id),
        },
        metrics: {
          actionCount: row.action_count,
          completedActionCount: row.completed_action_count,
          blockedActionCount: row.blocked_action_count,
          overdueActionCount: row.overdue_action_count,
          milestoneCount: row.milestone_count,
          achievedMilestoneCount: row.achieved_milestone_count,
          overdueMilestoneCount: row.overdue_milestone_count,
          evidenceRequiredCount: row.evidence_required_count,
          evidenceAcceptedCount: row.evidence_accepted_count,
          evidenceClarificationCount: row.evidence_clarification_count,
          evidenceRejectedCount: row.evidence_rejected_count,
          evidenceCoveragePercent: Number(row.evidence_coverage_percent),
        },
        evidenceSummary: row.evidence_summary,
        evidenceGaps: stringArray(row.evidence_gaps),
        planVsActual: row.plan_vs_actual,
        progressSummary: row.progress_summary,
        lessons: stringArray(row.lessons),
        recommendation: {
          decision: row.recommended_decision,
          reason: row.recommendation_reason,
          confidence: Number(row.recommendation_confidence),
          rulesVersion: row.recommendation_rules_version,
          operatingDirective: row.operating_directive,
        },
        narrative: {
          provider: row.narrative_provider,
          model: row.narrative_model,
          promptVersion: row.narrative_prompt_version,
          generatedAt: row.narrative_generated_at,
        },
        decision: {
          approved: row.approved_decision,
          note: row.decision_note,
          decidedBy: row.decided_by,
          decidedAt: row.decided_at,
          nextStep: row.next_step,
          nextPlanId: row.next_implementation_plan_id,
        },
      } satisfies KhposTransformationReview,
    ];
  });

  return {
    organisation: workspace.organisation,
    membership: workspace.membership,
    canDecide: ["executive", "transformation_lead"].includes(workspace.membership.role),
    awaitingDecisionCount: reviews.filter((review) => review.status === "awaiting_decision").length,
    reviews,
  };
}

const DECISIONS = new Set<KhposReviewDecision>([
  "continue",
  "adjust",
  "escalate",
  "complete",
  "pause",
  "stop",
]);

export async function applyKhposReviewDecision(
  organisationId: string,
  userId: string,
  reviewId: string,
  decision: KhposReviewDecision,
  note: string,
): Promise<KhposReviewWorkspace> {
  if (!DECISIONS.has(decision)) {
    throw new KhposReviewError("Choose a valid review decision.", 400);
  }

  await getKhposWorkspaceSnapshot(organisationId, userId);
  const client = admin();
  const { error } = await client.rpc("khpos_apply_review_decision_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_review_id: reviewId,
    p_decision: decision,
    p_note: note.trim().slice(0, 2000) || null,
  });

  if (error) {
    throw new KhposReviewError(
      error.message || "The transformation review decision could not be applied.",
      400,
    );
  }

  return getKhposReviewWorkspace(organisationId, userId);
}
