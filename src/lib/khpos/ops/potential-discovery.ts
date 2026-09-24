import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsPotentialTerm {
  id: string;
  sessionLabel: string;
  termCode: string;
  termName: string;
  status: "active" | "closed";
  startDate: string;
  endDate: string;
}

export interface KhposOpsPotentialAssignment {
  id: string;
  userId: string;
  roleCode: string;
  roleTitle: string;
  campusId: string | null;
  unitId: string | null;
}

export interface KhposOpsPotentialDiscovery {
  id: string;
  reference: string;
  termId: string;
  interestsSummary: string | null;
  curiositySummary: string | null;
  meaningfulProblemsSummary: string | null;
  recurringStrengthsSummary: string | null;
  repeatedChoicesSummary: string | null;
  discoveryNote: string;
  evidenceReference: string;
  recordedAt: string;
}

export interface KhposOpsPotentialHypothesis {
  id: string;
  reference: string;
  themeLabel: string;
  hypothesisSummary: string;
  developmentState: "exploring" | "emerging" | "developing" | "demonstrated";
  currentNote: string | null;
  status: "active" | "retired";
  createdAt: string;
}

export interface KhposOpsPotentialEvidence {
  id: string;
  referenceCode: string;
  termId: string;
  hypothesisId: string | null;
  evidenceType: string;
  evidenceOrigin: "school" | "learner_shared" | "external" | "manual";
  title: string;
  evidenceNote: string;
  evidenceReference: string;
  observedAt: string;
  status: "active" | "withdrawn";
}

export interface KhposOpsPotentialExploration {
  id: string;
  reference: string;
  termId: string;
  hypothesisId: string | null;
  explorationType: string;
  areaLabel: string;
  purpose: string;
  ownerAssignmentId: string;
  plannedDate: string;
  reviewDate: string;
  status: "planned" | "active" | "completed" | "cancelled";
  outcomeNote: string | null;
  evidenceReference: string | null;
}

export interface KhposOpsPotentialReflection {
  id: string;
  reference: string;
  termId: string;
  reflectionType: string;
  learningSummary: string;
  nextStep: string | null;
  evidenceReference: string;
  reflectedAt: string;
}

export interface KhposOpsPotentialReview {
  id: string;
  reference: string;
  termId: string;
  discoverySummary: string;
  hypothesisSummary: string;
  evidenceSummary: string;
  developmentSummary: string;
  contributionSummary: string | null;
  nextPriorities: string;
  portfolioReference: string | null;
  status: "draft" | "submitted" | "approved" | "returned" | "cancelled";
  preparedBy: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  returnNote: string | null;
}

export interface KhposOpsPotentialLearner {
  id: string;
  displayName: string;
  classLabel: string;
  sectionLabel: string | null;
  campusId: string;
  discovery: KhposOpsPotentialDiscovery | null;
  hypotheses: KhposOpsPotentialHypothesis[];
  evidence: KhposOpsPotentialEvidence[];
  explorations: KhposOpsPotentialExploration[];
  reflections: KhposOpsPotentialReflection[];
  reviews: KhposOpsPotentialReview[];
}

export interface KhposOpsPotentialDiscoveryWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canRecord: boolean;
  canCoordinate: boolean;
  canApproveReview: boolean;
  executiveAggregateOnly: boolean;
  privacyBoundary: string;
  principle: string;
  terms: KhposOpsPotentialTerm[];
  assignments: KhposOpsPotentialAssignment[];
  learners: KhposOpsPotentialLearner[];
  summary: {
    activeLearners: number;
    learnersWithDiscovery: number;
    activeHypotheses: number;
    openExplorations: number;
    submittedReviews: number;
    approvedReviews: number;
  };
}

export class KhposOpsPotentialDiscoveryError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsPotentialDiscoveryError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsPotentialDiscoveryError(
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
  return /membership|partnership|outside your|cannot|only |not found|not valid/i.test(
    message ?? "",
  )
    ? 403
    : /not configured|does not exist|function .* does not exist/i.test(
          message ?? "",
        )
      ? 503
      : 400;
}

async function refresh(
  organisationId: string,
  userId: string,
): Promise<KhposOpsPotentialDiscoveryWorkspace> {
  return getKhposOpsPotentialDiscovery(organisationId, userId);
}

export async function getKhposOpsPotentialDiscovery(
  organisationId: string,
  userId: string,
): Promise<KhposOpsPotentialDiscoveryWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_potential_discovery_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsPotentialDiscoveryError(
      error?.message ?? "Potential Development workspace could not be loaded.",
      statusFor(error?.message),
    );
  }
  return data as unknown as KhposOpsPotentialDiscoveryWorkspace;
}

