import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposOpsStaffReviewType =
  | "probation"
  | "monthly_check_in"
  | "term_review"
  | "annual_review"
  | "support_review";

export type KhposOpsStaffReviewStatus =
  | "open"
  | "self_submitted"
  | "leader_reviewed"
  | "completed"
  | "cancelled";

export type KhposOpsPerformanceState =
  | "not_assessed"
  | "on_track"
  | "support_required"
  | "improvement_required";

export type KhposOpsDevelopmentActionType =
  | "coaching"
  | "training"
  | "practice"
  | "observation"
  | "process_support"
  | "resource_support"
  | "other";

export interface KhposOpsRoleKpiContext {
  kpiId: string;
  code: string;
  name: string;
  definition: string;
  indicatorType: "outcome" | "process" | "risk";
  unit: string;
  direction:
    | "baseline_only"
    | "higher_is_better"
    | "lower_is_better"
    | "binary_control";
  cadence: string;
  criticalControl: boolean;
  latestMeasurement: {
    id: string;
    periodStart: string;
    periodEnd: string;
    value: number;
    performanceStatus: "unbaselined" | "green" | "amber" | "red" | "critical";
    note: string | null;
    evidenceReference: string | null;
  } | null;
}

export interface KhposOpsPerformanceStaffOption {
  id: string;
  reference: string;
  displayName: string;
  userId: string | null;
  roleId: string;
  roleCode: string;
  roleTitle: string;
  roleLevel: number;
  assignmentId: string;
  campusName: string | null;
  unitName: string | null;
  isSelf: boolean;
  canReview: boolean;
  roleKpis: KhposOpsRoleKpiContext[];
}

export interface KhposOpsPerformanceEvidence {
  id: string;
  evidenceType:
    | "role_outcome"
    | "observation"
    | "kpi"
    | "work_execution"
    | "issue_pattern"
    | "feedback"
    | "development"
    | "other";
  title: string;
  note: string;
  reference: string | null;
  createdAt: string;
  kpiMeasurement: {
    id: string;
    kpiCode: string;
    kpiName: string;
    periodStart: string;
    periodEnd: string;
    value: number;
    performanceStatus: string;
    note: string | null;
    evidenceReference: string | null;
  } | null;
}

export interface KhposOpsDevelopmentAction {
  id: string;
  actionType: KhposOpsDevelopmentActionType;
  title: string;
  description: string;
  ownerUserId: string;
  ownerName: string;
  dueDate: string;
  status: "open" | "in_progress" | "evidence_submitted" | "verified" | "cancelled";
  evidenceReference: string | null;
  completionNote: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  isOwner: boolean;
  canVerify: boolean;
}

export interface KhposOpsPerformanceEvent {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
}

export interface KhposOpsStaffPerformanceReview {
  id: string;
  reference: string;
  staffId: string;
  staffName: string;
  staffReference: string;
  roleTitle: string;
  campusName: string | null;
  unitName: string | null;
  reviewType: KhposOpsStaffReviewType;
  periodStart: string;
  periodEnd: string;
  status: KhposOpsStaffReviewStatus;
  performanceState: KhposOpsPerformanceState;
  selfReflection: string | null;
  selfStrengths: string | null;
  selfSupportNeeded: string | null;
  selfSubmittedAt: string | null;
  leaderSummary: string | null;
  strengths: string | null;
  growthAreas: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  isSelf: boolean;
  canReview: boolean;
  evidence: KhposOpsPerformanceEvidence[];
  developmentActions: KhposOpsDevelopmentAction[];
  history: KhposOpsPerformanceEvent[];
}

export interface KhposOpsStaffPerformanceWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canManagePeople: boolean;
  principle: string;
  staffOptions: KhposOpsPerformanceStaffOption[];
  summary: {
    openReviews: number;
    selfReflectionsDue: number;
    leaderReviewsDue: number;
    overdueDevelopmentActions: number;
    improvementRequired: number;
  };
  reviews: KhposOpsStaffPerformanceReview[];
}

export class KhposOpsStaffPerformanceError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsStaffPerformanceError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsStaffPerformanceError(
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
  return /membership|partnership|only the|outside your|cannot|not found|not active|required|must belong|must have/i.test(
    message ?? "",
  )
    ? 403
    : /not configured|does not exist|function .* does not exist/i.test(
          message ?? "",
        )
      ? 503
      : 400;
}

export async function getKhposOpsStaffPerformance(
  organisationId: string,
  userId: string,
): Promise<KhposOpsStaffPerformanceWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_staff_performance_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsStaffPerformanceError(
      error?.message ?? "Staff performance workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsStaffPerformanceWorkspace;
}

