import { KHPOS_SYSTEMS } from "@/lib/khpos/foundation";
import { ensureKhposWorkspaceInterventionIntelligence } from "@/lib/khpos/intervention-intelligence";
import {
  getKhposWorkspaceSnapshot,
  type KhposWorkspaceSnapshot,
} from "@/lib/khpos/workspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTELLIGENCE_TRIGGER_ROLES = new Set(["executive", "transformation_lead"]);

export class KhposImplementationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "KhposImplementationError";
  }
}

interface PlanRow {
  id: string;
  organisation_intervention_id: string;
  plan_version: number;
  generation_version: string;
  source: "system" | "ai_assisted";
  model: string | null;
  intelligence_generated_at: string | null;
  objective: string;
  status: string;
  generated_at: string;
  activated_at: string | null;
}

interface OrganisationInterventionRow {
  id: string;
  priority_id: string;
  title: string;
  contextualised_description: string;
  owner_id: string | null;
  start_date: string | null;
  target_date: string | null;
  status: string;
  intelligence_summary: string | null;
  problem_interpretation: string | null;
  why_now: string | null;
  risks_and_guardrails: unknown;
  intelligence_source: "system" | "openai" | "fallback";
  intelligence_model: string | null;
  intelligence_version: string;
  intelligence_generated_at: string | null;
  intelligence_error: string | null;
}

interface PriorityRow {
  id: string;
  title: string;
  source_indicator_id: string;
  indicator_score: number;
  priority_score: number | string;
  khp_system_id: string;
}

interface ActionRow {
  id: string;
  implementation_plan_id: string;
  sequence_no: number;
  title: string;
  description: string;
  owner_id: string | null;
  due_date: string | null;
  status: string;
  evidence_required: boolean;
}

interface MilestoneRow {
  id: string;
  implementation_plan_id: string;
  sequence_no: number;
  title: string;
  success_signal: string;
  target_date: string | null;
  status: string;
}

interface EvidenceRequirementRow {
  id: string;
  implementation_plan_id: string;
  sequence_no: number;
  title: string;
  description: string;
  evidence_type: string;
  due_date: string | null;
  required: boolean;
  status: string;
}

interface ReviewScheduleRow {
  id: string;
  implementation_plan_id: string;
  review_type: "midpoint" | "outcome";
  scheduled_for: string;
  status: string;
  decision: string | null;
}

interface OutcomeContractRow {
  id: string;
  organisation_intervention_id: string;
  contract_version: number;
  status: string;
  baseline_condition: string;
  desired_condition: string;
  leading_indicators: unknown;
  outcome_indicators: unknown;
  success_threshold: string;
  evidence_standard: unknown;
  review_date: string;
  source: string;
  model: string | null;
  generation_version: string;
  generated_at: string;
}

export interface KhposImplementationAction {
  id: string;
  sequence: number;
  title: string;
  description: string;
  ownerId: string | null;
  dueDate: string | null;
  status: string;
  evidenceRequired: boolean;
}

export interface KhposImplementationMilestone {
  id: string;
  sequence: number;
  title: string;
  successSignal: string;
  targetDate: string | null;
  status: string;
}

export interface KhposEvidenceRequirement {
  id: string;
  sequence: number;
  title: string;
  description: string;
  evidenceType: string;
  dueDate: string | null;
  required: boolean;
  status: string;
}

export interface KhposReviewSchedule {
  id: string;
  reviewType: "midpoint" | "outcome";
  scheduledFor: string;
  status: string;
  decision: string | null;
}

export interface KhposOutcomeContract {
  id: string;
  contractVersion: number;
  baselineCondition: string;
  desiredCondition: string;
  leadingIndicators: string[];
  outcomeIndicators: string[];
  successThreshold: string;
  evidenceStandard: string[];
  reviewDate: string;
  source: string;
  model: string | null;
  generationVersion: string;
  generatedAt: string;
}

export interface KhposImplementationPlan {
  id: string;
  planVersion: number;
  generationVersion: string;
  source: "system" | "ai_assisted";
  model: string | null;
  intelligenceGeneratedAt: string | null;
  objective: string;
  status: string;
  generatedAt: string;
  activatedAt: string | null;
  priority: {
    id: string;
    title: string;
    indicatorId: string;
    indicatorScore: number;
    priorityScore: number;
    systemId: string;
    systemName: string;
  };
  intervention: {
    id: string;
    title: string;
    description: string;
    ownerId: string | null;
    startDate: string | null;
    targetDate: string | null;
    status: string;
    intelligenceSummary: string | null;
    problemInterpretation: string | null;
    whyNow: string | null;
    risksAndGuardrails: string[];
    intelligenceSource: "system" | "openai" | "fallback";
    intelligenceModel: string | null;
    intelligenceVersion: string;
    intelligenceGeneratedAt: string | null;
    intelligenceError: string | null;
  };
  outcomeContract: KhposOutcomeContract | null;
  actions: KhposImplementationAction[];
  milestones: KhposImplementationMilestone[];
  evidenceRequirements: KhposEvidenceRequirement[];
  reviews: KhposReviewSchedule[];
}

