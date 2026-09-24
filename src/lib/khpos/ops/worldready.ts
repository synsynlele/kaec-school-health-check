import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: SupabaseClient | null = null;

export interface KhposOpsWorldReadyWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canManage: boolean;
  canRecord: boolean;
  principle: string;
  terms: Array<{
    id: string;
    sessionLabel: string;
    termCode: string;
    termName: string;
    status: "active" | "closed";
    startDate: string;
    endDate: string;
  }>;
  assignments: Array<{
    id: string;
    userId: string;
    roleCode: string;
    roleTitle: string;
    campusId: string | null;
    unitId: string | null;
    isMine: boolean;
  }>;
  learners: Array<{
    id: string;
    displayName: string;
    classLabel: string;
    sectionLabel: string | null;
    campusId: string;
  }>;
  records: KhposOpsWorldReadyRecord[];
  summary: {
    openRecords: number;
    ready: number;
    readyWithActions: number;
    notReady: number;
  };
}

export interface KhposOpsWorldReadyEvidence {
  id: string;
  evidenceType: string;
  title: string;
  evidenceNote: string;
  evidenceReference: string;
  status: "submitted" | "verified" | "returned" | "withdrawn";
  verificationNote: string | null;
}

export interface KhposOpsWorldReadyDomain {
  id: string;
  domainCode: string;
  status: "not_evidenced" | "emerging" | "demonstrated";
  reviewNote: string | null;
  evidenceSummary: string | null;
  evidence: KhposOpsWorldReadyEvidence[];
}

export interface KhposOpsWorldReadyAction {
  id: string;
  reference: string;
  domainId: string | null;
  title: string;
  expectedChange: string;
  ownerAssignmentId: string;
  dueDate: string;
  status:
    | "open"
    | "in_progress"
    | "evidence_submitted"
    | "verified"
    | "waived"
    | "cancelled";
  completionNote: string | null;
  evidenceReference: string | null;
  isOwner: boolean;
  canVerify: boolean;
}

export interface KhposOpsWorldReadyRecord {
  id: string;
  reference: string;
  learnerId: string;
  learnerName: string;
  classLabel: string;
  termId: string;
  ownerAssignmentId: string;
  transitionPathway:
    | "higher_education"
    | "entrepreneurship"
    | "employment"
    | "apprenticeship_vocational"
    | "service_gap_year"
    | "undecided"
    | null;
  pathwaySummary: string | null;
  pathwayReference: string | null;
  portfolioReference: string | null;
  humanPotentialRecordReference: string | null;
  status:
    | "draft"
    | "in_review"
    | "ready"
    | "ready_with_actions"
    | "not_ready"
    | "closed"
    | "cancelled";
  readinessOutcome: "ready" | "ready_with_actions" | "not_ready" | null;
  readinessSummary: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  isOwner: boolean;
  canManage: boolean;
  hasCompletedPersonalProject: boolean;
  hasVerifiedPortfolio: boolean;
  domains: KhposOpsWorldReadyDomain[];
  actions: KhposOpsWorldReadyAction[];
}

export class KhposOpsWorldReadyError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsWorldReadyError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsWorldReadyError("KHP-OS Operations is not configured.", 503);
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
  return /membership|partnership|only|outside your|cannot|requires|not found|must|invalid|reserved/i.test(
    message ?? "",
  )
    ? 403
    : /not configured|does not exist|function .* does not exist/i.test(message ?? "")
      ? 503
      : 400;
}

async function refresh(org: string, user: string) {
  return getKhposOpsWorldReady(org, user);
}

export async function getKhposOpsWorldReady(org: string, user: string) {
  const { data, error } = await admin().rpc("khpos_ops_get_worldready_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
  });
  if (error || !isObject(data)) {
    throw new KhposOpsWorldReadyError(
      error?.message ?? "WorldReady workspace could not be loaded.",
      statusFor(error?.message),
    );
  }
  return data as unknown as KhposOpsWorldReadyWorkspace;
}

