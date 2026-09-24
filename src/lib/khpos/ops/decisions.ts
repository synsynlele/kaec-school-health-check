import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposOpsDecisionPriority = "P1" | "P2" | "P3" | "P4";
export type KhposOpsDecisionStatus =
  | "submitted"
  | "under_review"
  | "returned"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "implemented"
  | "closed";

export interface KhposOpsDecisionHistoryEvent {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
}

export interface KhposOpsActorAssignment {
  id: string;
  roleId: string;
  roleCode: string;
  roleTitle: string;
  roleLevel: number;
  campusId: string | null;
  campusName: string | null;
  unitId: string | null;
  unitName: string | null;
  primaryAssignment: boolean;
  canRecordDecision: boolean;
}

export interface KhposOpsAuthorityOption {
  requesterAssignmentId: string;
  roleId: string;
  roleCode: string;
  roleTitle: string;
  depth: number;
}

export interface KhposOpsActionOwnerOption {
  assignmentId: string;
  roleId: string;
  roleCode: string;
  roleTitle: string;
  displayName: string;
  email: string | null;
  campusName: string | null;
  unitName: string | null;
}

export interface KhposOpsDecision {
  id: string;
  reference: string;
  mode: "request" | "record";
  category: string;
  priority: KhposOpsDecisionPriority;
  title: string;
  context: string;
  recommendation: string | null;
  status: KhposOpsDecisionStatus;
  decisionDueAt: string | null;
  decisionText: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  actionRequired: boolean;
  implementationTitle: string | null;
  implementationExpectedOutcome: string | null;
  implementationDueAt: string | null;
  implementedAt: string | null;
  createdAt: string;
  requester: {
    roleTitle: string | null;
    displayName: string | null;
    email: string | null;
  };
  authority: {
    roleId: string;
    roleTitle: string;
    displayName: string | null;
    email: string | null;
  };
  implementationOwner: {
    roleTitle: string;
    displayName: string | null;
    email: string | null;
  } | null;
  process: {
    code: string;
    title: string;
  } | null;
  sourceIssueTitle: string | null;
  work: {
    id: string;
    title: string;
    status: string;
    dueAt: string | null;
    completedAt: string | null;
  } | null;
  isRequester: boolean;
  isAuthority: boolean;
  isImplementationOwner: boolean;
  history: KhposOpsDecisionHistoryEvent[];
}

export interface KhposOpsDecisionsWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  actorAssignments: KhposOpsActorAssignment[];
  authorityOptions: KhposOpsAuthorityOption[];
  actionOwnerOptions: KhposOpsActionOwnerOption[];
  summary: {
    pending: number;
    waitingForMe: number;
    overdue: number;
    implemented: number;
  };
  items: KhposOpsDecision[];
}

export interface KhposOpsCreateDecisionInput {
  mode: "request" | "record";
  requesterAssignmentId: string;
  authorityRoleId: string;
  title: string;
  context: string;
  category: string;
  priority: KhposOpsDecisionPriority;
  recommendation?: string | null;
  decisionDueAt?: string | null;
  sourceIssueId?: string | null;
  decisionText?: string | null;
  actionRequired?: boolean;
  implementationOwnerAssignmentId?: string | null;
  implementationTitle?: string | null;
  implementationExpectedOutcome?: string | null;
  implementationDueAt?: string | null;
}

export type KhposOpsDecisionAction =
  | "review"
  | "return"
  | "resubmit"
  | "approve"
  | "reject"
  | "withdraw"
  | "close"
  | "comment";

export interface KhposOpsDecisionActionPayload {
  note?: string;
  actionRequired?: boolean;
  implementationOwnerAssignmentId?: string | null;
  implementationTitle?: string | null;
  implementationExpectedOutcome?: string | null;
  implementationDueAt?: string | null;
}

export class KhposOpsDecisionError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsDecisionError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsDecisionError("KHP-OS Operations is not configured.", 503);
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
  return /membership|partnership|not visible|not active for you|authority|reporting chain/i.test(
    message ?? "",
  )
    ? 403
    : /not configured|does not exist|function .* does not exist/i.test(
          message ?? "",
        )
      ? 503
      : 400;
}

export async function getKhposOpsDecisions(
  organisationId: string,
  userId: string,
): Promise<KhposOpsDecisionsWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_decisions_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });

  if (error || !isObject(data)) {
    throw new KhposOpsDecisionError(
      error?.message ?? "Decisions could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsDecisionsWorkspace;
}

export async function createKhposOpsDecision(
  organisationId: string,
  userId: string,
  input: KhposOpsCreateDecisionInput,
): Promise<KhposOpsDecisionsWorkspace> {
  const { error } = await admin().rpc("khpos_ops_create_decision_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_input: input,
  });

  if (error) {
    throw new KhposOpsDecisionError(error.message, statusFor(error.message));
  }

  return getKhposOpsDecisions(organisationId, userId);
}

export async function actOnKhposOpsDecision(
  organisationId: string,
  userId: string,
  decisionId: string,
  action: KhposOpsDecisionAction,
  payload: KhposOpsDecisionActionPayload = {},
): Promise<KhposOpsDecisionsWorkspace> {
  const { error } = await admin().rpc("khpos_ops_decision_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_decision_id: decisionId,
    p_action: action,
    p_payload: payload,
  });

  if (error) {
    throw new KhposOpsDecisionError(error.message, statusFor(error.message));
  }

  return getKhposOpsDecisions(organisationId, userId);
}