export async function createKhposOpsStaffReview(
  organisationId: string,
  userId: string,
  input: {
    staffId: string;
    reviewType: KhposOpsStaffReviewType;
    periodStart: string;
    periodEnd: string;
  },
): Promise<KhposOpsStaffPerformanceWorkspace> {
  const { error } = await admin().rpc("khpos_ops_create_staff_review_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_input: input,
  });

  if (error) {
    throw new KhposOpsStaffPerformanceError(
      error.message,
      statusFor(error.message),
    );
  }

  return getKhposOpsStaffPerformance(organisationId, userId);
}

export async function submitKhposOpsStaffReflection(
  organisationId: string,
  userId: string,
  input: {
    reviewId: string;
    reflection: string;
    strengths: string;
    supportNeeded?: string | null;
  },
): Promise<KhposOpsStaffPerformanceWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_submit_staff_reflection_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_review_id: input.reviewId,
      p_reflection: input.reflection,
      p_strengths: input.strengths,
      p_support_needed: input.supportNeeded ?? null,
    },
  );

  if (error) {
    throw new KhposOpsStaffPerformanceError(
      error.message,
      statusFor(error.message),
    );
  }

  return getKhposOpsStaffPerformance(organisationId, userId);
}

export async function addKhposOpsStaffPerformanceEvidence(
  organisationId: string,
  userId: string,
  input: {
    reviewId: string;
    evidenceType: KhposOpsPerformanceEvidence["evidenceType"];
    title: string;
    note: string;
    reference?: string | null;
    kpiMeasurementId?: string | null;
  },
): Promise<KhposOpsStaffPerformanceWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_add_staff_performance_evidence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_review_id: input.reviewId,
      p_evidence_type: input.evidenceType,
      p_title: input.title,
      p_note: input.note,
      p_reference: input.reference ?? null,
      p_kpi_measurement_id: input.kpiMeasurementId ?? null,
    },
  );

  if (error) {
    throw new KhposOpsStaffPerformanceError(
      error.message,
      statusFor(error.message),
    );
  }

  return getKhposOpsStaffPerformance(organisationId, userId);
}

export async function leaderReviewKhposOpsStaff(
  organisationId: string,
  userId: string,
  input: {
    reviewId: string;
    performanceState: Exclude<KhposOpsPerformanceState, "not_assessed">;
    summary: string;
    strengths: string;
    growthAreas: string;
  },
): Promise<KhposOpsStaffPerformanceWorkspace> {
  const { error } = await admin().rpc("khpos_ops_leader_review_staff_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_review_id: input.reviewId,
    p_performance_state: input.performanceState,
    p_summary: input.summary,
    p_strengths: input.strengths,
    p_growth_areas: input.growthAreas,
  });

  if (error) {
    throw new KhposOpsStaffPerformanceError(
      error.message,
      statusFor(error.message),
    );
  }

  return getKhposOpsStaffPerformance(organisationId, userId);
}

export async function createKhposOpsDevelopmentAction(
  organisationId: string,
  userId: string,
  input: {
    reviewId: string;
    actionType: KhposOpsDevelopmentActionType;
    title: string;
    description: string;
    ownerUserId: string;
    dueDate: string;
  },
): Promise<KhposOpsStaffPerformanceWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_create_development_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_review_id: input.reviewId,
      p_action_type: input.actionType,
      p_title: input.title,
      p_description: input.description,
      p_owner_user_id: input.ownerUserId,
      p_due_date: input.dueDate,
    },
  );

  if (error) {
    throw new KhposOpsStaffPerformanceError(
      error.message,
      statusFor(error.message),
    );
  }

  return getKhposOpsStaffPerformance(organisationId, userId);
}

export async function actOnKhposOpsDevelopmentAction(
  organisationId: string,
  userId: string,
  input: {
    actionId: string;
    action: "start" | "submit_evidence" | "verify" | "reopen" | "cancel";
    note?: string | null;
    evidenceReference?: string | null;
  },
): Promise<KhposOpsStaffPerformanceWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_development_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_action_id: input.actionId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );

  if (error) {
    throw new KhposOpsStaffPerformanceError(
      error.message,
      statusFor(error.message),
    );
  }

  return getKhposOpsStaffPerformance(organisationId, userId);
}

export async function actOnKhposOpsStaffReview(
  organisationId: string,
  userId: string,
  input: {
    reviewId: string;
    action: "complete" | "cancel";
    note?: string | null;
  },
): Promise<KhposOpsStaffPerformanceWorkspace> {
  const { error } = await admin().rpc("khpos_ops_staff_review_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_review_id: input.reviewId,
    p_action: input.action,
    p_note: input.note ?? null,
  });

  if (error) {
    throw new KhposOpsStaffPerformanceError(
      error.message,
      statusFor(error.message),
    );
  }

  return getKhposOpsStaffPerformance(organisationId, userId);
}
