import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsLearnerCampus {
  id: string;
  code: string;
  name: string;
}

export interface KhposOpsLearnerBaseline {
  id: string;
  reference: string;
  source: "SIS" | "KSI" | "external" | "manual";
  startingPointSummary: string;
  strengthsSummary: string | null;
  priorityGapsSummary: string | null;
  evidenceReference: string;
  recordedAt: string;
}

export interface KhposOpsLearnerAnchor {
  id: string;
  externalSystem: "SIS" | "external" | "manual";
  externalReference: string;
  displayName: string;
  classLabel: string;
  sectionLabel: string | null;
  campusId: string | null;
  status: "active" | "inactive" | "left";
  baseline: KhposOpsLearnerBaseline | null;
}

export interface KhposOpsLearnerRiskSignal {
  id: string;
  reference: string;
  learnerId: string;
  learnerName: string;
  classLabel: string;
  sectionLabel: string | null;
  signalType:
    | "low_formative_performance"
    | "sharp_decline"
    | "incomplete_work"
    | "absence_pattern"
    | "prerequisite_gap"
    | "academic_debt"
    | "teacher_concern"
    | "behaviour_interference"
    | "external_diagnostic"
    | "other";
  severity: "amber" | "red" | "critical";
  sourceSystem: "SIS" | "KSI" | "KHP" | "external" | "manual";
  sourceReference: string | null;
  signalNote: string;
  observedAt: string;
  status: "open" | "linked" | "resolved" | "dismissed";
  linkedCaseId: string | null;
  quickResponseNote: string | null;
  quickResponseReference: string | null;
  isReporter: boolean;
  canResolveQuickly: boolean;
}

export interface KhposOpsLearnerDiagnosis {
  id: string;
  version: number;
  barrierCategories: string[];
  diagnosisSummary: string;
  evidenceNote: string;
  evidenceReference: string;
  source: "KSI" | "SIS" | "external" | "manual";
  diagnosedAt: string;
}

export interface KhposOpsLearnerActivity {
  id: string;
  activityDate: string;
  activityNote: string;
  evidenceReference: string | null;
}

export interface KhposOpsLearnerIntervention {
  id: string;
  reference: string;
  tier: number;
  targetOutcome: string;
  responsePlan: string;
  ownerAssignmentId: string;
  startDate: string;
  reviewDate: string;
  successCriteria: string;
  status:
    | "planned"
    | "active"
    | "review_due"
    | "completed"
    | "changed"
    | "cancelled";
  isOwner: boolean;
  activities: KhposOpsLearnerActivity[];
}

export interface KhposOpsLearnerParentPartnership {
  id: string;
  contactDate: string;
  channel: "meeting" | "phone" | "message" | "email" | "letter" | "other";
  summary: string;
  agreedAction: string | null;
  parentActionDueDate: string | null;
  staffActionDueDate: string | null;
  evidenceReference: string | null;
}

export interface KhposOpsLearnerReassessment {
  id: string;
  interventionId: string | null;
  outcome: "recovered" | "improving" | "no_improvement" | "redirect";
  evidenceNote: string;
  evidenceReference: string;
  nextAction: string | null;
  assessedAt: string;
}

export interface KhposOpsLearnerSupportCase {
  id: string;
  reference: string;
  learnerId: string;
  learnerName: string;
  classLabel: string;
  sectionLabel: string | null;
  severity: "amber" | "red" | "critical";
  concernSummary: string;
  caseOwnerAssignmentId: string;
  reviewDueDate: string;
  status:
    | "open"
    | "diagnosis"
    | "intervention_active"
    | "reassessment"
    | "escalated"
    | "recovered"
    | "redirected"
    | "closed";
  linkedIssueId: string | null;
  escalationNote: string | null;
  closureOutcome: "recovered" | "redirected" | null;
  closureNote: string | null;
  canCoordinate: boolean;
  canManage: boolean;
  diagnosis: KhposOpsLearnerDiagnosis | null;
  interventions: KhposOpsLearnerIntervention[];
  parentPartnership: KhposOpsLearnerParentPartnership[];
  reassessments: KhposOpsLearnerReassessment[];
}

export interface KhposOpsLearnerProgressionDecision {
  id: string;
  learnerId: string;
  learnerName: string;
  academicYear: string;
  fromClassLabel: string;
  proposedNextClassLabel: string | null;
  decision:
    | "progress"
    | "progress_with_support"
    | "retain_reteach"
    | "defer_pending_review"
    | "external_review_required"
    | "graduate_transition";
  decisionRationale: string;
  requiredSupport: string | null;
  parentMeetingReference: string | null;
  status: "proposed" | "confirmed" | "cancelled";
  proposedAt: string;
  confirmedAt: string | null;
}

export interface KhposOpsLearnerTerm {
  id: string;
  sessionLabel: string;
  termCode: string;
  termName: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "closed";
}

