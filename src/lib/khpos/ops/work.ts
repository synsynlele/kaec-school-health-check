import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsChecklistItem {
  id: string;
  position: number;
  label: string;
  guidance: string | null;
  responseType: "boolean" | "text" | "number" | "choice";
  required: boolean;
  options: unknown[];
  response: unknown | null;
  note: string | null;
  completedAt: string | null;
}

export interface KhposOpsWorkChecklist {
  code: string;
  name: string;
  items: KhposOpsChecklistItem[];
}

export interface KhposOpsWorkItem {
  id: string;
  title: string;
  description: string | null;
  status:
    | "pending"
    | "in_progress"
    | "blocked"
    | "awaiting_verification"
    | "completed";
  priority: "critical" | "high" | "standard" | "planned";
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  evidenceRequired: boolean;
  verificationRequired: boolean;
  processCode: string | null;
  processTitle: string | null;
  roleTitle: string;
  campusName: string | null;
  unitName: string | null;
  checklist: KhposOpsWorkChecklist | null;
  evidenceCount: number;
}

export interface KhposOpsMyWork {
  organisation: { id: string; name: string };
  membershipRole: string;
  generatedAt: string;
  summary: {
    total: number;
    dueToday: number;
    overdue: number;
    blocked: number;
    completed: number;
  };
  items: KhposOpsWorkItem[];
}

export class KhposOpsWorkError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsWorkError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsWorkError("KHP-OS Operations is not configured.", 503);
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
  return /membership|partnership|required|owned work item/i.test(message ?? "")
    ? 403
    : /does not exist|not configured/i.test(message ?? "")
      ? 503
      : 400;
}

export async function getKhposOpsMyWork(
  organisationId: string,
  userId: string,
): Promise<KhposOpsMyWork> {
  const { data, error } = await admin().rpc("khpos_ops_get_my_work_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });

  if (error || !isObject(data)) {
    throw new KhposOpsWorkError(
      error?.message ?? "My Work could not be loaded.",
      statusFor(error?.message),
    );
  }

  return data as unknown as KhposOpsMyWork;
}

export async function updateKhposOpsWork(
  organisationId: string,
  userId: string,
  workItemId: string,
  action: "start" | "block" | "complete",
  note?: string,
): Promise<KhposOpsMyWork> {
  const { error } = await admin().rpc("khpos_ops_update_work_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_work_item_id: workItemId,
    p_action: action,
    p_note: note ?? null,
  });

  if (error) {
    throw new KhposOpsWorkError(error.message, statusFor(error.message));
  }

  return getKhposOpsMyWork(organisationId, userId);
}

export async function setKhposOpsChecklistResponse(
  organisationId: string,
  userId: string,
  workItemId: string,
  templateItemId: string,
  response: unknown,
  note?: string,
): Promise<KhposOpsMyWork> {
  const { error } = await admin().rpc(
    "khpos_ops_set_checklist_response_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_work_item_id: workItemId,
      p_template_item_id: templateItemId,
      p_response: response,
      p_note: note ?? null,
    },
  );

  if (error) {
    throw new KhposOpsWorkError(error.message, statusFor(error.message));
  }

  return getKhposOpsMyWork(organisationId, userId);
}

export async function addKhposOpsWorkEvidence(
  organisationId: string,
  userId: string,
  workItemId: string,
  input: {
    evidenceType: "note" | "link";
    note?: string;
    externalUrl?: string;
  },
): Promise<KhposOpsMyWork> {
  const { error } = await admin().rpc("khpos_ops_add_work_evidence_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_work_item_id: workItemId,
    p_evidence_type: input.evidenceType,
    p_note: input.note ?? null,
    p_external_url: input.externalUrl ?? null,
    p_storage_reference: null,
  });

  if (error) {
    throw new KhposOpsWorkError(error.message, statusFor(error.message));
  }

  return getKhposOpsMyWork(organisationId, userId);
}
