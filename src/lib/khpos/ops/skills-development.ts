import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsSkillPathway {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive" | "archived";
}

export interface KhposOpsSkillTerm {
  id: string;
  sessionLabel: string;
  termCode: string;
  termName: string;
  status: "active" | "closed";
  startDate: string;
  endDate: string;
}

export interface KhposOpsSkillAssignment {
  id: string;
  userId: string;
  roleCode: string;
  roleTitle: string;
  campusId: string | null;
  unitId: string | null;
}

export interface KhposOpsSkillSession {
  id: string;
  reference: string;
  sessionDate: string;
  focus: string;
  status: "planned" | "delivered" | "missed" | "cancelled";
  safetyState: "not_checked" | "safe" | "concern";
  resourceState: "not_checked" | "ready" | "partial" | "blocked";
  deliveryNote: string | null;
  evidenceReference: string | null;
  recoveryDueDate: string | null;
  recoveryStatus: "not_required" | "required" | "planned" | "recovered" | "waived";
  recoveryForSessionId: string | null;
  issueId: string | null;
}

export interface KhposOpsSkillWeeklyReview {
  id: string;
  reference: string;
  weekStart: string;
  plannedSessions: number;
  deliveredSessions: number;
  missedSessions: number;
  verifiedCompetencyEvidence: number;
  safetyResourceSummary: string | null;
  recoveryActionNote: string | null;
  valueCreationNote: string | null;
  status: "draft" | "submitted" | "approved" | "returned" | "cancelled";
  preparedBy: string;
  isPreparer: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  returnNote: string | null;
}

export interface KhposOpsSkillOffering {
  id: string;
  reference: string;
  pathwayId: string;
  pathwayName: string;
  termId: string;
  campusId: string;
  facilitatorAssignmentId: string | null;
  weeklySessionTarget: number;
  capacity: number | null;
  safetyReadiness: "not_reviewed" | "ready" | "blocked";
  resourceReadiness: "not_reviewed" | "ready" | "partial" | "blocked";
  readinessNote: string | null;
  readinessEvidenceReference: string | null;
  status: "planned" | "ready" | "active" | "closed" | "cancelled";
  sessions: KhposOpsSkillSession[];
  reviews: KhposOpsSkillWeeklyReview[];
}

export interface KhposOpsSkillCompetencyEvidence {
  id: string;
  referenceCode: string;
  competencyLevel: "exposure" | "foundation" | "independent" | "applied" | "value_creation";
  competencyArea: string;
  evidenceNote: string;
  evidenceReference: string;
  observedAt: string;
  status: "submitted" | "verified" | "returned" | "withdrawn";
  verificationNote: string | null;
  potentialEvidenceId: string | null;
  isRecorder: boolean;
}

export interface KhposOpsSkillSelection {
  id: string;
  reference: string;
  offeringId: string;
  termId: string;
  selectionBasis: "learner_choice" | "discovery_alignment" | "continuation" | "other";
  selectionNote: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "active" | "changed" | "withdrawn" | "completed";
  pathwayId: string;
  pathwayName: string;
  currentCompetencyLevel:
    | "not_assessed"
    | "exposure"
    | "foundation"
    | "independent"
    | "applied"
    | "value_creation";
  competencyEvidence: KhposOpsSkillCompetencyEvidence[];
}

export interface KhposOpsSkillChangeRequest {
  id: string;
  reference: string;
  currentSelectionId: string;
  targetOfferingId: string;
  reason: string;
  requestedEffectiveDate: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "executed";
  decisionNote: string | null;
  newSelectionId: string | null;
}

export interface KhposOpsSkillLearner {
  id: string;
  displayName: string;
  classLabel: string;
  sectionLabel: string | null;
  campusId: string;
  selections: KhposOpsSkillSelection[];
  changeRequests: KhposOpsSkillChangeRequest[];
}

export interface KhposOpsSkillsWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canRecord: boolean;
  canManage: boolean;
  executiveAggregateOnly: boolean;
  privacyBoundary: string;
  principle: string;
  competencyLadder: Array<
    "exposure" | "foundation" | "independent" | "applied" | "value_creation"
  >;
  pathways: KhposOpsSkillPathway[];
  terms: KhposOpsSkillTerm[];
  assignments: KhposOpsSkillAssignment[];
  offerings: KhposOpsSkillOffering[];
  learners: KhposOpsSkillLearner[];
  summary: {
    activeOfferings: number;
    activeSelections: number;
    pendingChanges: number;
    verifiedCompetencies: number;
    openRecoveries: number;
    submittedReviews: number;
  };
}

export class KhposOpsSkillsError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsSkillsError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsSkillsError("KHP-OS Operations is not configured.", 503);
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
  return /membership|partnership|only |outside your|not authorised|not found|at capacity|cannot|requires|must/i.test(
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
): Promise<KhposOpsSkillsWorkspace> {
  return getKhposOpsSkillsWorkspace(organisationId, userId);
}

export async function getKhposOpsSkillsWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposOpsSkillsWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_skills_workspace_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsSkillsError(
      error?.message ?? "Skills Development workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsSkillsWorkspace;
}