export interface KhposOpsLearnerAssignment {
  id: string;
  userId: string;
  roleCode:
    | "TEACHER"
    | "SECTIONAL_PROMOTER"
    | "ACADEMIC_INSPECTOR"
    | "SCHOOL_GUARDIAN";
  roleTitle: string;
  campusId: string | null;
  unitId: string | null;
}

export interface KhposOpsLearnerProgressWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canManage: boolean;
  canCoordinate: boolean;
  canReport: boolean;
  executiveSummaryOnly: boolean;
  principle: string;
  systemBoundary: string;
  learners: KhposOpsLearnerAnchor[];
  signals: KhposOpsLearnerRiskSignal[];
  cases: KhposOpsLearnerSupportCase[];
  progressionDecisions: KhposOpsLearnerProgressionDecision[];
  terms: KhposOpsLearnerTerm[];
  assignments: KhposOpsLearnerAssignment[];
  campuses: KhposOpsLearnerCampus[];
  summary: {
    activeLearners: number;
    openSignals: number;
    openCases: number;
    criticalCases: number;
    reviewsDue: number;
    recoveredThisTerm: number;
  };
}

export class KhposOpsLearnerProgressError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsLearnerProgressError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsLearnerProgressError(
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
  return /membership|partnership|only the|only learner|outside your|requires|not found|cannot|competent|authority/i.test(
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
): Promise<KhposOpsLearnerProgressWorkspace> {
  return getKhposOpsLearnerProgress(organisationId, userId);
}

export async function getKhposOpsLearnerProgress(
  organisationId: string,
  userId: string,
): Promise<KhposOpsLearnerProgressWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_learner_progress_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsLearnerProgressError(
      error?.message ?? "Learner Progress workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsLearnerProgressWorkspace;
}

export async function upsertKhposOpsLearnerAnchor(
  organisationId: string,
  userId: string,
  input: {
    externalSystem: "SIS" | "external" | "manual";
    externalLearnerReference: string;
    displayName: string;
    classLabel: string;
    sectionLabel?: string | null;
    campusId: string;
    status?: "active" | "inactive" | "left";
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_upsert_learner_anchor_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_external_system: input.externalSystem,
      p_external_learner_reference: input.externalLearnerReference,
      p_display_name: input.displayName,
      p_class_label: input.classLabel,
      p_section_label: input.sectionLabel ?? null,
      p_campus_id: input.campusId,
      p_status: input.status ?? "active",
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function recordKhposOpsLearnerBaseline(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    termId?: string | null;
    baselineSource: "SIS" | "KSI" | "external" | "manual";
    startingPointSummary: string;
    strengthsSummary?: string | null;
    priorityGapsSummary?: string | null;
    evidenceReference: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_record_learner_baseline_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_term_id: input.termId ?? null,
      p_baseline_source: input.baselineSource,
      p_starting_point_summary: input.startingPointSummary,
      p_strengths_summary: input.strengthsSummary ?? null,
      p_priority_gaps_summary: input.priorityGapsSummary ?? null,
      p_evidence_reference: input.evidenceReference,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function createKhposOpsLearnerRiskSignal(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    termId?: string | null;
    streamId?: string | null;
    academicDebtId?: string | null;
    signalType: string;
    severity: "amber" | "red" | "critical";
    sourceSystem: "SIS" | "KSI" | "KHP" | "external" | "manual";
    sourceReference?: string | null;
    signalNote: string;
    observedAt: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_learner_risk_signal_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_term_id: input.termId ?? null,
      p_stream_id: input.streamId ?? null,
      p_academic_debt_id: input.academicDebtId ?? null,
      p_signal_type: input.signalType,
      p_severity: input.severity,
      p_source_system: input.sourceSystem,
      p_source_reference: input.sourceReference ?? null,
      p_signal_note: input.signalNote,
      p_observed_at: input.observedAt,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function resolveKhposOpsLearnerRiskSignal(
  organisationId: string,
  userId: string,
  input: {
    signalId: string;
    action: "resolve" | "dismiss";
    responseNote: string;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_resolve_learner_risk_signal_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_signal_id: input.signalId,
      p_action: input.action,
      p_response_note: input.responseNote,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function createKhposOpsLearnerSupportCase(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    primarySignalId?: string | null;
    termId?: string | null;
    severity: "amber" | "red" | "critical";
    concernSummary: string;
    caseOwnerAssignmentId: string;
    reviewDueDate: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_learner_support_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_primary_signal_id: input.primarySignalId ?? null,
      p_term_id: input.termId ?? null,
      p_severity: input.severity,
      p_concern_summary: input.concernSummary,
      p_case_owner_assignment_id: input.caseOwnerAssignmentId,
      p_review_due_date: input.reviewDueDate,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function recordKhposOpsLearnerDiagnosis(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    barrierCategories: string[];
    diagnosisSummary: string;
    evidenceNote: string;
    evidenceReference: string;
    diagnosisSource: "KSI" | "SIS" | "external" | "manual";
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_record_learner_diagnosis_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_barrier_categories: input.barrierCategories,
      p_diagnosis_summary: input.diagnosisSummary,
      p_evidence_note: input.evidenceNote,
      p_evidence_reference: input.evidenceReference,
      p_diagnosis_source: input.diagnosisSource,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function createKhposOpsLearnerIntervention(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    tier: number;
    targetOutcome: string;
    responsePlan: string;
    ownerAssignmentId: string;
    startDate: string;
    reviewDate: string;
    successCriteria: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_learner_intervention_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_tier: input.tier,
      p_target_outcome: input.targetOutcome,
      p_response_plan: input.responsePlan,
      p_owner_assignment_id: input.ownerAssignmentId,
      p_start_date: input.startDate,
      p_review_date: input.reviewDate,
      p_success_criteria: input.successCriteria,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function addKhposOpsLearnerInterventionActivity(
  organisationId: string,
  userId: string,
  input: {
    interventionId: string;
    activityDate: string;
    activityNote: string;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_add_learner_intervention_activity_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_intervention_id: input.interventionId,
      p_activity_date: input.activityDate,
      p_activity_note: input.activityNote,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function recordKhposOpsLearnerParentPartnership(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    contactDate: string;
    channel: string;
    summary: string;
    agreedAction?: string | null;
    parentActionDueDate?: string | null;
    staffActionDueDate?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_record_learner_parent_partnership_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_contact_date: input.contactDate,
      p_channel: input.channel,
      p_summary: input.summary,
      p_agreed_action: input.agreedAction ?? null,
      p_parent_action_due_date: input.parentActionDueDate ?? null,
      p_staff_action_due_date: input.staffActionDueDate ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function reassessKhposOpsLearnerSupportCase(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    interventionId?: string | null;
    outcome: "recovered" | "improving" | "no_improvement" | "redirect";
    evidenceNote: string;
    evidenceReference: string;
    nextAction?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_reassess_learner_support_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_intervention_id: input.interventionId ?? null,
      p_outcome: input.outcome,
      p_evidence_note: input.evidenceNote,
      p_evidence_reference: input.evidenceReference,
      p_next_action: input.nextAction ?? null,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function escalateKhposOpsLearnerSupportCase(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    newSeverity: "red" | "critical";
    newOwnerAssignmentId: string;
    escalationNote: string;
    linkedIssueId?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_escalate_learner_support_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_new_severity: input.newSeverity,
      p_new_owner_assignment_id: input.newOwnerAssignmentId,
      p_escalation_note: input.escalationNote,
      p_linked_issue_id: input.linkedIssueId ?? null,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function closeKhposOpsLearnerSupportCase(
  organisationId: string,
  userId: string,
  caseId: string,
  closureNote: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_close_learner_support_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: caseId,
      p_closure_note: closureNote,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function createKhposOpsLearnerProgressionDecision(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    academicYear: string;
    fromClassLabel: string;
    proposedNextClassLabel?: string | null;
    decision: string;
    attainmentReference: string;
    foundationalGapSummary?: string | null;
    trajectorySummary: string;
    interventionSummary?: string | null;
    attendanceReference?: string | null;
    examRequirementSummary?: string | null;
    decisionRationale: string;
    requiredSupport?: string | null;
    parentMeetingReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_learner_progression_decision_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_academic_year: input.academicYear,
      p_from_class_label: input.fromClassLabel,
      p_proposed_next_class_label: input.proposedNextClassLabel ?? null,
      p_decision: input.decision,
      p_attainment_reference: input.attainmentReference,
      p_foundational_gap_summary: input.foundationalGapSummary ?? null,
      p_trajectory_summary: input.trajectorySummary,
      p_intervention_summary: input.interventionSummary ?? null,
      p_attendance_reference: input.attendanceReference ?? null,
      p_exam_requirement_summary: input.examRequirementSummary ?? null,
      p_decision_rationale: input.decisionRationale,
      p_required_support: input.requiredSupport ?? null,
      p_parent_meeting_reference: input.parentMeetingReference ?? null,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function confirmKhposOpsLearnerProgressionDecision(
  organisationId: string,
  userId: string,
  decisionId: string,
  action: "confirm" | "cancel",
  confirmationNote: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_confirm_learner_progression_decision_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_decision_id: decisionId,
      p_action: action,
      p_confirmation_note: confirmationNote,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}

export async function upsertKhposOpsLearnerTermReview(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    termId: string;
    overallStatus: "green" | "amber" | "red" | "critical";
    progressSummary: string;
    openRisksSummary?: string | null;
    interventionSummary?: string | null;
    nextTermActions?: string | null;
    evidenceReference: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_upsert_learner_term_review_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_term_id: input.termId,
      p_overall_status: input.overallStatus,
      p_progress_summary: input.progressSummary,
      p_open_risks_summary: input.openRisksSummary ?? null,
      p_intervention_summary: input.interventionSummary ?? null,
      p_next_term_actions: input.nextTermActions ?? null,
      p_evidence_reference: input.evidenceReference,
    },
  );
  if (error)
    throw new KhposOpsLearnerProgressError(
      error.message,
      statusFor(error.message),
    );
  return refresh(organisationId, userId);
}
