import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsAcademicCampus {
  id: string;
  code: string;
  name: string;
}

export interface KhposOpsAcademicUnit {
  id: string;
  code: string;
  name: string;
  campusId: string | null;
}

export interface KhposOpsAcademicTeacherAssignment {
  id: string;
  userId: string;
  roleId: string;
  campusId: string | null;
  unitId: string | null;
  displayName: string;
}

export interface KhposOpsAcademicTerm {
  id: string;
  campusId: string | null;
  sessionLabel: string;
  termCode: string;
  termName: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "closed" | "cancelled";
}

export interface KhposOpsAcademicDebt {
  id: string;
  debtType:
    | "partial_delivery"
    | "missed_delivery"
    | "verification_rejected";
  causeCategory:
    | "absence"
    | "timetable_disruption"
    | "resource"
    | "teacher_readiness"
    | "learner_gap"
    | "event_disruption"
    | "infrastructure"
    | "other";
  causeNote: string;
  severity: "P2" | "P3" | "P4";
  recoveryOwnerAssignmentId: string;
  recoveryPlan: string | null;
  recoveryDueDate: string | null;
  status: "open" | "planned" | "in_progress" | "evidence_submitted" | "closed";
  completionNote: string | null;
  evidenceReference: string | null;
  linkedIssueId: string | null;
  isOwner: boolean;
}

export interface KhposOpsAcademicTarget {
  id: string;
  weekNumber: number;
  targetReference: string;
  targetLabel: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  state:
    | "planned"
    | "ready"
    | "in_progress"
    | "delivered"
    | "partial"
    | "missed"
    | "recovery_required"
    | "recovered"
    | "closed";
  readinessNote: string | null;
  readinessReference: string | null;
  deliveryNote: string | null;
  deliveryReference: string | null;
  deliveredAt: string | null;
  verificationState: "unverified" | "verified" | "rejected";
  verificationNote: string | null;
  verificationReference: string | null;
  verifiedAt: string | null;
  debt: KhposOpsAcademicDebt | null;
}

export interface KhposOpsAcademicStream {
  id: string;
  termId: string;
  campusId: string | null;
  unitId: string | null;
  classLabel: string;
  sectionLabel: string | null;
  subjectLabel: string;
  subjectCode: string | null;
  teacherAssignmentId: string;
  teacherUserId: string;
  teacherDisplay: string;
  schemeSource: "KSI" | "SIS" | "external" | "manual";
  schemeReference: string;
  schemeVersion: string | null;
  timetableReference: string;
  expectedWeeks: number;
  status: "draft" | "approved" | "active" | "closed" | "cancelled";
  isTeacher: boolean;
  canPlan: boolean;
  canMonitor: boolean;
  targets: KhposOpsAcademicTarget[];
}

export interface KhposOpsAcademicObservation {
  id: string;
  streamId: string;
  targetId: string | null;
  observedTeacherAssignmentId: string;
  observerUserId: string;
  observationType: "micro" | "development" | "qa";
  observedAt: string;
  strengths: string;
  improvementArea: string | null;
  requiredAction: string | null;
  actionDueDate: string | null;
  followUpStatus: "none" | "open" | "evidence_submitted" | "verified" | "closed";
  followUpNote: string | null;
  followUpReference: string | null;
  isObservedTeacher: boolean;
  canMonitor: boolean;
}

export interface KhposOpsAcademicDeliveryWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canPlan: boolean;
  canMonitor: boolean;
  principle: string;
  technologyBoundary: string;
  campuses: KhposOpsAcademicCampus[];
  units: KhposOpsAcademicUnit[];
  teacherAssignments: KhposOpsAcademicTeacherAssignment[];
  terms: KhposOpsAcademicTerm[];
  streams: KhposOpsAcademicStream[];
  observations: KhposOpsAcademicObservation[];
  summary: {
    activeTerms: number;
    visibleStreams: number;
    plannedTargets: number;
    verifiedTargets: number;
    openDebt: number;
    overdueDebt: number;
    openObservationFollowUp: number;
  };
}

