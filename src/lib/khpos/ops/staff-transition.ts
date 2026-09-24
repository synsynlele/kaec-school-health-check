import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsTransitionRole {
  id: string;
  code: string;
  title: string;
  level: number;
  reportsToRoleId: string | null;
  charterActive: boolean;
}

export interface KhposOpsTransitionStaff {
  id: string;
  reference: string;
  displayName: string;
  userId: string | null;
  status: "active" | "exiting";
  roleId: string;
  roleCode: string;
  roleTitle: string;
  roleLevel: number;
  roleAssignmentId: string | null;
  campusId: string | null;
  unitId: string | null;
  isSelf: boolean;
  canManage: boolean;
}

export interface KhposOpsTransitionAssignment {
  id: string;
  userId: string;
  roleId: string;
  roleCode: string;
  roleTitle: string;
  roleLevel: number;
  campusId: string | null;
  unitId: string | null;
  primary: boolean;
}

export interface KhposOpsProgressionEvidence {
  id: string;
  evidenceType: string;
  title: string;
  note: string;
  evidenceReference: string | null;
  createdAt: string;
}

export interface KhposOpsTransitionItem {
  id: string;
  itemCode: string;
  itemType: string;
  title: string;
  description: string;
  completionPhase: "pre_execute" | "at_execute";
  mandatory: boolean;
  ownerUserId: string;
  recipientAssignmentId: string | null;
  dueDate: string;
  status:
    | "pending"
    | "in_progress"
    | "evidence_submitted"
    | "verified"
    | "waived";
  completionNote: string | null;
  evidenceReference: string | null;
  isOwner: boolean;
  canVerify: boolean;
}

export interface KhposOpsSuccessionPlan {
  id: string;
  reference: string;
  staffId: string;
  staffName: string;
  currentRoleTitle: string;
  targetRoleId: string;
  targetRoleCode: string;
  targetRoleTitle: string;
  targetRoleLevel: number;
  readinessState:
    | "exploring"
    | "developing"
    | "ready_with_support"
    | "ready_now"
    | "not_ready";
  readinessSummary: string;
  developmentPriorities: string | null;
  targetHorizon: string | null;
  externalGovernanceRequired: boolean;
  status: "active" | "achieved" | "withdrawn" | "archived";
  isSelf: boolean;
  canManage: boolean;
  evidence: KhposOpsProgressionEvidence[];
}

export interface KhposOpsPromotionCase {
  id: string;
  reference: string;
  staffId: string;
  staffName: string;
  fromRoleTitle: string;
  targetRoleId: string;
  targetRoleCode: string;
  targetRoleTitle: string;
  targetCampusId: string | null;
  targetUnitId: string | null;
  proposedEffectiveDate: string;
  justification: string;
  readinessSummary: string;
  staffAcceptanceState: "pending" | "accepted" | "declined";
  staffResponseNote: string | null;
  continuityRecipientAssignmentId: string | null;
  targetSupervisorAssignmentId: string | null;
  status:
    | "awaiting_acceptance"
    | "under_review"
    | "approved"
    | "external_governance_required"
    | "executed"
    | "declined"
    | "cancelled";
  externalGovernanceRequired: boolean;
  authorityReviewReference: string | null;
  approvalNote: string | null;
  approvedAt: string | null;
  executedAt: string | null;
  newAssignmentId: string | null;
  isSelf: boolean;
  canManage: boolean;
  evidence: KhposOpsProgressionEvidence[];
  items: KhposOpsTransitionItem[];
}

export interface KhposOpsExitCase {
  id: string;
  reference: string;
  staffId: string;
  staffName: string;
  roleTitle: string;
  roleCode: string;
  exitType: string;
  proposedLastDay: string;
  basisReference: string;
  authorityReviewReference: string | null;
  reasonNote: string | null;
  initiatedByStaff: boolean;
  continuityRecipientAssignmentId: string | null;
  replacementRequired: boolean;
  status: "open" | "clearance_in_progress" | "ended" | "cancelled" | "closed";
  actualLastDay: string | null;
  endedAt: string | null;
  isSelf: boolean;
  canManage: boolean;
  items: KhposOpsTransitionItem[];
}

export interface KhposOpsStaffTransitionWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  actorStaffId: string | null;
  canManagePeople: boolean;
  principle: string;
  legalBoundary: string;
  roles: KhposOpsTransitionRole[];
  staff: KhposOpsTransitionStaff[];
  assignments: KhposOpsTransitionAssignment[];
  successionPlans: KhposOpsSuccessionPlan[];
  promotionCases: KhposOpsPromotionCase[];
  exitCases: KhposOpsExitCase[];
  summary: {
    activeSuccession: number;
    readyNow: number;
    openPromotions: number;
    openExits: number;
  };
}

export class KhposOpsStaffTransitionError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsStaffTransitionError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsStaffTransitionError(
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
  return /membership|partnership|only the|competent authority|outside your visibility|cannot|requires external|not found/i.test(
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
): Promise<KhposOpsStaffTransitionWorkspace> {
  return getKhposOpsStaffTransition(organisationId, userId);
}

export async function getKhposOpsStaffTransition(
  organisationId: string,
  userId: string,
): Promise<KhposOpsStaffTransitionWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_staff_transition_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsStaffTransitionError(
      error?.message ?? "Progression & Exit workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsStaffTransitionWorkspace;
}

export async function createKhposOpsSuccessionPlan(
  organisationId: string,
  userId: string,
  input: {
    staffId: string;
    targetRoleId: string;
    readinessState: string;
    readinessSummary: string;
    developmentPriorities?: string | null;
    targetHorizon?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_succession_plan_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_staff_id: input.staffId,
      p_target_role_id: input.targetRoleId,
      p_readiness_state: input.readinessState,
      p_readiness_summary: input.readinessSummary,
      p_development_priorities: input.developmentPriorities ?? null,
      p_target_horizon: input.targetHorizon ?? null,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function updateKhposOpsSuccessionPlan(
  organisationId: string,
  userId: string,
  input: {
    planId: string;
    readinessState: string;
    readinessSummary: string;
    developmentPriorities?: string | null;
    targetHorizon?: string | null;
    reviewNote?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_update_succession_plan_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_plan_id: input.planId,
      p_readiness_state: input.readinessState,
      p_readiness_summary: input.readinessSummary,
      p_development_priorities: input.developmentPriorities ?? null,
      p_target_horizon: input.targetHorizon ?? null,
      p_review_note: input.reviewNote ?? null,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsSuccessionPlan(
  organisationId: string,
  userId: string,
  planId: string,
  action: "withdraw" | "archive",
  note?: string | null,
) {
  const { error } = await admin().rpc(
    "khpos_ops_succession_plan_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_plan_id: planId,
      p_action: action,
      p_note: note ?? null,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsProgressionEvidence(
  organisationId: string,
  userId: string,
  input: {
    parentType: "succession" | "promotion";
    parentId: string;
    evidenceType: string;
    title: string;
    note: string;
    evidenceReference?: string | null;
    sourcePerformanceReviewId?: string | null;
    sourceRecognitionId?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_add_progression_evidence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_parent_type: input.parentType,
      p_parent_id: input.parentId,
      p_evidence_type: input.evidenceType,
      p_title: input.title,
      p_note: input.note,
      p_evidence_reference: input.evidenceReference ?? null,
      p_source_performance_review_id: input.sourcePerformanceReviewId ?? null,
      p_source_recognition_id: input.sourceRecognitionId ?? null,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsPromotionCase(
  organisationId: string,
  userId: string,
  input: {
    staffId: string;
    targetRoleId: string;
    targetCampusId?: string | null;
    targetUnitId?: string | null;
    proposedEffectiveDate: string;
    justification: string;
    readinessSummary: string;
    sourceSuccessionPlanId?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_promotion_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_staff_id: input.staffId,
      p_target_role_id: input.targetRoleId,
      p_target_campus_id: input.targetCampusId ?? null,
      p_target_unit_id: input.targetUnitId ?? null,
      p_proposed_effective_date: input.proposedEffectiveDate,
      p_justification: input.justification,
      p_readiness_summary: input.readinessSummary,
      p_source_succession_plan_id: input.sourceSuccessionPlanId ?? null,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function respondToKhposOpsPromotion(
  organisationId: string,
  userId: string,
  promotionCaseId: string,
  response: "accept" | "decline",
  note?: string | null,
) {
  const { error } = await admin().rpc(
    "khpos_ops_promotion_staff_response_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_promotion_case_id: promotionCaseId,
      p_response: response,
      p_note: note ?? null,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function approveKhposOpsPromotion(
  organisationId: string,
  userId: string,
  input: {
    promotionCaseId: string;
    continuityRecipientAssignmentId: string;
    targetSupervisorAssignmentId: string;
    approvalNote: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_approve_promotion_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_promotion_case_id: input.promotionCaseId,
      p_continuity_recipient_assignment_id:
        input.continuityRecipientAssignmentId,
      p_target_supervisor_assignment_id: input.targetSupervisorAssignmentId,
      p_approval_note: input.approvalNote,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsTransitionItem(
  organisationId: string,
  userId: string,
  input: {
    parentType: "promotion" | "exit";
    parentId: string;
    itemType: string;
    title: string;
    description: string;
    ownerUserId: string;
    recipientAssignmentId?: string | null;
    dueDate: string;
    mandatory?: boolean;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_add_transition_item_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_parent_type: input.parentType,
      p_parent_id: input.parentId,
      p_item_type: input.itemType,
      p_title: input.title,
      p_description: input.description,
      p_owner_user_id: input.ownerUserId,
      p_recipient_assignment_id: input.recipientAssignmentId ?? null,
      p_due_date: input.dueDate,
      p_mandatory: input.mandatory ?? true,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsTransitionItem(
  organisationId: string,
  userId: string,
  input: {
    itemId: string;
    action: "start" | "submit_evidence" | "verify" | "reopen" | "waive";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_transition_item_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_item_id: input.itemId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function executeKhposOpsPromotion(
  organisationId: string,
  userId: string,
  promotionCaseId: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_execute_promotion_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_promotion_case_id: promotionCaseId,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsPromotionCase(
  organisationId: string,
  userId: string,
  promotionCaseId: string,
  action: "cancel",
  note: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_promotion_case_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_promotion_case_id: promotionCaseId,
      p_action: action,
      p_note: note,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsExitCase(
  organisationId: string,
  userId: string,
  input: {
    staffId: string;
    exitType: string;
    proposedLastDay: string;
    basisReference: string;
    reasonNote?: string | null;
    authorityReviewReference?: string | null;
    sourceAccountabilityCaseId?: string | null;
    replacementRequired?: boolean;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_exit_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_staff_id: input.staffId,
      p_exit_type: input.exitType,
      p_proposed_last_day: input.proposedLastDay,
      p_basis_reference: input.basisReference,
      p_reason_note: input.reasonNote ?? null,
      p_authority_review_reference: input.authorityReviewReference ?? null,
      p_source_accountability_case_id: input.sourceAccountabilityCaseId ?? null,
      p_replacement_required: input.replacementRequired ?? true,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function updateKhposOpsExitSchedule(
  organisationId: string,
  userId: string,
  input: {
    exitCaseId: string;
    proposedLastDay: string;
    basisReference: string;
    authorityReviewReference?: string | null;
    note?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_update_exit_schedule_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_exit_case_id: input.exitCaseId,
      p_proposed_last_day: input.proposedLastDay,
      p_basis_reference: input.basisReference,
      p_authority_review_reference: input.authorityReviewReference ?? null,
      p_note: input.note ?? null,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function startKhposOpsExitClearance(
  organisationId: string,
  userId: string,
  exitCaseId: string,
  continuityRecipientAssignmentId: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_start_exit_clearance_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_exit_case_id: exitCaseId,
      p_continuity_recipient_assignment_id: continuityRecipientAssignmentId,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function finalizeKhposOpsStaffExit(
  organisationId: string,
  userId: string,
  exitCaseId: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_finalize_staff_exit_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_exit_case_id: exitCaseId,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsExitCase(
  organisationId: string,
  userId: string,
  input: {
    exitCaseId: string;
    action: "withdraw_request" | "cancel" | "close";
    note?: string | null;
    reference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_exit_case_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_exit_case_id: input.exitCaseId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_reference: input.reference ?? null,
    },
  );
  if (error) throw new KhposOpsStaffTransitionError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}
