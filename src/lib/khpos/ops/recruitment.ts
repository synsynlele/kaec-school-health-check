import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsRecruitmentRole {
  id: string;
  code: string;
  title: string;
  level: number;
  reportsToRoleId: string | null;
  charterActive: boolean;
}

export interface KhposOpsRecruitmentCampus {
  id: string;
  code: string;
  name: string;
}

export interface KhposOpsRecruitmentUnit {
  id: string;
  code: string;
  name: string;
  campusId: string | null;
}

export interface KhposOpsWorkforceRequest {
  id: string;
  reference: string;
  roleId: string;
  roleCode: string;
  roleTitle: string;
  campusId: string | null;
  unitId: string | null;
  employmentType: string;
  needType: string;
  rationale: string;
  alternativesConsidered: string | null;
  desiredStartDate: string;
  budgetReference: string | null;
  status: "submitted" | "approved" | "declined" | "vacancy_open" | "filled" | "cancelled";
  decisionNote: string | null;
  requestedAt: string;
}

export interface KhposOpsRecruitmentVacancy {
  id: string;
  reference: string;
  workforceRequestId: string;
  roleId: string;
  roleCode: string;
  roleTitle: string;
  campusId: string | null;
  unitId: string | null;
  employmentType: string;
  title: string;
  roleOutcomes: string;
  minimumRequirements: string | null;
  safeguardingStatement: string;
  openingDate: string;
  closingDate: string | null;
  status: "draft" | "open" | "on_hold" | "closed" | "filled" | "cancelled";
  appointedStaffId: string | null;
}

export interface KhposOpsCandidateEvaluation {
  id: string;
  evaluationType: string;
  competenceEvidence: string;
  roleFitEvidence: string;
  builderPhilosophyEvidence: string | null;
  concernOrGap: string | null;
  recommendation: "progress" | "needs_more_evidence" | "do_not_progress";
  evaluatedAt: string;
}

export interface KhposOpsCandidateClearanceItem {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  mandatory: boolean;
  waivable: boolean;
  evidenceRequired: boolean;
  status: "pending" | "verified" | "needs_review" | "not_clear" | "waived";
  outcomeNote: string | null;
  evidenceReference: string | null;
  reviewNote: string | null;
}

export interface KhposOpsCandidateApplication {
  id: string;
  reference: string;
  vacancyId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  candidateSource: string | null;
  candidateStatus: string;
  stage:
    | "applied"
    | "screening"
    | "interview"
    | "conditional_selection"
    | "clearance"
    | "cleared"
    | "declined"
    | "withdrawn"
    | "appointed";
  applicationNote: string | null;
  decisionNote: string | null;
  appointedStaffId: string | null;
  roleId: string;
  roleTitle: string;
  evaluations: KhposOpsCandidateEvaluation[];
  clearance: KhposOpsCandidateClearanceItem[];
}

export interface KhposOpsRecruitmentWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  canManageRecruitment: boolean;
  canEvaluateCandidates: boolean;
  generatedAt: string;
  principle: string;
  privacyBoundary: string;
  roles: KhposOpsRecruitmentRole[];
  campuses: KhposOpsRecruitmentCampus[];
  units: KhposOpsRecruitmentUnit[];
  workforceRequests: KhposOpsWorkforceRequest[];
  vacancies: KhposOpsRecruitmentVacancy[];
  applications: KhposOpsCandidateApplication[];
  summary: {
    openRequests: number;
    openVacancies: number;
    activeApplications: number;
    clearancePending: number;
  };
}

export class KhposOpsRecruitmentError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsRecruitmentError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsRecruitmentError("KHP-OS Operations is not configured.", 503);
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
  return /membership|partnership|only |competent authority|authorised|restricted|outside|not found|requires external|cannot be recruited internally/i.test(
    message ?? "",
  )
    ? 403
    : /not configured|does not exist|function .* does not exist/i.test(message ?? "")
      ? 503
      : 400;
}

async function refresh(
  organisationId: string,
  userId: string,
): Promise<KhposOpsRecruitmentWorkspace> {
  return getKhposOpsRecruitment(organisationId, userId);
}

