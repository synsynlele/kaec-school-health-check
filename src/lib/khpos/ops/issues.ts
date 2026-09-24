import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposOpsIssueSeverity = "P1" | "P2" | "P3" | "P4";
export type KhposOpsIssueStatus =
  | "open"
  | "assigned"
  | "in_action"
  | "awaiting"
  | "resolved"
  | "verified"
  | "closed";

export interface KhposOpsIssueHistoryEvent {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
}

export interface KhposOpsIssue {
  id: string;
  reference: string;
  type: "manual" | "work_blocker" | "checklist_exception" | "system_exception";
  category: string;
  severity: KhposOpsIssueSeverity;
  title: string;
  description: string;
  status: KhposOpsIssueStatus;
  dueAt: string | null;
  immediateAction: string | null;
  rootCause: string | null;
  resolution: string | null;
  preventiveAction: string | null;
  createdAt: string;
  resolvedAt: string | null;
  verifiedAt: string | null;
  owner: {
    roleTitle: string;
    displayName: string | null;
    email: string | null;
  } | null;
  process: {
    code: string;
    title: string;
  } | null;
  sourceWorkTitle: string | null;
  escalatedToTitle: string | null;
  isOwner: boolean;
  isReporter: boolean;
  isDirectManager: boolean;
  isEscalationRecipient: boolean;
  history: KhposOpsIssueHistoryEvent[];
}

export interface KhposOpsIssuesWorkspace {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  summary: {
    open: number;
    critical: number;
    overdue: number;
    resolvedAwaitingClosure: number;
    restrictedOwnedOrReported: number;
  };
  items: KhposOpsIssue[];
}

export class KhposOpsIssueError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsIssueError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsIssueError("KHP-OS Operations is not configured.", 503);
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
  return /membership|partnership|required|not visible|issue not found/i.test(
    message ?? "",
  )
    ? 403
    : /not configured|does not exist|function .* does not exist/i.test(
          message ?? "",
        )
      ? 503
      : 400;
}

export async function getKhposOpsIssues(
  organisationId: string,
  userId: string,
): Promise<KhposOpsIssuesWorkspace> {
  const { data, error } = await admin().rpc("khpos_ops_get_issues_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });

  if (error || !isObject(data)) {
    throw new KhposOpsIssueError(
      error?.message ?? "Issues could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsIssuesWorkspace;
}

export async function createKhposOpsIssue(
  organisationId: string,
  userId: string,
  input: {
    title: string;
    description: string;
    category: string;
    severity: KhposOpsIssueSeverity;
    dueAt?: string | null;
  },
): Promise<KhposOpsIssuesWorkspace> {
  const { error } = await admin().rpc("khpos_ops_create_issue_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_severity: input.severity,
    p_due_at: input.dueAt ?? null,
  });

  if (error) {
    throw new KhposOpsIssueError(error.message, statusFor(error.message));
  }

  return getKhposOpsIssues(organisationId, userId);
}

export async function actOnKhposOpsIssue(
  organisationId: string,
  userId: string,
  issueId: string,
  action:
    | "claim"
    | "start"
    | "await"
    | "resolve"
    | "verify"
    | "close"
    | "escalate"
    | "comment",
  note?: string,
): Promise<KhposOpsIssuesWorkspace> {
  const { error } = await admin().rpc("khpos_ops_issue_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_issue_id: issueId,
    p_action: action,
    p_note: note ?? null,
  });

  if (error) {
    throw new KhposOpsIssueError(error.message, statusFor(error.message));
  }

  return getKhposOpsIssues(organisationId, userId);
}