export async function createKhposOpsWorldReadyRecord(
  org: string,
  user: string,
  input: { learnerId: string; termId: string; ownerAssignmentId: string },
) {
  const { error } = await admin().rpc("khpos_ops_create_worldready_record_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_learner_id: input.learnerId,
    p_term_id: input.termId,
    p_owner_assignment_id: input.ownerAssignmentId,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}

export async function setKhposOpsWorldReadyPathway(
  org: string,
  user: string,
  input: {
    recordId: string;
    transitionPathway: string;
    pathwaySummary: string;
    pathwayReference?: string | null;
    portfolioReference?: string | null;
    humanPotentialRecordReference?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_set_worldready_pathway_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_record_id: input.recordId,
    p_transition_pathway: input.transitionPathway,
    p_pathway_summary: input.pathwaySummary,
    p_pathway_reference: input.pathwayReference ?? null,
    p_portfolio_reference: input.portfolioReference ?? null,
    p_human_potential_record_reference: input.humanPotentialRecordReference ?? null,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}

export async function addKhposOpsWorldReadyEvidence(
  org: string,
  user: string,
  input: {
    recordId: string;
    domainCode: string;
    evidenceType: string;
    title: string;
    evidenceNote: string;
    evidenceReference: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_add_worldready_evidence_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_record_id: input.recordId,
    p_domain_code: input.domainCode,
    p_evidence_type: input.evidenceType,
    p_title: input.title,
    p_evidence_note: input.evidenceNote,
    p_evidence_reference: input.evidenceReference,
    p_source_potential_evidence_id: null,
    p_source_potential_review_id: null,
    p_source_project_id: null,
    p_source_portfolio_link_id: null,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}

export async function actOnKhposOpsWorldReadyEvidence(
  org: string,
  user: string,
  input: { evidenceId: string; action: "verify" | "return" | "withdraw"; note: string },
) {
  const { error } = await admin().rpc("khpos_ops_worldready_evidence_action_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_evidence_id: input.evidenceId,
    p_action: input.action,
    p_note: input.note,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}

export async function reviewKhposOpsWorldReadyDomain(
  org: string,
  user: string,
  input: {
    recordId: string;
    domainCode: string;
    status: "not_evidenced" | "emerging" | "demonstrated";
    reviewNote: string;
    evidenceSummary: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_review_worldready_domain_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_record_id: input.recordId,
    p_domain_code: input.domainCode,
    p_status: input.status,
    p_review_note: input.reviewNote,
    p_evidence_summary: input.evidenceSummary,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}

export async function createKhposOpsWorldReadyAction(
  org: string,
  user: string,
  input: {
    recordId: string;
    domainCode: string;
    title: string;
    expectedChange: string;
    ownerAssignmentId: string;
    dueDate: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_create_worldready_action_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_record_id: input.recordId,
    p_domain_code: input.domainCode,
    p_title: input.title,
    p_expected_change: input.expectedChange,
    p_owner_assignment_id: input.ownerAssignmentId,
    p_due_date: input.dueDate,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}

export async function actOnKhposOpsWorldReadyAction(
  org: string,
  user: string,
  input: {
    actionId: string;
    action: "start" | "submit_evidence" | "verify" | "reopen" | "waive";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc("khpos_ops_worldready_action_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_action_id: input.actionId,
    p_action: input.action,
    p_note: input.note ?? null,
    p_evidence_reference: input.evidenceReference ?? null,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}

export async function submitKhposOpsWorldReadyReview(org: string, user: string, recordId: string) {
  const { error } = await admin().rpc("khpos_ops_submit_worldready_review_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_record_id: recordId,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}

export async function decideKhposOpsWorldReady(
  org: string,
  user: string,
  input: {
    recordId: string;
    outcome: "ready" | "ready_with_actions" | "not_ready";
    readinessSummary: string;
    reviewNote: string;
  },
) {
  const { error } = await admin().rpc("khpos_ops_decide_worldready_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_record_id: input.recordId,
    p_outcome: input.outcome,
    p_readiness_summary: input.readinessSummary,
    p_review_note: input.reviewNote,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}

export async function actOnKhposOpsWorldReadyRecord(
  org: string,
  user: string,
  input: { recordId: string; action: "reopen" | "close" | "cancel"; note?: string | null },
) {
  const { error } = await admin().rpc("khpos_ops_worldready_record_action_server", {
    p_actor_user_id: user,
    p_organisation_id: org,
    p_record_id: input.recordId,
    p_action: input.action,
    p_note: input.note ?? null,
  });
  if (error) throw new KhposOpsWorldReadyError(error.message, statusFor(error.message));
  return refresh(org, user);
}
