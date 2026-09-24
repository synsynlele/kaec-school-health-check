import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsYoungCeoAssignment {
  id: string;
  userId: string;
  roleCode: string;
  roleTitle: string;
  campusId: string | null;
  unitId: string | null;
  isMine: boolean;
}

export interface KhposOpsYoungCeoLearner {
  id: string;
  displayName: string;
  classLabel: string;
  sectionLabel: string | null;
  campusId: string;
}

export interface KhposOpsYoungCeoCycle {
  id: string;
  reference: string;
  termId: string;
  campusId: string;
  title: string;
  purpose: string;
  ownerAssignmentId: string;
  startDate: string;
  endDate: string;
  status: "planned" | "active" | "completed" | "cancelled";
  completionNote: string | null;
  evidenceReference: string | null;
  isOwner: boolean;
  canManage: boolean;
}

export interface KhposOpsYoungCeoSession {
  id: string;
  reference: string;
  cycleId: string;
  sessionDate: string;
  theme: string;
  purpose: string;
  ownerAssignmentId: string;
  status: "planned" | "delivered" | "missed" | "cancelled";
  deliveryNote: string | null;
  evidenceReference: string | null;
  recoveryDueDate: string | null;
  recoveryStatus: "not_required" | "required" | "recovered" | "waived";
  issueId: string | null;
  isOwner: boolean;
  canManage: boolean;
}

export interface KhposOpsYoungCeoVenture {
  id: string;
  reference: string;
  cycleId: string;
  name: string;
  ventureMode: "individual" | "team";
  problemStatement: string;
  targetCustomer: string | null;
  solutionSummary: string | null;
  valueProposition: string | null;
  salesMode: "simulation" | "internal_school" | "external_approved";
  salesApprovalReference: string | null;
  financeReference: string | null;
  status:
    | "idea"
    | "validating"
    | "building"
    | "testing"
    | "selling"
    | "iterating"
    | "completed"
    | "withdrawn";
  completionNote: string | null;
  completionEvidenceReference: string | null;
  canManage: boolean;
  canFacilitate: boolean;
}

export interface KhposOpsYoungCeoMember {
  id: string;
  ventureId: string;
  learnerId: string;
  learnerName: string;
  memberRole: "lead" | "member";
  status: "active" | "completed" | "left";
  joinedAt: string;
  leftAt: string | null;
}

export interface KhposOpsYoungCeoMilestone {
  id: string;
  ventureId: string;
  milestoneCode: string;
  sequenceNo: number;
  title: string;
  expectedEvidence: string;
  dueDate: string | null;
  status:
    | "not_started"
    | "in_progress"
    | "evidence_submitted"
    | "verified"
    | "returned";
  evidenceNote: string | null;
  evidenceReference: string | null;
  submittedBy: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  returnNote: string | null;
  canVerify: boolean;
}

export interface KhposOpsYoungCeoMemberEvidence {
  id: string;
  ventureId: string;
  learnerId: string;
  learnerName: string;
  reference: string;
  dimension: string;
  contributionNote: string;
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

export interface KhposOpsYoungCeoWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canManage: boolean;
  canFacilitate: boolean;
  executiveAggregateOnly: boolean;
  principle: string;
  commercialBoundary: string;
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
  assignments: KhposOpsYoungCeoAssignment[];
  learners: KhposOpsYoungCeoLearner[];
  cycles: KhposOpsYoungCeoCycle[];
  sessions: KhposOpsYoungCeoSession[];
  ventures: KhposOpsYoungCeoVenture[];
  members: KhposOpsYoungCeoMember[];
  milestones: KhposOpsYoungCeoMilestone[];
  memberEvidence: KhposOpsYoungCeoMemberEvidence[];
  summary: {
    activeCycles: number;
    plannedSessions: number;
    missedSessions: number;
    activeVentures: number;
    venturesReadyToComplete: number;
    submittedMemberEvidence: number;
    verifiedMemberEvidence: number;
  };
}

export class KhposOpsYoungCeoError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsYoungCeoError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsYoungCeoError("KHP-OS Operations is not configured.", 503);
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
  return /membership|partnership|only|outside your|cannot|requires|not found/i.test(
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
): Promise<KhposOpsYoungCeoWorkspace> {
  return getKhposOpsYoungCeo(organisationId, userId);
}

