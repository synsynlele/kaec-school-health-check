import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getKaecPolicyBaseline, getKaecProcessBaseline } from "@/lib/khpos/ops/baselines";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposOpsControlStatus = "registered" | "active" | "retired";
export type KhposOpsDocumentStatus = "draft" | "in_review" | "active" | "superseded" | "archived";

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

export interface KhposOpsProcessConnections {
  execution: {
    status: "needs_mapping" | "configured" | "not_applicable";
    activationMode: string;
    ownerRoleTitle: string | null;
    triggerSummary: string | null;
    evidenceRequired: boolean;
    verificationRequired: boolean;
    escalationMinutes: number | null;
    kpiCodes: string[];
  } | null;
  tools: Array<{
    requirementId: string;
    label: string;
    required: boolean;
    minimumEntries: number;
    verificationRequired: boolean;
    toolCode: string;
    toolName: string;
    toolType: string;
  }>;
  currentWorkCount: number;
  completedWorkCount: number;
  lastCompletedAt: string | null;
  controlledRecordCount: number;
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
  connections?: KhposOpsProcessConnections;
}

export interface KhposOpsToolTemplate {
  id: string;
  code: string;
  name: string;
  toolType: string;
  purpose: string;
  schemaDefinition: Record<string, unknown>;
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

  const library = data as unknown as KhposOpsLibrary;

  const [toolSchemaResult, connectionResult] = await Promise.all([
    library.tools.length
      ? admin()
          .from("khpos_ops_tool_templates")
          .select("id,schema_definition")
          .eq("organisation_id", organisationId)
          .eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    admin().rpc("khpos_ops_get_process_connections_server", {
      p_organisation_id: organisationId,
    }),
  ]);

  if (toolSchemaResult.error) {
    throw new KhposOpsLibraryError(
      toolSchemaResult.error.message || "Tool definitions could not be loaded.",
      500,
    );
  }

  if (connectionResult.error) {
    throw new KhposOpsLibraryError(
      connectionResult.error.message || "Process connections could not be loaded.",
      /does not exist/i.test(connectionResult.error.message) ? 503 : 500,
    );
  }

  const schemaById = new Map(
    (toolSchemaResult.data ?? []).map((row) => [
      row.id,
      isObject(row.schema_definition) ? row.schema_definition : {},
    ]),
  );

  const connectionRows = Array.isArray(connectionResult.data)
    ? (connectionResult.data as Array<Record<string, unknown>>)
    : [];
  const connectionsByProcess = new Map(
    connectionRows
      .filter((row) => typeof row.processId === "string")
      .map((row) => [row.processId as string, row as unknown as KhposOpsProcessConnections]),
  );

