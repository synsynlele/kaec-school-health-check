import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposOpsAvailabilityCaseType =
  | "planned_leave"
  | "unplanned_absence"
  | "late_arrival"
  | "early_departure"
  | "other_availability";

export type KhposOpsAvailabilitySource =
  | "self_report"
  | "leader_record"
  | "third_party_exception";

export type KhposOpsAvailabilityStatus =
  | "pending_approval"
  | "coverage_required"
  | "approved"
  | "active"
  | "returned"
  | "declined"
  | "cancelled"
  | "closed";

export interface KhposOpsAvailabilityStaffOption {
  id: string;
  reference: string;
  displayName: string;
  roleTitle: string;
  roleCode: string;
  assignmentId: string;
  campusName: string | null;
  unitName: string | null;
  isSelf: boolean;
  canReview: boolean;
}

export interface KhposOpsCoverageCandidate {
  staffId: string;
  assignmentId: string;
  displayName: string;
  roleTitle: string;
  campusName: string | null;
  unitName: string | null;
}

export interface KhposOpsCoverageAssignment {
  id: string;
  coverAssignmentId: string;
  coverStaffId: string | null;
  coverStaffName: string | null;
  coverRoleTitle: string;
  startAt: string;
  endAt: string;
  coverageScope: string;
  status: "assigned" | "accepted" | "declined" | "completed" | "cancelled";
  responseNote: string | null;
  completionNote: string | null;
  assignedAt: string;
  respondedAt: string | null;
  completedAt: string | null;
  isCoverer: boolean;
  canAct: boolean;
}

export interface KhposOpsAvailabilityEvent {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
}

export interface KhposOpsAvailabilityCase {
  id: string;
  reference: string;
  staffId: string;
  staffName: string;
  staffReference: string;
  roleTitle: string;
  campusName: string | null;
  unitName: string | null;
  caseType: KhposOpsAvailabilityCaseType;
  sourceType: KhposOpsAvailabilitySource;
  startAt: string;
  endAt: string;
  reasonCategory:
    | "not_disclosed"
    | "personal"
    | "family"
    | "emergency"
    | "transport"
    | "official_duty"
    | "other"
    | null;
  reasonNote: string | null;
  sourceReference: string | null;
  coverageRequired: boolean;
  coverageConfirmed: boolean;
  coverageConfirmedAt: string | null;
  status: KhposOpsAvailabilityStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  actualReturnAt: string | null;
  createdAt: string;
  isSelf: boolean;
  canReview: boolean;
  isCoverer: boolean;
  coverage: KhposOpsCoverageAssignment[];
  history: KhposOpsAvailabilityEvent[];
}

export interface KhposOpsAvailabilityWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canManageAvailability: boolean;
  attendanceBoundary: string;
  staffOptions: KhposOpsAvailabilityStaffOption[];
  coverageCandidates: KhposOpsCoverageCandidate[];
  summary: {
    pendingApproval: number;
    coverageGaps: number;
    currentlyUnavailable: number;
    overdueReturn: number;
  };
  cases: KhposOpsAvailabilityCase[];
}

export class KhposOpsAvailabilityError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsAvailabilityError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsAvailabilityError(
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
  return /membership|partnership|outside your|only the|cannot|not found|not active|required before/i.test(
    message ?? "",
  )
    ? 403
    : /not configured|does not exist|function .* does not exist/i.test(
          message ?? "",
        )
      ? 503
      : 400;
}

export async function getKhposOpsAvailability(
  organisationId: string,
  userId: string,
): Promise<KhposOpsAvailabilityWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_availability_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsAvailabilityError(
      error?.message ?? "Availability workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsAvailabilityWorkspace;
}

export async function createKhposOpsAvailabilityCase(
  organisationId: string,
  userId: string,
  input: {
    staffId: string;
    caseType: KhposOpsAvailabilityCaseType;
    sourceType: KhposOpsAvailabilitySource;
    startAt: string;
    endAt: string;
    reasonCategory: string;
    reasonNote?: string | null;
    sourceReference?: string | null;
    coverageRequired: boolean;
  },
): Promise<KhposOpsAvailabilityWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_create_availability_case_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_input: input,
    },
  );

  if (error) {
    throw new KhposOpsAvailabilityError(error.message, statusFor(error.message));
  }

  return getKhposOpsAvailability(organisationId, userId);
}

export async function actOnKhposOpsAvailabilityCase(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    action:
      | "approve"
      | "decline"
      | "cancel"
      | "require_coverage"
      | "confirm_coverage"
      | "return"
      | "close";
    note?: string | null;
    coverageRequired?: boolean | null;
  },
): Promise<KhposOpsAvailabilityWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_availability_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_case_id: input.caseId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_coverage_required: input.coverageRequired ?? null,
    },
  );

  if (error) {
    throw new KhposOpsAvailabilityError(error.message, statusFor(error.message));
  }

  return getKhposOpsAvailability(organisationId, userId);
}

export async function assignKhposOpsCoverage(
  organisationId: string,
  userId: string,
  input: {
    caseId: string;
    coverAssignmentId: string;
    startAt: string;
    endAt: string;
    scope: string;
  },
): Promise<KhposOpsAvailabilityWorkspace> {
  const { error } = await admin().rpc("khpos_ops_assign_coverage_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_case_id: input.caseId,
    p_cover_assignment_id: input.coverAssignmentId,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_scope: input.scope,
  });

  if (error) {
    throw new KhposOpsAvailabilityError(error.message, statusFor(error.message));
  }

  return getKhposOpsAvailability(organisationId, userId);
}

export async function actOnKhposOpsCoverage(
  organisationId: string,
  userId: string,
  input: {
    coverageId: string;
    action: "accept" | "decline" | "complete" | "cancel";
    note?: string | null;
  },
): Promise<KhposOpsAvailabilityWorkspace> {
  const { error } = await admin().rpc("khpos_ops_coverage_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_coverage_id: input.coverageId,
    p_action: input.action,
    p_note: input.note ?? null,
  });

  if (error) {
    throw new KhposOpsAvailabilityError(error.message, statusFor(error.message));
  }

  return getKhposOpsAvailability(organisationId, userId);
}
