import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsAssuranceTerm {
  id: string;
  campusId: string | null;
  sessionLabel: string;
  termCode: string;
  termName: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "closed" | "cancelled";
}

export interface KhposOpsAssuranceStream {
  id: string;
  termId: string;
  campusId: string | null;
  classLabel: string;
  sectionLabel: string | null;
  subjectLabel: string;
  subjectCode: string | null;
  teacherAssignmentId: string;
  teacherUserId: string;
  status: string;
  isTeacher: boolean;
}

export interface KhposOpsAssuranceAssignment {
  id: string;
  userId: string;
  roleCode: string;
  roleTitle: string;
  campusId: string | null;
  unitId: string | null;
  displayName: string;
}

export interface KhposOpsAssessmentPackage {
  id: string;
  streamId: string;
  reference: string;
  assessmentSource: string;
  sourceReference: string;
  blueprintReference: string;
  integrityDeclaration: boolean;
  moderationState:
    | "draft"
    | "submitted"
    | "changes_required"
    | "approved"
    | "withdrawn";
  submittedBy: string | null;
  submittedAt: string | null;
  moderatorUserId: string | null;
  moderationNote: string | null;
  moderatedAt: string | null;
  approvedAt: string | null;
  isSubmitter: boolean;
  canModerate: boolean;
}

export interface KhposOpsReadinessItem {
  id: string;
  streamId: string | null;
  itemCode: string;
  category: string;
  title: string;
  description: string;
  ownerAssignmentId: string;
  dueDate: string;
  mandatory: boolean;
  status:
    | "pending"
    | "in_progress"
    | "evidence_submitted"
    | "verified"
    | "exception_accepted";
  completionNote: string | null;
  evidenceReference: string | null;
  exceptionReason: string | null;
  exceptionReference: string | null;
  isOwner: boolean;
  canVerify: boolean;
}

export interface KhposOpsAssessmentCycle {
  id: string;
  termId: string;
  campusId: string | null;
  reference: string;
  title: string;
  cycleType: string;
  examBodyLabel: string | null;
  startsOn: string;
  endsOn: string;
  resultsDueOn: string | null;
  externalSystem: string | null;
  externalReference: string | null;
  status:
    | "draft"
    | "planned"
    | "ready"
    | "in_progress"
    | "results_pending"
    | "closed"
    | "cancelled";
  canManage: boolean;
  packages: KhposOpsAssessmentPackage[];
  readinessItems: KhposOpsReadinessItem[];
}

export interface KhposOpsIntegrityEvidence {
  id: string;
  evidenceType: string;
  title: string;
  note: string;
  evidenceReference: string | null;
  createdAt: string;
}

export interface KhposOpsIntegrityCase {
  id: string;
  termId: string;
  cycleId: string | null;
  streamId: string | null;
  learnerId: string | null;
  learnerName: string | null;
  subjectStaffId: string | null;
  subjectStaffName: string | null;
  reference: string;
  subjectType: "learner" | "staff" | "process" | "system";
  incidentType: string;
  severity: "standard" | "high" | "critical";
  incidentSummary: string;
  sourceReference: string | null;
  representationNote: string | null;
  representationReference: string | null;
  representationRecordedAt: string | null;
  reportedBy: string;
  reportedAt: string;
  status: "open" | "under_review" | "decision_recorded" | "referred" | "closed";
  outcome: string | null;
  academicAction: string | null;
  decisionNote: string | null;
  relatedProcessReference: string | null;
  decidedAt: string | null;
  isReporter: boolean;
  canDecide: boolean;
  evidence: KhposOpsIntegrityEvidence[];
}

export interface KhposOpsResultCorrection {
  id: string;
  termId: string;
  cycleId: string;
  streamId: string;
  learnerId: string | null;
  reference: string;
  externalResultReference: string;
  correctionType: string;
  requestNote: string;
  requestedBy: string;
  requestedAt: string;
  status:
    | "requested"
    | "approved"
    | "rejected"
    | "implemented"
    | "verified"
    | "cancelled";
  decisionNote: string | null;
  implementationReference: string | null;
  implementationNote: string | null;
  implementedBy: string | null;
  implementedAt: string | null;
  verifiedAt: string | null;
  isRequester: boolean;
  canReview: boolean;
  canVerify: boolean;
}

