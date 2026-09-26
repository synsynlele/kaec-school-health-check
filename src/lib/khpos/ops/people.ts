import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposOpsStaffStatus =
  | "onboarding"
  | "ready"
  | "active"
  | "inactive"
  | "exiting"
  | "ended";

export type KhposOpsEmploymentType =
  | "employee"
  | "facilitator"
  | "contractor"
  | "volunteer"
  | "intern"
  | "temporary";

export interface KhposOpsPeopleRole {
  id: string;
  code: string;
  title: string;
  level: number;
  reportsToRoleId: string | null;
}

export interface KhposOpsOnboardingItem {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  mandatory: boolean;
  waivable: boolean;
  evidenceRequired: boolean;
  status: "pending" | "submitted" | "completed" | "waived";
  submissionNote: string | null;
  evidenceReference: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface KhposOpsStaffEvent {
  eventType: string;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface KhposOpsStaff {
  id: string;
  reference: string;
  displayName: string;
  accountEmail: string;
  accountLinked: boolean;
  employmentType: KhposOpsEmploymentType;
  status: KhposOpsStaffStatus;
  startDate: string;
  onboardingDueDate: string;
  probationReviewDate: string | null;
  role: {
    id: string;
    code: string;
    title: string;
    level: number;
  };
  campus: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  roleAssignmentId: string | null;
  accessMembershipActive: boolean;
  roleCharterActive: boolean;
  mandatoryOutstanding: number;
  onboarding: KhposOpsOnboardingItem[];
  canSelfSubmit: boolean;
  canReview: boolean;
  canManage: boolean;
  history: KhposOpsStaffEvent[];
}

export interface KhposOpsPeopleWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canManagePeople: boolean;
  roles: KhposOpsPeopleRole[];
  campuses: Array<{ id: string; code: string; name: string }>;
  units: Array<{
    id: string;
    code: string;
    name: string;
    campusId: string | null;
  }>;
  summary: {
    total: number;
    onboarding: number;
    ready: number;
    active: number;
    unlinkedAccounts: number;
    overdueOnboarding: number;
  };
  items: KhposOpsStaff[];
}

export interface KhposOpsCreateStaffInput {
  displayName: string;
  accountEmail: string;
  employmentType: KhposOpsEmploymentType;
  roleId: string;
  campusId?: string | null;
  unitId?: string | null;
  startDate: string;
  onboardingDueDate?: string | null;
  probationReviewDate?: string | null;
}

export type KhposOpsOnboardingAction =
  | "submit"
  | "verify"
  | "waive"
  | "reopen";

export class KhposOpsPeopleError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsPeopleError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsPeopleError("KHP-OS Operations is not configured.", 503);
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
  return /membership|partnership|requires an active|only the|cannot be linked|not visible|not active|not found/i.test(
    message ?? "",
  )
    ? 403
    : /not configured|does not exist|function .* does not exist/i.test(
          message ?? "",
        )
      ? 503
      : 400;
}

export async function getKhposOpsPeople(
  organisationId: string,
  userId: string,
): Promise<KhposOpsPeopleWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_people_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });

  if (error || !isObject(data)) {
    throw new KhposOpsPeopleError(
      error?.message ?? "People workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsPeopleWorkspace;
}

export async function createKhposOpsStaff(
  organisationId: string,
  userId: string,
  input: KhposOpsCreateStaffInput,
): Promise<KhposOpsPeopleWorkspace> {
  const { error } = await admin().rpc("khpos_ops_create_staff_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_input: input,
  });

  if (error) {
    throw new KhposOpsPeopleError(error.message, statusFor(error.message));
  }

  return getKhposOpsPeople(organisationId, userId);
}

export async function linkKhposOpsStaffAccount(
  organisationId: string,
  userId: string,
  staffId: string,
): Promise<KhposOpsPeopleWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_link_staff_account_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_staff_id: staffId,
    },
  );

  if (error) {
    throw new KhposOpsPeopleError(error.message, statusFor(error.message));
  }

  return getKhposOpsPeople(organisationId, userId);
}

export async function actOnKhposOpsStaffOnboarding(
  organisationId: string,
  userId: string,
  input: {
    staffId: string;
    itemId: string;
    action: KhposOpsOnboardingAction;
    note?: string | null;
    evidenceReference?: string | null;
  },
): Promise<KhposOpsPeopleWorkspace> {
  const { error } = await admin().rpc(
    "khpos_ops_staff_onboarding_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_staff_id: input.staffId,
      p_item_id: input.itemId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );

  if (error) {
    throw new KhposOpsPeopleError(error.message, statusFor(error.message));
  }

  return getKhposOpsPeople(organisationId, userId);
}

export async function activateKhposOpsStaff(
  organisationId: string,
  userId: string,
  staffId: string,
): Promise<KhposOpsPeopleWorkspace> {
  const { error } = await admin().rpc("khpos_ops_activate_staff_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_staff_id: staffId,
  });

  if (error) {
    throw new KhposOpsPeopleError(error.message, statusFor(error.message));
  }

  return getKhposOpsPeople(organisationId, userId);
}

export async function cancelKhposOpsStaffAppointment(organisationId: string, userId: string, staffId: string, reason: string): Promise<KhposOpsPeopleWorkspace> {
  const { error } = await admin().rpc("khpos_ops_cancel_staff_appointment_server", {
    p_actor: userId, p_org: organisationId, p_staff: staffId, p_reason: reason,
  });
  if (error) throw new KhposOpsPeopleError(error.message, statusFor(error.message));
  return getKhposOpsPeople(organisationId, userId);
}