export interface KhposImplementationWorkspace {
  organisation: KhposWorkspaceSnapshot["organisation"];
  membership: KhposWorkspaceSnapshot["membership"];
  activePlanCount: number;
  aiAssistedPlanCount: number;
  plans: KhposImplementationPlan[];
}

async function serviceRequest<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposImplementationError(
      "KHP-OS implementation automation is not configured.",
      503,
    );
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new KhposImplementationError(
      "The implementation workspace could not be loaded.",
      response.status >= 500 ? 500 : 400,
    );
  }

  return (await response.json()) as T;
}

function inFilter(ids: string[]): string {
  return `in.(${ids.join(",")})`;
}

function systemNameForId(id: string): string {
  return KHPOS_SYSTEMS.find((system) => system.id === id)?.name ?? id;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

export async function getKhposImplementationWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposImplementationWorkspace> {
  const workspace = await getKhposWorkspaceSnapshot(organisationId, userId);

  if (INTELLIGENCE_TRIGGER_ROLES.has(workspace.membership.role)) {
    try {
      await ensureKhposWorkspaceInterventionIntelligence(organisationId);
    } catch (error) {
      console.error(
        "[khpos] workspace intelligence upgrade failed; deterministic implementation remains available:",
        error,
      );
    }
  }

  const plans = await serviceRequest<PlanRow[]>(
    `khpos_implementation_plans?organisation_id=eq.${encodeURIComponent(organisationId)}&status=in.(generated,active,under_review)&select=id,organisation_intervention_id,plan_version,generation_version,source,model,intelligence_generated_at,objective,status,generated_at,activated_at&order=generated_at.desc`,
  );

  if (!plans.length) {
    return {
      organisation: workspace.organisation,
      membership: workspace.membership,
      activePlanCount: 0,
      aiAssistedPlanCount: 0,
      plans: [],
    };
  }

  const planIds = plans.map((plan) => plan.id);
  const organisationInterventionIds = plans.map(
    (plan) => plan.organisation_intervention_id,
  );

  const organisationInterventions =
    await serviceRequest<OrganisationInterventionRow[]>(
      `khpos_organisation_interventions?id=${encodeURIComponent(inFilter(organisationInterventionIds))}&select=id,priority_id,title,contextualised_description,owner_id,start_date,target_date,status,intelligence_summary,problem_interpretation,why_now,risks_and_guardrails,intelligence_source,intelligence_model,intelligence_version,intelligence_generated_at,intelligence_error`,
    );

  const priorityIds = [
    ...new Set(organisationInterventions.map((item) => item.priority_id)),
  ];

  const [priorities, actions, milestones, evidenceRequirements, reviews, outcomeContracts] =
    await Promise.all([
      priorityIds.length
        ? serviceRequest<PriorityRow[]>(
            `khpos_priorities?id=${encodeURIComponent(inFilter(priorityIds))}&select=id,title,source_indicator_id,indicator_score,priority_score,khp_system_id`,
          )
        : Promise.resolve([]),
      serviceRequest<ActionRow[]>(
        `khpos_implementation_actions?implementation_plan_id=${encodeURIComponent(inFilter(planIds))}&select=id,implementation_plan_id,sequence_no,title,description,owner_id,due_date,status,evidence_required&order=sequence_no.asc`,
      ),
      serviceRequest<MilestoneRow[]>(
        `khpos_milestones?implementation_plan_id=${encodeURIComponent(inFilter(planIds))}&select=id,implementation_plan_id,sequence_no,title,success_signal,target_date,status&order=sequence_no.asc`,
      ),
      serviceRequest<EvidenceRequirementRow[]>(
        `khpos_evidence_requirements?implementation_plan_id=${encodeURIComponent(inFilter(planIds))}&select=id,implementation_plan_id,sequence_no,title,description,evidence_type,due_date,required,status&order=sequence_no.asc`,
      ),
      serviceRequest<ReviewScheduleRow[]>(
        `khpos_review_schedules?implementation_plan_id=${encodeURIComponent(inFilter(planIds))}&select=id,implementation_plan_id,review_type,scheduled_for,status,decision&order=scheduled_for.asc`,
      ),
      serviceRequest<OutcomeContractRow[]>(
        `khpos_outcome_contracts?organisation_intervention_id=${encodeURIComponent(inFilter(organisationInterventionIds))}&status=eq.active&select=id,organisation_intervention_id,contract_version,status,baseline_condition,desired_condition,leading_indicators,outcome_indicators,success_threshold,evidence_standard,review_date,source,model,generation_version,generated_at`,
      ),
    ]);

  const interventionById = new Map(
    organisationInterventions.map((item) => [item.id, item]),
  );
  const priorityById = new Map(priorities.map((item) => [item.id, item]));
  const contractByInterventionId = new Map(
    outcomeContracts.map((item) => [item.organisation_intervention_id, item]),
  );

  const implementationPlans = plans.flatMap((plan) => {
    const intervention = interventionById.get(plan.organisation_intervention_id);
    if (!intervention) return [];
    const priority = priorityById.get(intervention.priority_id);
    if (!priority) return [];
    const contract = contractByInterventionId.get(intervention.id) ?? null;

    return [
      {
        id: plan.id,
        planVersion: plan.plan_version,
        generationVersion: plan.generation_version,
        source: plan.source,
        model: plan.model,
        intelligenceGeneratedAt: plan.intelligence_generated_at,
        objective: plan.objective,
        status: plan.status,
        generatedAt: plan.generated_at,
        activatedAt: plan.activated_at,
        priority: {
          id: priority.id,
          title: priority.title,
          indicatorId: priority.source_indicator_id,
          indicatorScore: priority.indicator_score,
          priorityScore: Number(priority.priority_score),
          systemId: priority.khp_system_id,
          systemName: systemNameForId(priority.khp_system_id),
        },
        intervention: {
          id: intervention.id,
          title: intervention.title,
          description: intervention.contextualised_description,
          ownerId: intervention.owner_id,
          startDate: intervention.start_date,
          targetDate: intervention.target_date,
          status: intervention.status,
          intelligenceSummary: intervention.intelligence_summary,
          problemInterpretation: intervention.problem_interpretation,
          whyNow: intervention.why_now,
          risksAndGuardrails: stringArray(intervention.risks_and_guardrails),
          intelligenceSource: intervention.intelligence_source,
          intelligenceModel: intervention.intelligence_model,
          intelligenceVersion: intervention.intelligence_version,
          intelligenceGeneratedAt: intervention.intelligence_generated_at,
          intelligenceError: intervention.intelligence_error,
        },
        outcomeContract: contract
          ? {
              id: contract.id,
              contractVersion: contract.contract_version,
              baselineCondition: contract.baseline_condition,
              desiredCondition: contract.desired_condition,
              leadingIndicators: stringArray(contract.leading_indicators),
              outcomeIndicators: stringArray(contract.outcome_indicators),
              successThreshold: contract.success_threshold,
              evidenceStandard: stringArray(contract.evidence_standard),
              reviewDate: contract.review_date,
              source: contract.source,
              model: contract.model,
              generationVersion: contract.generation_version,
              generatedAt: contract.generated_at,
            }
          : null,
        actions: actions
          .filter((item) => item.implementation_plan_id === plan.id)
          .map((item) => ({
            id: item.id,
            sequence: item.sequence_no,
            title: item.title,
            description: item.description,
            ownerId: item.owner_id,
            dueDate: item.due_date,
            status: item.status,
            evidenceRequired: item.evidence_required,
          })),
        milestones: milestones
          .filter((item) => item.implementation_plan_id === plan.id)
          .map((item) => ({
            id: item.id,
            sequence: item.sequence_no,
            title: item.title,
            successSignal: item.success_signal,
            targetDate: item.target_date,
            status: item.status,
          })),
        evidenceRequirements: evidenceRequirements
          .filter((item) => item.implementation_plan_id === plan.id)
          .map((item) => ({
            id: item.id,
            sequence: item.sequence_no,
            title: item.title,
            description: item.description,
            evidenceType: item.evidence_type,
            dueDate: item.due_date,
            required: item.required,
            status: item.status,
          })),
        reviews: reviews
          .filter((item) => item.implementation_plan_id === plan.id)
          .map((item) => ({
            id: item.id,
            reviewType: item.review_type,
            scheduledFor: item.scheduled_for,
            status: item.status,
            decision: item.decision,
          })),
      } satisfies KhposImplementationPlan,
    ];
  });

  return {
    organisation: workspace.organisation,
    membership: workspace.membership,
    activePlanCount: implementationPlans.length,
    aiAssistedPlanCount: implementationPlans.filter((plan) => plan.source === "ai_assisted").length,
    plans: implementationPlans,
  };
}