export interface KhposOpsAcademicCloseout {
  id: string;
  termId: string;
  reference: string;
  curriculumSummary: string;
  assessmentSummary: string;
  learnerSupportSummary: string;
  integritySummary: string;
  externalExamSummary: string | null;
  lessonsSummary: string;
  carryoverReference: string | null;
  evidenceReference: string | null;
  status: "draft" | "in_review" | "approved" | "closed" | "cancelled";
  preparedBy: string;
  preparedAt: string;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  canApprove: boolean;
}

export interface KhposOpsAcademicAssuranceWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canManage: boolean;
  canCoordinate: boolean;
  executiveSummaryOnly: boolean;
  principle: string;
  technologyBoundary: string;
  terms: KhposOpsAssuranceTerm[];
  streams: KhposOpsAssuranceStream[];
  assignments: KhposOpsAssuranceAssignment[];
  learners: Array<{
    id: string;
    displayName: string;
    campusId: string | null;
    classLabel: string;
    sectionLabel: string | null;
  }>;
  staff: Array<{
    id: string;
    displayName: string;
    roleCode: string;
    roleTitle: string;
  }>;
  cycles: KhposOpsAssessmentCycle[];
  integrityCases: KhposOpsIntegrityCase[];
  resultCorrections: KhposOpsResultCorrection[];
  closeouts: KhposOpsAcademicCloseout[];
  summary: {
    activeCycles: number;
    packagesAwaitingModeration: number;
    unresolvedReadiness: number;
    openIntegrityCases: number;
    openResultCorrections: number;
    closeoutsAwaitingApproval: number;
  };
}

export class KhposOpsAcademicAssuranceError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsAcademicAssuranceError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsAcademicAssuranceError(
      "KHP-OS Academic Assurance is not configured.",
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
  return /membership|only |cannot|outside|not authorised|requires|not found/i.test(
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
): Promise<KhposOpsAcademicAssuranceWorkspace> {
  return getKhposOpsAcademicAssurance(organisationId, userId);
}

async function rpc(
  name: string,
  args: Record<string, unknown>,
  organisationId: string,
  userId: string,
) {
  const { error } = await admin().rpc(name, args);
  if (error) {
    throw new KhposOpsAcademicAssuranceError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function getKhposOpsAcademicAssurance(
  organisationId: string,
  userId: string,
): Promise<KhposOpsAcademicAssuranceWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_academic_assurance_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );
  if (error || !isObject(data)) {
    throw new KhposOpsAcademicAssuranceError(
      error?.message ?? "Academic Assurance workspace could not be loaded.",
      statusFor(error?.message),
    );
  }
  return data as unknown as KhposOpsAcademicAssuranceWorkspace;
}

export async function createKhposOpsAssessmentCycle(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_create_assessment_cycle_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_term_id: input.termId,
      p_campus_id: input.campusId ?? null,
      p_title: input.title,
      p_cycle_type: input.cycleType,
      p_exam_body_label: input.examBodyLabel ?? null,
      p_starts_on: input.startsOn,
      p_ends_on: input.endsOn,
      p_results_due_on: input.resultsDueOn ?? null,
      p_external_system: input.externalSystem ?? null,
      p_external_reference: input.externalReference ?? null,
    },
    organisationId,
    userId,
  );
}

export async function actOnKhposOpsAssessmentCycle(
  organisationId: string,
  userId: string,
  cycleId: string,
  action: string,
  note?: string | null,
) {
  return rpc(
    "khpos_ops_assessment_cycle_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_cycle_id: cycleId,
      p_action: action,
      p_note: note ?? null,
    },
    organisationId,
    userId,
  );
}

export async function createKhposOpsAssessmentPackage(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_create_assessment_package_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_cycle_id: input.cycleId,
      p_stream_id: input.streamId,
      p_assessment_source: input.assessmentSource,
      p_source_reference: input.sourceReference,
      p_blueprint_reference: input.blueprintReference,
      p_integrity_declaration: input.integrityDeclaration,
    },
    organisationId,
    userId,
  );
}

export async function updateKhposOpsAssessmentPackage(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_update_assessment_package_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_package_id: input.packageId,
      p_assessment_source: input.assessmentSource,
      p_source_reference: input.sourceReference,
      p_blueprint_reference: input.blueprintReference,
      p_integrity_declaration: input.integrityDeclaration,
    },
    organisationId,
    userId,
  );
}

export async function actOnKhposOpsAssessmentPackage(
  organisationId: string,
  userId: string,
  packageId: string,
  action: string,
  note?: string | null,
) {
  return rpc(
    "khpos_ops_assessment_package_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_package_id: packageId,
      p_action: action,
      p_note: note ?? null,
    },
    organisationId,
    userId,
  );
}