export async function createKhposOpsSkillOffering(
  organisationId: string,
  userId: string,
  input: {
    pathwayId: string;
    termId: string;
    campusId: string;
    facilitatorAssignmentId?: string | null;
    weeklySessionTarget: number;
    capacity?: number | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_create_skill_offering_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_pathway_id: input.pathwayId,
    p_term_id: input.termId,
    p_campus_id: input.campusId,
    p_facilitator_assignment_id: input.facilitatorAssignmentId ?? null,
    p_weekly_session_target: input.weeklySessionTarget,
    p_capacity: input.capacity ?? null,
  });
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsSkillOffering(
  organisationId: string,
  userId: string,
  input: {
    offeringId: string;
    action: "mark_ready" | "activate" | "close" | "cancel";
    safetyReadiness?: string | null;
    resourceReadiness?: string | null;
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_skill_offering_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_offering_id: input.offeringId,
    p_action: input.action,
    p_safety_readiness: input.safetyReadiness ?? null,
    p_resource_readiness: input.resourceReadiness ?? null,
    p_note: input.note ?? null,
    p_evidence_reference: input.evidenceReference ?? null,
  });
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function selectKhposOpsSkillPathway(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    offeringId: string;
    selectionBasis: string;
    selectionNote: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_select_skill_pathway_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_learner_id: input.learnerId,
    p_offering_id: input.offeringId,
    p_selection_basis: input.selectionBasis,
    p_selection_note: input.selectionNote,
  });
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function requestKhposOpsSkillChange(
  organisationId: string,
  userId: string,
  input: {
    currentSelectionId: string;
    targetOfferingId: string;
    reason: string;
    requestedEffectiveDate: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_request_skill_change_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_current_selection_id: input.currentSelectionId,
    p_target_offering_id: input.targetOfferingId,
    p_reason: input.reason,
    p_requested_effective_date: input.requestedEffectiveDate,
  });
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function decideKhposOpsSkillChange(
  organisationId: string,
  userId: string,
  input: {
    changeRequestId: string;
    action: "approve" | "reject";
    decisionNote: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_skill_change_decision_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_change_request_id: input.changeRequestId,
    p_action: input.action,
    p_decision_note: input.decisionNote,
  });
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function executeKhposOpsSkillChange(
  organisationId: string,
  userId: string,
  changeRequestId: string,
) {
  const { error } = await admin().rpc("khpos_ops_execute_skill_change_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_change_request_id: changeRequestId,
  });
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsSkillSession(
  organisationId: string,
  userId: string,
  input: {
    offeringId: string;
    sessionDate: string;
    focus: string;
    recoveryForSessionId?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_create_skill_session_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_offering_id: input.offeringId,
    p_session_date: input.sessionDate,
    p_focus: input.focus,
    p_recovery_for_session_id: input.recoveryForSessionId ?? null,
  });
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsSkillSession(
  organisationId: string,
  userId: string,
  input: {
    sessionId: string;
    action: "deliver" | "miss" | "cancel";
    safetyState: string;
    resourceState: string;
    note: string;
    evidenceReference?: string | null;
    recoveryDueDate?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_skill_session_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_session_id: input.sessionId,
    p_action: input.action,
    p_safety_state: input.safetyState,
    p_resource_state: input.resourceState,
    p_note: input.note,
    p_evidence_reference: input.evidenceReference ?? null,
    p_recovery_due_date: input.recoveryDueDate ?? null,
  });
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsSkillCompetencyEvidence(
  organisationId: string,
  userId: string,
  input: {
    selectionId: string;
    competencyLevel: string;
    competencyArea: string;
    evidenceNote: string;
    evidenceReference: string;
    observedAt: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_add_skill_competency_evidence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_selection_id: input.selectionId,
      p_competency_level: input.competencyLevel,
      p_competency_area: input.competencyArea,
      p_evidence_note: input.evidenceNote,
      p_evidence_reference: input.evidenceReference,
      p_observed_at: input.observedAt,
    },
  );
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsSkillCompetencyEvidence(
  organisationId: string,
  userId: string,
  input: {
    evidenceId: string;
    action: "verify" | "return" | "withdraw";
    note: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_skill_competency_evidence_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_evidence_id: input.evidenceId,
      p_action: input.action,
      p_note: input.note,
    },
  );
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsSkillWeeklyReview(
  organisationId: string,
  userId: string,
  input: {
    offeringId: string;
    weekStart: string;
    safetyResourceSummary?: string | null;
    recoveryActionNote?: string | null;
    valueCreationNote?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_skill_weekly_review_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_offering_id: input.offeringId,
      p_week_start: input.weekStart,
      p_safety_resource_summary: input.safetyResourceSummary ?? null,
      p_recovery_action_note: input.recoveryActionNote ?? null,
      p_value_creation_note: input.valueCreationNote ?? null,
    },
  );
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsSkillWeeklyReview(
  organisationId: string,
  userId: string,
  input: {
    reviewId: string;
    action: "submit" | "approve" | "return" | "cancel";
    note?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_skill_weekly_review_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_review_id: input.reviewId,
      p_action: input.action,
      p_note: input.note ?? null,
    },
  );
  if (error) throw new KhposOpsSkillsError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}