export class KhposOpsAcademicDeliveryError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsAcademicDeliveryError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsAcademicDeliveryError(
      "KHP-OS Academic Delivery is not configured.",
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
  return /membership|partnership|only the|only academic|assigned teacher|cannot|not found|requires an active|must be approved|outside/i.test(
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
): Promise<KhposOpsAcademicDeliveryWorkspace> {
  return getKhposOpsAcademicDelivery(organisationId, userId);
}

export async function getKhposOpsAcademicDelivery(
  organisationId: string,
  userId: string,
): Promise<KhposOpsAcademicDeliveryWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_academic_delivery_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsAcademicDeliveryError(
      error?.message ?? "Academic Delivery workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsAcademicDeliveryWorkspace;
}

export async function createKhposOpsAcademicTerm(
  organisationId: string,
  userId: string,
  input: {
    campusId?: string | null;
    sessionLabel: string;
    termCode: string;
    termName: string;
    startDate: string;
    endDate: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_create_academic_term_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_campus_id: input.campusId ?? null,
    p_session_label: input.sessionLabel,
    p_term_code: input.termCode,
    p_term_name: input.termName,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
  });
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsAcademicTerm(
  organisationId: string,
  userId: string,
  termId: string,
  action: "activate" | "cancel",
  note?: string | null,
) {
  const { error } = await admin().rpc("khpos_ops_academic_term_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_term_id: termId,
    p_action: action,
    p_note: note ?? null,
  });
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsAcademicStream(
  organisationId: string,
  userId: string,
  input: {
    termId: string;
    campusId?: string | null;
    unitId?: string | null;
    classLabel: string;
    sectionLabel?: string | null;
    subjectLabel: string;
    subjectCode?: string | null;
    teacherAssignmentId: string;
    schemeSource: "KSI" | "SIS" | "external" | "manual";
    schemeReference: string;
    schemeVersion?: string | null;
    timetableReference: string;
    expectedWeeks: number;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_academic_stream_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_term_id: input.termId,
      p_campus_id: input.campusId ?? null,
      p_unit_id: input.unitId ?? null,
      p_class_label: input.classLabel,
      p_section_label: input.sectionLabel ?? null,
      p_subject_label: input.subjectLabel,
      p_subject_code: input.subjectCode ?? null,
      p_teacher_assignment_id: input.teacherAssignmentId,
      p_scheme_source: input.schemeSource,
      p_scheme_reference: input.schemeReference,
      p_scheme_version: input.schemeVersion ?? null,
      p_timetable_reference: input.timetableReference,
      p_expected_weeks: input.expectedWeeks,
    },
  );
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsAcademicStream(
  organisationId: string,
  userId: string,
  streamId: string,
  action: "approve" | "cancel",
  note?: string | null,
) {
  const { error } = await admin().rpc("khpos_ops_academic_stream_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_stream_id: streamId,
    p_action: action,
    p_note: note ?? null,
  });
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function updateKhposOpsAcademicStreamAssignment(
  organisationId: string,
  userId: string,
  input: {
    streamId: string;
    teacherAssignmentId: string;
    timetableReference: string;
    note: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_update_academic_stream_assignment_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_stream_id: input.streamId,
      p_teacher_assignment_id: input.teacherAssignmentId,
      p_timetable_reference: input.timetableReference,
      p_note: input.note,
    },
  );
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsAcademicTarget(
  organisationId: string,
  userId: string,
  input: {
    streamId: string;
    weekNumber: number;
    targetReference: string;
    targetLabel: string;
    plannedStartDate?: string | null;
    plannedEndDate?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_add_academic_target_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_stream_id: input.streamId,
    p_week_number: input.weekNumber,
    p_target_reference: input.targetReference,
    p_target_label: input.targetLabel,
    p_planned_start_date: input.plannedStartDate ?? null,
    p_planned_end_date: input.plannedEndDate ?? null,
  });
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsAcademicTarget(
  organisationId: string,
  userId: string,
  input: {
    targetId: string;
    action: "ready" | "start" | "delivered" | "partial" | "missed";
    note?: string | null;
    reference?: string | null;
    causeCategory?: string | null;
    severity?: "P2" | "P3" | "P4";
  },
) {
  const { error } = await admin().rpc("khpos_ops_academic_target_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_target_id: input.targetId,
    p_action: input.action,
    p_note: input.note ?? null,
    p_reference: input.reference ?? null,
    p_cause_category: input.causeCategory ?? null,
    p_severity: input.severity ?? "P3",
  });
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function verifyKhposOpsAcademicTarget(
  organisationId: string,
  userId: string,
  input: {
    targetId: string;
    decision: "verify" | "reject";
    note: string;
    reference?: string | null;
    rejectionCauseCategory?: string | null;
    severity?: "P2" | "P3" | "P4";
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_verify_academic_target_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_target_id: input.targetId,
      p_decision: input.decision,
      p_note: input.note,
      p_reference: input.reference ?? null,
      p_rejection_cause_category: input.rejectionCauseCategory ?? "other",
      p_severity: input.severity ?? "P3",
    },
  );
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsAcademicDebt(
  organisationId: string,
  userId: string,
  input: {
    debtId: string;
    action: "plan" | "start" | "submit_evidence" | "verify" | "reopen";
    note?: string | null;
    dueDate?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_academic_debt_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_debt_id: input.debtId,
    p_action: input.action,
    p_note: input.note ?? null,
    p_due_date: input.dueDate ?? null,
    p_evidence_reference: input.evidenceReference ?? null,
  });
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function reassignKhposOpsAcademicDebt(
  organisationId: string,
  userId: string,
  input: {
    debtId: string;
    recoveryOwnerAssignmentId: string;
    note: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_reassign_academic_debt_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_debt_id: input.debtId,
      p_recovery_owner_assignment_id: input.recoveryOwnerAssignmentId,
      p_note: input.note,
    },
  );
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function escalateKhposOpsAcademicDebt(
  organisationId: string,
  userId: string,
  input: {
    debtId: string;
    severity: "P1" | "P2" | "P3" | "P4";
    reason: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_escalate_academic_debt_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_debt_id: input.debtId,
      p_severity: input.severity,
      p_reason: input.reason,
    },
  );
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsAcademicObservation(
  organisationId: string,
  userId: string,
  input: {
    streamId: string;
    targetId?: string | null;
    observationType: "micro" | "development" | "qa";
    observedAt?: string | null;
    strengths: string;
    improvementArea?: string | null;
    requiredAction?: string | null;
    actionDueDate?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_academic_observation_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_stream_id: input.streamId,
      p_target_id: input.targetId ?? null,
      p_observation_type: input.observationType,
      p_observed_at: input.observedAt ?? new Date().toISOString(),
      p_strengths: input.strengths,
      p_improvement_area: input.improvementArea ?? null,
      p_required_action: input.requiredAction ?? null,
      p_action_due_date: input.actionDueDate ?? null,
    },
  );
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsAcademicObservation(
  organisationId: string,
  userId: string,
  input: {
    observationId: string;
    action: "submit_followup" | "verify_followup" | "reopen_followup";
    note?: string | null;
    reference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_academic_observation_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_observation_id: input.observationId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_reference: input.reference ?? null,
    },
  );
  if (error) throw new KhposOpsAcademicDeliveryError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}
