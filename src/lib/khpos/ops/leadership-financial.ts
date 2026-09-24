import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsCapabilityAssignment {
  id: string;
  userId: string;
  roleCode: string;
  roleTitle: string;
  campusId: string | null;
  unitId: string | null;
  isMine: boolean;
}

export interface KhposOpsCapabilityLearner {
  id: string;
  displayName: string;
  classLabel: string;
  sectionLabel: string | null;
  campusId: string;
}

export interface KhposOpsLeadershipOpportunity {
  id: string;
  reference: string;
  termId: string;
  campusId: string;
  opportunityType: string;
  title: string;
  purpose: string;
  ownerAssignmentId: string;
  plannedStartDate: string;
  plannedEndDate: string | null;
  status: "planned" | "active" | "completed" | "cancelled";
  completionNote: string | null;
  evidenceReference: string | null;
  isOwner: boolean;
  canManage: boolean;
}

export interface KhposOpsFinancialActivity {
  id: string;
  reference: string;
  termId: string;
  campusId: string;
  activityType: string;
  title: string;
  purpose: string;
  ownerAssignmentId: string;
  activityDate: string;
  status: "planned" | "delivered" | "missed" | "cancelled";
  deliveryNote: string | null;
  evidenceReference: string | null;
  recoveryDueDate: string | null;
  recoveryStatus: "not_required" | "required" | "planned" | "recovered" | "waived";
  issueId: string | null;
  isOwner: boolean;
  canManage: boolean;
}

export interface KhposOpsCapabilityEvidence {
  id: string;
  learnerId: string;
  learnerName: string;
  termId: string;
  domain: "leadership" | "financial_capability";
  dimension: string;
  leadershipOpportunityId: string | null;
  financialActivityId: string | null;
  reference: string;
  evidenceNote: string;
  evidenceReference: string;
  observedAt: string;
  recordedBy: string;
  status: "submitted" | "verified" | "returned" | "withdrawn";
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  returnNote: string | null;
  potentialEvidenceId: string | null;
  isRecorder: boolean;
  canVerify: boolean;
}

export interface KhposOpsLeadershipFinancialWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canRecord: boolean;
  canCoordinate: boolean;
  executiveAggregateOnly: boolean;
  principle: string;
  privacyBoundary: string;
  terms: Array<{
    id: string;
    sessionLabel: string;
    termCode: string;
    termName: string;
    status: string;
    startDate: string;
    endDate: string;
  }>;
  campuses: Array<{ id: string; code: string; name: string }>;
  assignments: KhposOpsCapabilityAssignment[];
  learners: KhposOpsCapabilityLearner[];
  leadershipOpportunities: KhposOpsLeadershipOpportunity[];
  financialActivities: KhposOpsFinancialActivity[];
  evidence: KhposOpsCapabilityEvidence[];
  summary: {
    leadershipOpportunities: number;
    financialActivitiesPlanned: number;
    financialActivitiesMissed: number;
    submittedEvidence: number;
    verifiedLeadershipEvidence: number;
    verifiedFinancialEvidence: number;
  };
}

export class KhposOpsCapabilityError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsCapabilityError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsCapabilityError("KHP-OS Operations is not configured.", 503);
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
  return /membership|partnership|only|outside your|cannot|not found/i.test(
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
): Promise<KhposOpsLeadershipFinancialWorkspace> {
  return getKhposOpsLeadershipFinancial(organisationId, userId);
}

export async function getKhposOpsLeadershipFinancial(
  organisationId: string,
  userId: string,
): Promise<KhposOpsLeadershipFinancialWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_leadership_financial_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsCapabilityError(
      error?.message ?? "Leadership & Financial Capability workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsLeadershipFinancialWorkspace;
}

export async function createKhposOpsLeadershipOpportunity(
  organisationId: string,
  userId: string,
  input: {
    termId: string;
    campusId: string;
    opportunityType: string;
    title: string;
    purpose: string;
    ownerAssignmentId: string;
    plannedStartDate: string;
    plannedEndDate?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_leadership_opportunity_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_term_id: input.termId,
      p_campus_id: input.campusId,
      p_opportunity_type: input.opportunityType,
      p_title: input.title,
      p_purpose: input.purpose,
      p_owner_assignment_id: input.ownerAssignmentId,
      p_planned_start_date: input.plannedStartDate,
      p_planned_end_date: input.plannedEndDate ?? null,
    },
  );
  if (error) throw new KhposOpsCapabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsLeadershipOpportunity(
  organisationId: string,
  userId: string,
  input: {
    opportunityId: string;
    action: "activate" | "complete" | "cancel";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_leadership_opportunity_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_opportunity_id: input.opportunityId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error) throw new KhposOpsCapabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsFinancialActivity(
  organisationId: string,
  userId: string,
  input: {
    termId: string;
    campusId: string;
    activityType: string;
    title: string;
    purpose: string;
    ownerAssignmentId: string;
    activityDate: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_financial_activity_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_term_id: input.termId,
      p_campus_id: input.campusId,
      p_activity_type: input.activityType,
      p_title: input.title,
      p_purpose: input.purpose,
      p_owner_assignment_id: input.ownerAssignmentId,
      p_activity_date: input.activityDate,
    },
  );
  if (error) throw new KhposOpsCapabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsFinancialActivity(
  organisationId: string,
  userId: string,
  input: {
    activityId: string;
    action: "deliver" | "miss" | "cancel";
    note: string;
    evidenceReference?: string | null;
    recoveryDueDate?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_financial_activity_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_activity_id: input.activityId,
      p_action: input.action,
      p_note: input.note,
      p_evidence_reference: input.evidenceReference ?? null,
      p_recovery_due_date: input.recoveryDueDate ?? null,
    },
  );
  if (error) throw new KhposOpsCapabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsCapabilityEvidence(
  organisationId: string,
  userId: string,
  input: {
    learnerId: string;
    termId: string;
    domain: "leadership" | "financial_capability";
    dimension: string;
    leadershipOpportunityId?: string | null;
    financialActivityId?: string | null;
    evidenceNote: string;
    evidenceReference: string;
    observedAt: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_add_capability_evidence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_learner_id: input.learnerId,
      p_term_id: input.termId,
      p_domain: input.domain,
      p_dimension: input.dimension,
      p_leadership_opportunity_id: input.leadershipOpportunityId ?? null,
      p_financial_activity_id: input.financialActivityId ?? null,
      p_evidence_note: input.evidenceNote,
      p_evidence_reference: input.evidenceReference,
      p_observed_at: input.observedAt,
    },
  );
  if (error) throw new KhposOpsCapabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsCapabilityEvidence(
  organisationId: string,
  userId: string,
  evidenceId: string,
  action: "verify" | "return" | "withdraw",
  note: string,
) {
  const { error } = await admin().rpc(
    "khpos_ops_capability_evidence_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_evidence_id: evidenceId,
      p_action: action,
      p_note: note,
    },
  );
  if (error) throw new KhposOpsCapabilityError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}
