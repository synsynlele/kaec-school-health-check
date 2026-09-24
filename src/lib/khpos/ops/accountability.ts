import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposOpsAccountabilityCaseType =
  | "corrective"
  | "grievance"
  | "formal_discipline";

export type KhposOpsAccountabilityStatus =
  | "open"
  | "awaiting_response"
  | "under_review"
  | "action_active"
  | "decision_recorded"
  | "resolved"
  | "external_review_required"
  | "referred_formal"
  | "withdrawn"
  | "cancelled"
  | "closed";

export type KhposOpsAccountabilityOutcome =
  | "no_action"
  | "expectation_reset"
  | "documented_reminder"
  | "conduct_commitment"
  | "corrective_action"
  | "written_warning"
  | "final_warning"
  | "other_proportionate_action"
  | "refer_separation_review"
  | "grievance_upheld"
  | "grievance_partially_upheld"
  | "grievance_not_upheld"
  | "grievance_resolved_by_agreement"
  | "grievance_referred_other_process";

export interface KhposOpsAccountabilityStaffOption {
  id: string;
  reference: string;
  displayName: string;
  userId: string | null;
  roleId: string;
  roleCode: string;
  roleTitle: string;
  roleLevel: number;
  campusName: string | null;
  unitName: string | null;
  isSelf: boolean;
  canManage: boolean;
}

export interface KhposOpsStaffRecognition {
  id: string;
  reference: string;
  staffId: string;
  staffName: string;
  roleTitle: string;
  category: string;
  title: string;
  evidenceNote: string;
  evidenceReference: string | null;
  issuedAt: string;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  canWithdraw: boolean;
}

export interface KhposOpsAccountabilityResponse {
  id: string;
  responseType: string;
  responseText: string;
  evidenceReference: string | null;
  submittedBy: string;
  createdAt: string;
}

export interface KhposOpsAccountabilityEvidence {
  id: string;
  evidenceType: string;
  title: string;
  note: string;
  evidenceReference: string | null;
  addedBy: string;
  createdAt: string;
}

export interface KhposOpsCorrectiveAction {
  id: string;
  actionType: string;
  title: string;
  expectedChange: string;
  dueDate: string;
  status: "open" | "in_progress" | "evidence_submitted" | "verified" | "cancelled";
  ownerUserId: string;
  isOwner: boolean;
  canVerify: boolean;
  completionNote: string | null;
  evidenceReference: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
}

export interface KhposOpsAccountabilityCase {
  id: string;
  reference: string;
  caseType: KhposOpsAccountabilityCaseType;
  sourceCaseId: string | null;
  reporterStaffId: string | null;
  reporterName: string | null;
  subjectStaffId: string | null;
  subjectName: string | null;
  subjectRoleTitle: string | null;
  grievanceTarget: string | null;
  title: string;
  statement: string;
  relevantStandard: string | null;
  incidentAt: string | null;
  desiredResolution: string | null;
  classificationNote: string | null;
  responseDueAt: string | null;
  responseState:
    | "not_requested"
    | "requested"
    | "submitted"
    | "no_response_recorded";
  hearingRequired: boolean;
  hearingCompletedAt: string | null;
  status: KhposOpsAccountabilityStatus;
  outcome: KhposOpsAccountabilityOutcome | null;
  outcomeNote: string | null;
  decisionSource: "internal" | "external" | null;
  authorityReviewReference: string | null;
  decidedAt: string | null;
  outcomeDeliveredAt: string | null;
  outcomeAcknowledgedAt: string | null;
  createdAt: string;
  isReporter: boolean;
  isSubject: boolean;
  canManage: boolean;
  canRecordExternalReview: boolean;
  responses: KhposOpsAccountabilityResponse[];
  evidence: KhposOpsAccountabilityEvidence[];
  correctiveActions: KhposOpsCorrectiveAction[];
  history: Array<{
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    createdAt: string;
  }>;
}

export interface KhposOpsStaffAccountabilityWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  actorStaffId: string | null;
  canManageAnyStaff: boolean;
  principle: string;
  legalBoundary: string;
  staffOptions: KhposOpsAccountabilityStaffOption[];
  recognitions: KhposOpsStaffRecognition[];
  summary: {
    activeCases: number;
    awaitingResponse: number;
    correctiveActive: number;
    formalActive: number;
    grievancesActive: number;
    externalReviewRequired: number;
    recognitions: number;
  };
  cases: KhposOpsAccountabilityCase[];
}