export async function getKhposOpsYoungCeo(
  organisationId: string,
  userId: string,
): Promise<KhposOpsYoungCeoWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_young_ceo_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });

  if (error || !isObject(data)) {
    throw new KhposOpsYoungCeoError(
      error?.message ?? "Young CEO Hub workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsYoungCeoWorkspace;
}

export async function createKhposOpsYoungCeoCycle(
  organisationId: string,
  userId: string,
  input: {
    termId: string;
    campusId: string;
    title: string;
    purpose: string;
    ownerAssignmentId: string;
    startDate: string;
    endDate: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_create_young_ceo_cycle_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_term_id: input.termId,
    p_campus_id: input.campusId,
    p_title: input.title,
    p_purpose: input.purpose,
    p_owner_assignment_id: input.ownerAssignmentId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
  });
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsYoungCeoCycle(
  organisationId: string,
  userId: string,
  input: {
    cycleId: string;
    action: "activate" | "complete" | "cancel";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_young_ceo_cycle_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_cycle_id: input.cycleId,
    p_action: input.action,
    p_note: input.note ?? null,
    p_evidence_reference: input.evidenceReference ?? null,
  });
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsYoungCeoSession(
  organisationId: string,
  userId: string,
  input: {
    cycleId: string;
    sessionDate: string;
    theme: string;
    purpose: string;
    ownerAssignmentId: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_create_young_ceo_session_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_cycle_id: input.cycleId,
    p_session_date: input.sessionDate,
    p_theme: input.theme,
    p_purpose: input.purpose,
    p_owner_assignment_id: input.ownerAssignmentId,
  });
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsYoungCeoSession(
  organisationId: string,
  userId: string,
  input: {
    sessionId: string;
    action: "deliver" | "miss" | "recover" | "waive_recovery" | "cancel";
    note: string;
    evidenceReference?: string | null;
    recoveryDueDate?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_young_ceo_session_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_session_id: input.sessionId,
    p_action: input.action,
    p_note: input.note,
    p_evidence_reference: input.evidenceReference ?? null,
    p_recovery_due_date: input.recoveryDueDate ?? null,
  });
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function createKhposOpsYoungCeoVenture(
  organisationId: string,
  userId: string,
  input: {
    cycleId: string;
    name: string;
    ventureMode: "individual" | "team";
    problemStatement: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_create_young_ceo_venture_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_cycle_id: input.cycleId,
    p_name: input.name,
    p_venture_mode: input.ventureMode,
    p_problem_statement: input.problemStatement,
  });
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function updateKhposOpsYoungCeoVentureCanvas(
  organisationId: string,
  userId: string,
  input: {
    ventureId: string;
    problemStatement: string;
    targetCustomer?: string | null;
    solutionSummary?: string | null;
    valueProposition?: string | null;
    salesMode: "simulation" | "internal_school" | "external_approved";
    salesApprovalReference?: string | null;
    financeReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_update_young_ceo_venture_canvas_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_venture_id: input.ventureId,
      p_problem_statement: input.problemStatement,
      p_target_customer: input.targetCustomer ?? null,
      p_solution_summary: input.solutionSummary ?? null,
      p_value_proposition: input.valueProposition ?? null,
      p_sales_mode: input.salesMode,
      p_sales_approval_reference: input.salesApprovalReference ?? null,
      p_finance_reference: input.financeReference ?? null,
    },
  );
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsYoungCeoMember(
  organisationId: string,
  userId: string,
  input: {
    ventureId: string;
    learnerId: string;
    action: "add" | "leave";
    memberRole?: "lead" | "member";
    note?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_young_ceo_member_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_venture_id: input.ventureId,
    p_learner_id: input.learnerId,
    p_action: input.action,
    p_member_role: input.memberRole ?? "member",
    p_note: input.note ?? null,
  });
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsYoungCeoMilestone(
  organisationId: string,
  userId: string,
  input: {
    milestoneId: string;
    action: "start" | "submit_evidence" | "verify" | "return";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_young_ceo_milestone_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_milestone_id: input.milestoneId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsYoungCeoVenture(
  organisationId: string,
  userId: string,
  input: {
    ventureId: string;
    action: "activate" | "build" | "test" | "sell" | "iterate" | "complete" | "withdraw";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_young_ceo_venture_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_venture_id: input.ventureId,
    p_action: input.action,
    p_note: input.note ?? null,
    p_evidence_reference: input.evidenceReference ?? null,
  });
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsYoungCeoMemberEvidence(
  organisationId: string,
  userId: string,
  input: {
    ventureId: string;
    learnerId: string;
    dimension: string;
    contributionNote: string;
    evidenceReference: string;
    observedAt: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_add_young_ceo_member_evidence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_venture_id: input.ventureId,
      p_learner_id: input.learnerId,
      p_dimension: input.dimension,
      p_contribution_note: input.contributionNote,
      p_evidence_reference: input.evidenceReference,
      p_observed_at: input.observedAt,
    },
  );
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsYoungCeoMemberEvidence(
  organisationId: string,
  userId: string,
  input: {
    evidenceId: string;
    action: "verify" | "return" | "withdraw";
    note: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_young_ceo_member_evidence_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_evidence_id: input.evidenceId,
      p_action: input.action,
      p_note: input.note,
    },
  );
  if (error) throw new KhposOpsYoungCeoError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}