export async function recordKhposOpsPotentialDiscovery(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    termId: string;
    interestsSummary?: string | null;
    curiositySummary?: string | null;
    meaningfulProblemsSummary?: string | null;
    recurringStrengthsSummary?: string | null;
    repeatedChoicesSummary?: string | null;
    discoveryNote: string;
    evidenceReference: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_record_potential_discovery_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_term_id: input.termId,
      p_interests_summary: input.interestsSummary ?? null,
      p_curiosity_summary: input.curiositySummary ?? null,
      p_meaningful_problems_summary: input.meaningfulProblemsSummary ?? null,
      p_recurring_strengths_summary: input.recurringStrengthsSummary ?? null,
      p_repeated_choices_summary: input.repeatedChoicesSummary ?? null,
      p_discovery_note: input.discoveryNote,
      p_evidence_reference: input.evidenceReference,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsPotentialHypothesis(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    originTermId?: string | null;
    themeLabel: string;
    hypothesisSummary: string;
    currentNote?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_potential_hypothesis_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_origin_term_id: input.originTermId ?? null,
      p_theme_label: input.themeLabel,
      p_hypothesis_summary: input.hypothesisSummary,
      p_current_note: input.currentNote ?? null,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsPotentialHypothesis(
  organisationId: string,
  userId: string,
  input: {
    hypothesisId: string;
    action: "exploring" | "emerging" | "developing" | "demonstrated" | "retire";
    note: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_potential_hypothesis_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_hypothesis_id: input.hypothesisId,
      p_action: input.action,
      p_note: input.note,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsPotentialEvidence(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    termId: string;
    hypothesisId?: string | null;
    evidenceType: string;
    evidenceOrigin: "school" | "learner_shared" | "external" | "manual";
    title: string;
    evidenceNote: string;
    evidenceReference: string;
    observedAt: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_add_potential_evidence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_term_id: input.termId,
      p_hypothesis_id: input.hypothesisId ?? null,
      p_evidence_type: input.evidenceType,
      p_evidence_origin: input.evidenceOrigin,
      p_title: input.title,
      p_evidence_note: input.evidenceNote,
      p_evidence_reference: input.evidenceReference,
      p_observed_at: input.observedAt,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsPotentialEvidence(
  organisationId: string,
  userId: string,
  evidenceId: string,
  reason: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_potential_evidence_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_evidence_id: evidenceId,
      p_action: "withdraw",
      p_reason: reason,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsPotentialExploration(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    termId: string;
    hypothesisId?: string | null;
    explorationType: string;
    areaLabel: string;
    purpose: string;
    ownerAssignmentId: string;
    plannedDate: string;
    reviewDate: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_potential_exploration_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_term_id: input.termId,
      p_hypothesis_id: input.hypothesisId ?? null,
      p_exploration_type: input.explorationType,
      p_area_label: input.areaLabel,
      p_purpose: input.purpose,
      p_owner_assignment_id: input.ownerAssignmentId,
      p_planned_date: input.plannedDate,
      p_review_date: input.reviewDate,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsPotentialExploration(
  organisationId: string,
  userId: string,
  input: {
    explorationId: string;
    action: "start" | "complete" | "cancel";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_potential_exploration_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_exploration_id: input.explorationId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function recordKhposOpsPotentialReflection(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    termId: string;
    reflectionType: string;
    learningSummary: string;
    nextStep?: string | null;
    evidenceReference: string;
    reflectedAt: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_record_potential_reflection_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_term_id: input.termId,
      p_reflection_type: input.reflectionType,
      p_learning_summary: input.learningSummary,
      p_next_step: input.nextStep ?? null,
      p_evidence_reference: input.evidenceReference,
      p_reflected_at: input.reflectedAt,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsPotentialReview(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    termId: string;
    discoverySummary: string;
    hypothesisSummary: string;
    evidenceSummary: string;
    developmentSummary: string;
    contributionSummary?: string | null;
    nextPriorities: string;
    portfolioReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_potential_review_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_term_id: input.termId,
      p_discovery_summary: input.discoverySummary,
      p_hypothesis_summary: input.hypothesisSummary,
      p_evidence_summary: input.evidenceSummary,
      p_development_summary: input.developmentSummary,
      p_contribution_summary: input.contributionSummary ?? null,
      p_next_priorities: input.nextPriorities,
      p_portfolio_reference: input.portfolioReference ?? null,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function updateKhposOpsPotentialReview(
  organisationId: string,
  userId: string,
  input: {
    reviewId: string;
    discoverySummary: string;
    hypothesisSummary: string;
    evidenceSummary: string;
    developmentSummary: string;
    contributionSummary?: string | null;
    nextPriorities: string;
    portfolioReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_update_potential_review_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_review_id: input.reviewId,
      p_discovery_summary: input.discoverySummary,
      p_hypothesis_summary: input.hypothesisSummary,
      p_evidence_summary: input.evidenceSummary,
      p_development_summary: input.developmentSummary,
      p_contribution_summary: input.contributionSummary ?? null,
      p_next_priorities: input.nextPriorities,
      p_portfolio_reference: input.portfolioReference ?? null,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsPotentialReview(
  organisationId: string,
  userId: string,
  input: {
    reviewId: string;
    action: "submit" | "approve" | "return" | "cancel";
    note?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_potential_review_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_review_id: input.reviewId,
      p_action: input.action,
      p_note: input.note ?? null,
    },
  );
  if (error) throw new KhposOpsPotentialDiscoveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}