export class KhposOpsAccountabilityError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsAccountabilityError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsAccountabilityError(
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
  return /membership|partnership|only the|outside your|appropriate reporting|cannot|requires independent|not found/i.test(
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
): Promise<KhposOpsStaffAccountabilityWorkspace> {
  return getKhposOpsStaffAccountability(organisationId, userId);
}

export async function getKhposOpsStaffAccountability(
  organisationId: string,
  userId: string,
): Promise<KhposOpsStaffAccountabilityWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_staff_accountability_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsAccountabilityError(
      error?.message ?? "Recognition & Accountability workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsStaffAccountabilityWorkspace;
}

export async function issueKhposOpsStaffRecognition(
  organisationId: string,
  userId: string,
  input: {
    staffId: string;
    category: string;
    title: string;
    evidenceNote: string;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_issue_staff_recognition_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_staff_id: input.staffId,
      p_category: input.category,
      p_title: input.title,
      p_evidence_note: input.evidenceNote,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function withdrawKhposOpsStaffRecognition(
  organisationId: string,
  userId: string,
  recognitionId: string,
  reason: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_withdraw_staff_recognition_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_recognition_id: recognitionId,
      p_reason: reason,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsAccountabilityCase(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_accountability_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_input: input,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function requestKhposOpsAccountabilityResponse(
  organisationId: string,
  userId: string,
  caseId: string,
  responseDueAt: string,
  note?: string | null,
) {
  const { error } = await admin().rpc(
    "khpos_ops_accountability_request_response_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: caseId,
      p_response_due_at: responseDueAt,
      p_note: note ?? null,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function submitKhposOpsAccountabilityResponse(
  organisationId: string,
  userId: string,
  caseId: string,
  responseText: string,
  evidenceReference?: string | null,
) {
  const { error } = await admin().rpc(
    "khpos_ops_submit_accountability_response_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: caseId,
      p_response_text: responseText,
      p_evidence_reference: evidenceReference ?? null,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function recordKhposOpsAccountabilityNoResponse(
  organisationId: string,
  userId: string,
  caseId: string,
  note: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_accountability_record_no_response_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: caseId,
      p_note: note,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsAccountabilityEvidence(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    evidenceType: string;
    title: string;
    note: string;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_add_accountability_evidence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_evidence_type: input.evidenceType,
      p_title: input.title,
      p_note: input.note,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function recordKhposOpsAccountabilityHearing(
  organisationId: string,
  userId: string,
  caseId: string,
  hearingRecord: string,
  evidenceReference?: string | null,
) {
  const { error } = await admin().rpc(
    "khpos_ops_record_accountability_hearing_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: caseId,
      p_hearing_record: hearingRecord,
      p_evidence_reference: evidenceReference ?? null,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsCorrectiveAction(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    actionType: string;
    title: string;
    expectedChange: string;
    dueDate: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_corrective_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_action_type: input.actionType,
      p_title: input.title,
      p_expected_change: input.expectedChange,
      p_due_date: input.dueDate,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsCorrectiveAction(
  organisationId: string,
  userId: string,
  input: {
    actionId: string;
    action: "start" | "submit_evidence" | "verify" | "reopen" | "cancel";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_corrective_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_action_id: input.actionId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function decideKhposOpsAccountabilityCase(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    outcome: KhposOpsAccountabilityOutcome;
    outcomeNote: string;
    authorityReviewReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_accountability_decide_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_outcome: input.outcome,
      p_outcome_note: input.outcomeNote,
      p_authority_review_reference: input.authorityReviewReference ?? null,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function recordKhposOpsExternalAccountabilityReview(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    outcome: KhposOpsAccountabilityOutcome;
    outcomeNote: string;
    externalReviewReference: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_record_external_accountability_review_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_outcome: input.outcome,
      p_outcome_note: input.outcomeNote,
      p_external_review_reference: input.externalReviewReference,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function acknowledgeKhposOpsAccountabilityOutcome(
  organisationId: string,
  userId: string,
  caseId: string,
  note?: string | null,
) {
  const { error } = await admin().rpc(
    "khpos_ops_accountability_acknowledge_outcome_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: caseId,
      p_note: note ?? null,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsAccountabilityCase(
  organisationId: string,
  userId: string,
  caseId: string,
  action:
    | "acknowledge_grievance"
    | "refer_formal"
    | "resolve_corrective"
    | "withdraw_grievance"
    | "cancel"
    | "close",
  note?: string | null,
) {
  const { error } = await admin().rpc(
    "khpos_ops_accountability_case_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: caseId,
      p_action: action,
      p_note: note ?? null,
    },
  );
  if (error) throw new KhposOpsAccountabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}
