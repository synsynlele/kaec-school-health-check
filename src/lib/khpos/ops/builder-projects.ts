import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsBuilderProjectTerm {
  id: string;
  sessionLabel: string;
  termCode: string;
  termName: string;
  status: "active" | "closed";
  startDate: string;
  endDate: string;
}

export interface KhposOpsBuilderProjectCampus {
  id: string;
  code: string;
  name: string;
}

export interface KhposOpsBuilderProjectAssignment {
  id: string;
  userId: string;
  roleCode: string;
  roleTitle: string;
  campusId: string | null;
  unitId: string | null;
  isMine: boolean;
}

export interface KhposOpsBuilderProjectLearner {
  id: string;
  displayName: string;
  classLabel: string;
  sectionLabel: string | null;
  campusId: string;
}

export interface KhposOpsBuilderProjectCycle {
  id: string;
  reference: string;
  termId: string;
  campusId: string;
  title: string;
  purpose: string;
  ownerAssignmentId: string;
  startDate: string;
  endDate: string;
  milestoneSchedule: Record<string, string>;
  status: "planned" | "active" | "completed" | "cancelled";
  completionNote: string | null;
  evidenceReference: string | null;
  isOwner: boolean;
  canManage: boolean;
}

export interface KhposOpsBuilderProjectMember {
  id: string;
  learnerId: string;
  learnerName: string;
  memberRole: "lead" | "member" | "owner";
  status: "active" | "completed" | "left";
  joinedAt: string;
  leftAt: string | null;
}

export interface KhposOpsBuilderProjectMilestone {
  id: string;
  milestoneCode: string;
  sequenceNo: number;
  title: string;
  expectedEvidence: string;
  dueDate: string;
  status:
    | "not_started"
    | "in_progress"
    | "evidence_submitted"
    | "verified"
    | "returned"
    | "missed";
  evidenceNote: string | null;
  evidenceReference: string | null;
  submittedBy: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  returnNote: string | null;
  recoveryDueDate: string | null;
  recoveryStatus: "not_required" | "required" | "recovered";
  issueId: string | null;
  canVerify: boolean;
}

export interface KhposOpsBuilderProjectMemberEvidence {
  id: string;
  learnerId: string;
  learnerName: string;
  referenceCode: string;
  dimension: string;
  contributionNote: string;
  evidenceReference: string;
  observedAt: string;
  status: "submitted" | "verified" | "returned" | "withdrawn";
  potentialEvidenceId: string | null;
  isRecorder: boolean;
  canVerify: boolean;
}

export interface KhposOpsBuilderProjectDefence {
  id: string;
  reference: string;
  attemptNo: number;
  scheduledAt: string;
  locationLabel: string;
  panelReference: string;
  status: "planned" | "completed" | "cancelled";
  outcome: "completed" | "showcase_ready" | "revision_required" | null;
  panelFeedback: string | null;
  learnerResponseSummary: string | null;
  evidenceReference: string | null;
  revisionDueDate: string | null;
  issueId: string | null;
}

export interface KhposOpsBuilderProjectPortfolioLink {
  id: string;
  learnerId: string;
  learnerName: string;
  referenceCode: string;
  portfolioReference: string;
  shareNote: string;
  shareConfirmed: boolean;
  status: "submitted" | "verified" | "returned" | "withdrawn";
  potentialEvidenceId: string | null;
  isSubmitter: boolean;
  canVerify: boolean;
}

export interface KhposOpsBuilderProject {
  id: string;
  reference: string;
  cycleId: string;
  projectType: "builder_team" | "personal";
  title: string;
  problemStatement: string;
  intendedBeneficiary: string | null;
  solutionHypothesis: string | null;
  mentorAssignmentId: string;
  learnerSharedPipupathReference: string | null;
  status:
    | "idea"
    | "investigating"
    | "designing"
    | "building"
    | "testing"
    | "reflecting"
    | "defence_ready"
    | "defended"
    | "completed"
    | "withdrawn";
  completionNote: string | null;
  completionEvidenceReference: string | null;
  canManage: boolean;
  canVerify: boolean;
  isMentor: boolean;
  members: KhposOpsBuilderProjectMember[];
  milestones: KhposOpsBuilderProjectMilestone[];
  memberEvidence: KhposOpsBuilderProjectMemberEvidence[];
  defences: KhposOpsBuilderProjectDefence[];
  portfolioLinks: KhposOpsBuilderProjectPortfolioLink[];
}

export interface KhposOpsBuilderProjectsWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  canManage: boolean;
  canVerify: boolean;
  canFacilitate: boolean;
  executiveAggregateOnly: boolean;
  principle: string;
  pipupathBoundary: string;
  defenceBoundary: string;
  terms: KhposOpsBuilderProjectTerm[];
  campuses: KhposOpsBuilderProjectCampus[];
  assignments: KhposOpsBuilderProjectAssignment[];
  learners: KhposOpsBuilderProjectLearner[];
  cycles: KhposOpsBuilderProjectCycle[];
  projects: KhposOpsBuilderProject[];
  summary: {
    activeCycles: number;
    activeProjects: number;
    defenceReady: number;
    missedMilestones: number;
    submittedIndividualEvidence: number;
    verifiedIndividualEvidence: number;
  };
}

export class KhposOpsBuilderProjectsError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsBuilderProjectsError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsBuilderProjectsError(
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
  return /membership|partnership|only|outside your|cannot|requires|not found|must|invalid/i.test(
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
): Promise<KhposOpsBuilderProjectsWorkspace> {
  return getKhposOpsBuilderProjects(organisationId, userId);
}

export async function getKhposOpsBuilderProjects(
  organisationId: string,
  userId: string,
): Promise<KhposOpsBuilderProjectsWorkspace> {
  const { data, error } = await admin().rpc(
    "khpos_ops_get_builder_projects_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    throw new KhposOpsBuilderProjectsError(
      error?.message ?? "Builder Projects workspace could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsBuilderProjectsWorkspace;
}

export async function createKhposOpsProjectCycle(
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
    milestoneSchedule: Record<string, string>;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_project_cycle_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_term_id: input.termId,
      p_campus_id: input.campusId,
      p_title: input.title,
      p_purpose: input.purpose,
      p_owner_assignment_id: input.ownerAssignmentId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_milestone_schedule: input.milestoneSchedule,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsProjectCycle(
  organisationId: string,
  userId: string,
  input: {
    cycleId: string;
    action: "activate" | "complete" | "cancel";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_project_cycle_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_cycle_id: input.cycleId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function createKhposOpsBuilderProject(
  organisationId: string,
  userId: string,
  input: {
    cycleId: string;
    projectType: "builder_team" | "personal";
    title: string;
    problemStatement: string;
    intendedBeneficiary?: string | null;
    mentorAssignmentId: string;
    learnerSharedPipupathReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_builder_project_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_cycle_id: input.cycleId,
      p_project_type: input.projectType,
      p_title: input.title,
      p_problem_statement: input.problemStatement,
      p_intended_beneficiary: input.intendedBeneficiary ?? null,
      p_mentor_assignment_id: input.mentorAssignmentId,
      p_learner_shared_pipupath_reference:
        input.learnerSharedPipupathReference ?? null,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function updateKhposOpsBuilderProject(
  organisationId: string,
  userId: string,
  input: {
    projectId: string;
    problemStatement: string;
    intendedBeneficiary?: string | null;
    solutionHypothesis?: string | null;
    learnerSharedPipupathReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_update_builder_project_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_project_id: input.projectId,
      p_problem_statement: input.problemStatement,
      p_intended_beneficiary: input.intendedBeneficiary ?? null,
      p_solution_hypothesis: input.solutionHypothesis ?? null,
      p_learner_shared_pipupath_reference:
        input.learnerSharedPipupathReference ?? null,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsProjectMember(
  organisationId: string,
  userId: string,
  input: {
    projectId: string;
    learnerId: string;
    action: "add" | "leave";
    memberRole?: "lead" | "member" | "owner";
    note?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_project_member_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_project_id: input.projectId,
      p_learner_id: input.learnerId,
      p_action: input.action,
      p_member_role: input.memberRole ?? "member",
      p_note: input.note ?? null,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsProjectMilestone(
  organisationId: string,
  userId: string,
  input: {
    milestoneId: string;
    action: "start" | "submit_evidence" | "verify" | "return" | "miss";
    note?: string | null;
    evidenceReference?: string | null;
    recoveryDueDate?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_project_milestone_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_milestone_id: input.milestoneId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
      p_recovery_due_date: input.recoveryDueDate ?? null,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsBuilderProject(
  organisationId: string,
  userId: string,
  input: {
    projectId: string;
    action:
      | "activate"
      | "design"
      | "build"
      | "test"
      | "reflect"
      | "ready_defence"
      | "complete"
      | "withdraw";
    note?: string | null;
    evidenceReference?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_builder_project_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_project_id: input.projectId,
      p_action: input.action,
      p_note: input.note ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function createKhposOpsProjectDefence(
  organisationId: string,
  userId: string,
  input: {
    projectId: string;
    scheduledAt: string;
    locationLabel: string;
    panelReference: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_create_project_defence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_project_id: input.projectId,
      p_scheduled_at: input.scheduledAt,
      p_location_label: input.locationLabel,
      p_panel_reference: input.panelReference,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsProjectDefence(
  organisationId: string,
  userId: string,
  input: {
    defenceId: string;
    action: "complete" | "cancel";
    outcome?: "completed" | "showcase_ready" | "revision_required" | null;
    panelFeedback?: string | null;
    learnerResponseSummary?: string | null;
    evidenceReference?: string | null;
    revisionDueDate?: string | null;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_project_defence_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_defence_id: input.defenceId,
      p_action: input.action,
      p_outcome: input.outcome ?? null,
      p_panel_feedback: input.panelFeedback ?? null,
      p_learner_response_summary: input.learnerResponseSummary ?? null,
      p_evidence_reference: input.evidenceReference ?? null,
      p_revision_due_date: input.revisionDueDate ?? null,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function addKhposOpsProjectMemberEvidence(
  organisationId: string,
  userId: string,
  input: {
    projectId: string;
    learnerId: string;
    dimension: string;
    contributionNote: string;
    evidenceReference: string;
    observedAt: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_add_project_member_evidence_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_project_id: input.projectId,
      p_learner_id: input.learnerId,
      p_dimension: input.dimension,
      p_contribution_note: input.contributionNote,
      p_evidence_reference: input.evidenceReference,
      p_observed_at: input.observedAt,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsProjectMemberEvidence(
  organisationId: string,
  userId: string,
  input: {
    evidenceId: string;
    action: "verify" | "return" | "withdraw";
    note: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_project_member_evidence_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_evidence_id: input.evidenceId,
      p_action: input.action,
      p_note: input.note,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function submitKhposOpsProjectPortfolioLink(
  organisationId: string,
  userId: string,
  input: {
    projectId: string;
    learnerId: string;
    portfolioReference: string;
    shareNote: string;
    shareConfirmed: boolean;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_submit_project_portfolio_link_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_project_id: input.projectId,
      p_learner_id: input.learnerId,
      p_portfolio_reference: input.portfolioReference,
      p_share_note: input.shareNote,
      p_share_confirmed: input.shareConfirmed,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}

export async function actOnKhposOpsProjectPortfolioLink(
  organisationId: string,
  userId: string,
  input: {
    portfolioLinkId: string;
    action: "verify" | "return" | "withdraw";
    note: string;
  },
) {
  const { error } = await admin().rpc(
    "khpos_ops_project_portfolio_link_action_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_portfolio_link_id: input.portfolioLinkId,
      p_action: input.action,
      p_note: input.note,
    },
  );

  if (error) {
    throw new KhposOpsBuilderProjectsError(
      error.message,
      statusFor(error.message),
    );
  }
  return refresh(organisationId, userId);
}