export async function createKhposOpsReadinessItem(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_create_exam_readiness_item_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_cycle_id: input.cycleId,
      p_stream_id: input.streamId ?? null,
      p_category: input.category,
      p_title: input.title,
      p_description: input.description,
      p_owner_assignment_id: input.ownerAssignmentId,
      p_due_date: input.dueDate,
      p_mandatory: input.mandatory ?? true,
    },
    organisationId,
    userId,
  );
}

export async function actOnKhposOpsReadinessItem(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_exam_readiness_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_item_id: input.itemId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
    organisationId,
    userId,
  );
}

export async function reportKhposOpsIntegrityCase(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_report_integrity_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_term_id: input.termId,
      p_cycle_id: input.cycleId ?? null,
      p_stream_id: input.streamId ?? null,
      p_subject_type: input.subjectType,
      p_learner_id: input.learnerId ?? null,
      p_subject_staff_id: input.subjectStaffId ?? null,
      p_incident_type: input.incidentType,
      p_severity: input.severity,
      p_incident_summary: input.incidentSummary,
      p_source_reference: input.sourceReference ?? null,
    },
    organisationId,
    userId,
  );
}

export async function addKhposOpsIntegrityEvidence(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_add_integrity_evidence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_evidence_type: input.evidenceType,
      p_title: input.title,
      p_note: input.note,
      p_evidence_reference: input.evidenceReference ?? null,
    },
    organisationId,
    userId,
  );
}

export async function recordKhposOpsIntegrityRepresentation(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_record_integrity_representation_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_representation_note: input.representationNote,
      p_representation_reference: input.representationReference ?? null,
    },
    organisationId,
    userId,
  );
}

export async function decideKhposOpsIntegrityCase(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_decide_integrity_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_outcome: input.outcome,
      p_academic_action: input.academicAction,
      p_decision_note: input.decisionNote,
      p_related_process_reference: input.relatedProcessReference ?? null,
    },
    organisationId,
    userId,
  );
}

export async function actOnKhposOpsIntegrityCase(
  organisationId: string,
  userId: string,
  caseId: string,
  action: string,
  note?: string | null,
) {
  return rpc(
    "khpos_ops_integrity_case_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: caseId,
      p_action: action,
      p_note: note ?? null,
    },
    organisationId,
    userId,
  );
}

export async function requestKhposOpsResultCorrection(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_request_result_correction_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_cycle_id: input.cycleId,
      p_stream_id: input.streamId,
      p_learner_id: input.learnerId ?? null,
      p_integrity_case_id: input.integrityCaseId ?? null,
      p_external_result_reference: input.externalResultReference,
      p_correction_type: input.correctionType,
      p_request_note: input.requestNote,
    },
    organisationId,
    userId,
  );
}

export async function actOnKhposOpsResultCorrection(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_result_correction_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_correction_id: input.correctionId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_reference: input.reference ?? null,
    },
    organisationId,
    userId,
  );
}

export async function createKhposOpsAcademicCloseout(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_create_academic_closeout_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_term_id: input.termId,
      p_curriculum_summary: input.curriculumSummary,
      p_assessment_summary: input.assessmentSummary,
      p_learner_support_summary: input.learnerSupportSummary,
      p_integrity_summary: input.integritySummary,
      p_external_exam_summary: input.externalExamSummary ?? null,
      p_lessons_summary: input.lessonsSummary,
      p_carryover_reference: input.carryoverReference ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
    organisationId,
    userId,
  );
}

export async function updateKhposOpsAcademicCloseout(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  return rpc(
    "khpos_ops_update_academic_closeout_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_closeout_id: input.closeoutId,
      p_curriculum_summary: input.curriculumSummary,
      p_assessment_summary: input.assessmentSummary,
      p_learner_support_summary: input.learnerSupportSummary,
      p_integrity_summary: input.integritySummary,
      p_external_exam_summary: input.externalExamSummary ?? null,
      p_lessons_summary: input.lessonsSummary,
      p_carryover_reference: input.carryoverReference ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
    organisationId,
    userId,
  );
}

export async function actOnKhposOpsAcademicCloseout(
  organisationId: string,
  userId: string,
  closeoutId: string,
  action: string,
  note?: string | null,
) {
  return rpc(
    "khpos_ops_academic_closeout_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_closeout_id: closeoutId,
      p_action: action,
      p_note: note ?? null,
    },
    organisationId,
    userId,
  );
}