export async function getKhposOpsRecruitment(
  organisationId: string,
  userId: string,
): Promise<KhposOpsRecruitmentWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_recruitment_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });

  if (error || !isObject(data)) {
    throw new KhposOpsRecruitmentError(
      error?.message ?? "Recruitment workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsRecruitmentWorkspace;
}

export async function createKhposOpsWorkforceRequest(
  organisationId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  const { error } = await admin().rpc("khpos_ops_create_workforce_request_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_input: input,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function decideKhposOpsWorkforceRequest(
  organisationId: string,
  userId: string,
  requestId: string,
  decision: "approve" | "decline",
  note: string,
) {
  const { error } = await admin().rpc("khpos_ops_decide_workforce_request_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_request_id: requestId,
    p_decision: decision,
    p_note: note,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function updateKhposOpsVacancyBrief(
  organisationId: string,
  userId: string,
  input: {
    vacancyId: string;
    title: string;
    roleOutcomes: string;
    minimumRequirements: string;
    safeguardingStatement: string;
    closingDate?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_update_vacancy_brief_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_vacancy_id: input.vacancyId,
    p_title: input.title,
    p_role_outcomes: input.roleOutcomes,
    p_minimum_requirements: input.minimumRequirements,
    p_safeguarding_statement: input.safeguardingStatement,
    p_closing_date: input.closingDate ?? null,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsVacancy(
  organisationId: string,
  userId: string,
  input: {
    vacancyId: string;
    action: "open" | "hold" | "close";
    note?: string | null;
    closingDate?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_vacancy_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_vacancy_id: input.vacancyId,
    p_action: input.action,
    p_note: input.note ?? null,
    p_closing_date: input.closingDate ?? null,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsCandidateApplication(
  organisationId: string,
  userId: string,
  input: {
    vacancyId: string;
    fullName: string;
    email: string;
    phone?: string | null;
    source?: string | null;
    applicationNote?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_add_candidate_application_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_vacancy_id: input.vacancyId,
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone ?? null,
    p_source: input.source ?? null,
    p_application_note: input.applicationNote ?? null,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function addKhposOpsCandidateEvaluation(
  organisationId: string,
  userId: string,
  input: {
    applicationId: string;
    evaluationType: string;
    competenceEvidence: string;
    roleFitEvidence: string;
    builderPhilosophyEvidence?: string | null;
    concernOrGap?: string | null;
    recommendation: "progress" | "needs_more_evidence" | "do_not_progress";
  },
) {
  const { error } = await admin().rpc("khpos_ops_add_candidate_evaluation_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_application_id: input.applicationId,
    p_evaluation_type: input.evaluationType,
    p_competence_evidence: input.competenceEvidence,
    p_role_fit_evidence: input.roleFitEvidence,
    p_builder_philosophy_evidence: input.builderPhilosophyEvidence ?? null,
    p_concern_or_gap: input.concernOrGap ?? null,
    p_recommendation: input.recommendation,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsCandidateApplication(
  organisationId: string,
  userId: string,
  applicationId: string,
  action:
    | "start_screening"
    | "invite_interview"
    | "conditional_select"
    | "start_clearance"
    | "decline"
    | "withdraw",
  note?: string | null,
) {
  const { error } = await admin().rpc("khpos_ops_application_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_application_id: applicationId,
    p_action: action,
    p_note: note ?? null,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsCandidateClearance(
  organisationId: string,
  userId: string,
  input: {
    itemId: string;
    action: "verify" | "needs_review" | "not_clear" | "waive";
    note: string;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_candidate_clearance_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_item_id: input.itemId,
    p_action: input.action,
    p_note: input.note,
    p_evidence_reference: input.evidenceReference ?? null,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function completeKhposOpsCandidateClearance(
  organisationId: string,
  userId: string,
  applicationId: string,
  note: string,
) {
  const { error } = await admin().rpc("khpos_ops_complete_candidate_clearance_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_application_id: applicationId,
    p_note: note,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}

export async function appointKhposOpsClearedCandidate(
  organisationId: string,
  userId: string,
  input: {
    applicationId: string;
    startDate: string;
    onboardingDueDate?: string | null;
    probationReviewDate?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_appoint_cleared_candidate_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_application_id: input.applicationId,
    p_start_date: input.startDate,
    p_onboarding_due_date: input.onboardingDueDate ?? null,
    p_probation_review_date: input.probationReviewDate ?? null,
  });
  if (error) throw new KhposOpsRecruitmentError(error.message, statusFor(error.message));
  return refresh(organisationId, userId);
}