  return {
    ...library,
    tools: library.tools.map((tool) => ({
      ...tool,
      schemaDefinition: schemaById.get(tool.id) ?? {},
    })),
    processes: library.processes.map((process) => ({
      ...process,
      connections: connectionsByProcess.get(process.id),
    })),
  };
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

export const POLICY_EDITORS = [
  "VISION_CUSTODIAN", "SCHOOL_CUSTODIAN", "SCHOOL_GUARDIAN",
  "ACADEMIC_INSPECTOR", "SKILL_INSPECTOR", "SECTIONAL_PROMOTER",
];

async function withAuthorRoleCodes<T extends { author_id: string | null }>(
  organisationId: string,
  rows: T[],
): Promise<Array<T & { author_role_codes: string[] }>> {
  const authorIds = Array.from(
    new Set(rows.map((row) => row.author_id).filter((value): value is string => Boolean(value))),
  );
  if (!authorIds.length) {
    return rows.map((row) => ({ ...row, author_role_codes: [] }));
  }

  const { data: assignments, error: assignmentError } = await admin()
    .from("khpos_ops_role_assignments")
    .select("user_id,role_id")
    .in("user_id", authorIds)
    .eq("status", "active");

  if (assignmentError) {
    throw new KhposOpsLibraryError(assignmentError.message, 500);
  }

  const roleIds = Array.from(
    new Set((assignments ?? []).map((item) => item.role_id).filter(Boolean)),
  );
  if (!roleIds.length) {
    return rows.map((row) => ({ ...row, author_role_codes: [] }));
  }

  const { data: roles, error: roleError } = await admin()
    .from("khpos_ops_roles")
    .select("id,code")
    .in("id", roleIds)
    .eq("organisation_id", organisationId)
    .eq("status", "active");

  if (roleError) {
    throw new KhposOpsLibraryError(roleError.message, 500);
  }

  const codeByRoleId = new Map((roles ?? []).map((role) => [role.id, role.code]));
  const codesByUser = new Map<string, string[]>();

  for (const assignment of assignments ?? []) {
    const code = codeByRoleId.get(assignment.role_id);
    if (!code) continue;
    const codes = codesByUser.get(assignment.user_id) ?? [];
    if (!codes.includes(code)) codes.push(code);
    codesByUser.set(assignment.user_id, codes);
  }

  return rows.map((row) => ({
    ...row,
    author_role_codes: row.author_id ? (codesByUser.get(row.author_id) ?? []) : [],
  }));
}

export async function getPolicyGovernance(organisationId: string, userId: string) {
  const library = await getKhposOpsLibrary(organisationId, userId);
  if (!library.operatingRoleCodes.some((code) => POLICY_EDITORS.includes(code))) {
    throw new KhposOpsLibraryError("An active school leadership assignment is required.", 403);
  }
  const { data, error } = await admin().from("khpos_ops_policy_versions")
    .select("id,policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,status,author_id,submitted_at,reviewed_by,reviewed_at,review_note,approved_at,draft_source,draft_model")
    .in("policy_id", library.policies.map((policy) => policy.id))
    .order("version", { ascending: false });
  if (error) throw new KhposOpsLibraryError(error.message, 500);
  const versions = await withAuthorRoleCodes(organisationId, data ?? []);
  return {
    library,
    versions,
    baselines: Object.fromEntries(
      library.policies.map((policy) => [policy.id, getKaecPolicyBaseline(policy)]),
    ),
  };
}

export async function governPolicy(
  organisationId: string, userId: string, policyId: string,
  action: "save" | "submit" | "return" | "approve", input: Record<string, unknown>,
) {
  const { error } = await admin().rpc("khpos_ops_govern_policy_server", {
    p_actor_user_id: userId, p_organisation_id: organisationId,
    p_policy_id: policyId, p_action: action, p_input: input,
  });
  if (error) throw new KhposOpsLibraryError(error.message, 400);
  return getPolicyGovernance(organisationId, userId);
}

export async function getProcessGovernance(
  organisationId: string,
  userId: string,
) {
  const library = await getKhposOpsLibrary(organisationId, userId);
  if (!library.operatingRoleCodes.some((code) => POLICY_EDITORS.includes(code))) {
    throw new KhposOpsLibraryError(
      "An active school leadership assignment is required.",
      403,
    );
  }

  if (!library.processes.length) {
    return { library, versions: [] };
  }

  const { data, error } = await admin()
    .from("khpos_ops_process_versions")
    .select(
      "id,process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,exception_conditions,escalation,kpis,effective_date,status,author_id,submitted_at,reviewed_by,reviewed_at,review_note,approved_by,approved_at,draft_source,draft_model",
    )
    .in("process_id", library.processes.map((process) => process.id))
    .order("version", { ascending: false });

  if (error) throw new KhposOpsLibraryError(error.message, 500);
  const versions = await withAuthorRoleCodes(organisationId, data ?? []);
  return {
    library,
    versions,
    baselines: Object.fromEntries(
      library.processes.map((process) => [process.id, getKaecProcessBaseline(process)]),
    ),
  };
}

export async function governProcess(
  organisationId: string,
  userId: string,
  processId: string,
  action: "save" | "submit" | "return" | "approve",
  input: Record<string, unknown>,
) {
  const { error } = await admin().rpc("khpos_ops_govern_process_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_process_id: processId,
    p_action: action,
    p_input: input,
  });

  if (error) throw new KhposOpsLibraryError(error.message, 400);
  return getProcessGovernance(organisationId, userId);
}

