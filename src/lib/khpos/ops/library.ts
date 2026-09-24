import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposOpsControlStatus = "registered" | "active" | "retired";
export type KhposOpsDocumentStatus = "draft" | "active" | "superseded" | "archived";

export interface KhposOpsPolicyVersion {
  id: string;
  version: number;
  purpose: string;
  scope: string;
  principles: string[];
  policyStatements: string[];
  rolesResponsibilities: string[];
  rules: string[];
  exceptions: string[];
  escalation: string[];
  recordsEvidence: string[];
  effectiveDate: string | null;
  reviewDate: string | null;
  status: KhposOpsDocumentStatus;
}

export interface KhposOpsPolicy {
  id: string;
  code: string;
  name: string;
  operatingSystem: string;
  ownerLabel: string;
  priority: "C0" | "C1" | "C2";
  status: KhposOpsControlStatus;
  requiredForMyRole: boolean;
  acknowledgementRequired: boolean;
  acknowledgedAt: string | null;
  activeVersion: KhposOpsPolicyVersion | null;
}

export interface KhposOpsProcessVersion {
  id: string;
  version: number;
  purpose: string;
  trigger: string;
  inputs: string[];
  steps: string[];
  sla: string | null;
  evidence: string[];
  expectedOutcome: string;
  exceptionConditions: string[];
  escalation: string[];
  kpis: string[];
  effectiveDate: string | null;
  status: KhposOpsDocumentStatus;
}

export interface KhposOpsProcess {
  id: string;
  code: string;
  title: string;
  operatingSystem: string;
  ownerLabel: string;
  criticality: "P0" | "P1" | "P2";
  governingPolicyCodes: string[];
  technology: string[];
  status: KhposOpsControlStatus;
  activeVersion: KhposOpsProcessVersion | null;
}

export interface KhposOpsToolTemplate {
  id: string;
  code: string;
  name: string;
  toolType: string;
  purpose: string;
  status: "active" | "inactive";
}

export interface KhposOpsLibrary {
  organisation: { id: string; name: string };
  membershipRole: string;
  operatingRoleCodes: string[];
  policies: KhposOpsPolicy[];
  processes: KhposOpsProcess[];
  tools: KhposOpsToolTemplate[];
  summary: {
    policyCount: number;
    activePolicyDocuments: number;
    requiredPolicyCount: number;
    unacknowledgedRequiredPolicies: number;
    processCount: number;
    activeProcessDocuments: number;
    toolCount: number;
  };
}

export class KhposOpsLibraryError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOpsLibraryError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsLibraryError("KHP-OS Operations is not configured.", 503);
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

export async function getKhposOpsLibrary(
  organisationId: string,
  userId: string,
): Promise<KhposOpsLibrary> {
  const { data, error } = await admin().rpc("khpos_ops_get_library_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });

  if (error || !isObject(data)) {
    const message = error?.message ?? "Institutional library could not be loaded.";
    const status =
      /active organisation membership|active partnership|required/i.test(message)
        ? 403
        : /does not exist|not configured/i.test(message)
          ? 503
          : 500;
    throw new KhposOpsLibraryError(message, status);
  }

  return data as unknown as KhposOpsLibrary;
}

export async function acknowledgeKhposOpsPolicy(
  organisationId: string,
  userId: string,
  policyVersionId: string,
): Promise<KhposOpsLibrary> {
  const { error } = await admin().rpc("khpos_ops_acknowledge_policy_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_policy_version_id: policyVersionId,
  });

  if (error) {
    throw new KhposOpsLibraryError(error.message, 400);
  }

  return getKhposOpsLibrary(organisationId, userId);
}
