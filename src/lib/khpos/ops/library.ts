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

export interface KhposOpsProcessOperatingMap {
  scope: "institution" | "my_role";
  execution: {
    status: "needs_mapping" | "configured" | "not_applicable";
    mode: string;
    ownerRoleTitle: string | null;
    triggerSummary: string | null;
    evidenceRequired: boolean;
    verificationRequired: boolean;
    escalationMinutes: number | null;
  } | null;
  roles: Array<{
    code: string;
    title: string;
    participation: string;
  }>;
  checklists: Array<{
    code: string;
    name: string;
    status: string;
  }>;
  controlledRecords: Array<{
    label: string;
    toolCode: string;
    toolName: string;
    required: boolean;
    verificationRequired: boolean;
  }>;
  currentWork: number;
  awaitingVerification: number;
  completedLast30Days: number;
  recordsLast30Days: number;
  versionCount: number;
  lastChangedAt: string | null;
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
  operatingMap?: KhposOpsProcessOperatingMap;
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

  const { data: toolSchemas, error: toolSchemaError } = library.tools.length
    ? await admin()
        .from("khpos_ops_tool_templates")
        .select("id,schema_definition")
        .eq("organisation_id", organisationId)
        .eq("status", "active")
    : { data: [], error: null };

  if (toolSchemaError) {
    throw new KhposOpsLibraryError(
      toolSchemaError.message || "Tool definitions could not be loaded.",
      500,
    );
  }

  const schemaById = new Map(
    (toolSchemas ?? []).map((row) => [
      row.id,
      isObject(row.schema_definition) ? row.schema_definition : {},
    ]),
  );

  const processIds = library.processes.map((process) => process.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const leadershipCodes = new Set([
    "VISION_CUSTODIAN",
    "SCHOOL_CUSTODIAN",
    "SCHOOL_GUARDIAN",
    "ACADEMIC_INSPECTOR",
    "SKILL_INSPECTOR",
    "SECTIONAL_PROMOTER",
  ]);
  const institutionScope = library.operatingRoleCodes.some((code) =>
    leadershipCodes.has(code),
  );

  const [
    processRolesResult,
    executionResult,
    checklistResult,
    requirementResult,
    actorAssignmentsResult,
    workResult,
    recordResult,
    versionResult,
  ] = await Promise.all([
    processIds.length
      ? admin()
          .from("khpos_ops_process_roles")
          .select("process_id,role_id,participation")
          .in("process_id", processIds)
      : Promise.resolve({ data: [], error: null }),
    processIds.length
      ? admin()
          .from("khpos_ops_process_execution_profiles")
          .select(
            "process_id,status,activation_mode,owner_role_id,trigger_summary,evidence_required,verification_required,escalation_minutes",
          )
          .eq("organisation_id", organisationId)
          .in("process_id", processIds)
      : Promise.resolve({ data: [], error: null }),
    processIds.length
      ? admin()
          .from("khpos_ops_checklist_templates")
          .select("process_id,code,name,status")
          .eq("organisation_id", organisationId)
          .in("process_id", processIds)
      : Promise.resolve({ data: [], error: null }),
    processIds.length
      ? admin()
          .from("khpos_ops_process_tool_requirements")
          .select(
            "process_id,tool_template_id,label,required,verification_required,status",
          )
          .eq("organisation_id", organisationId)
          .eq("status", "active")
          .in("process_id", processIds)
      : Promise.resolve({ data: [], error: null }),
    admin()
      .from("khpos_ops_role_assignments")
      .select("id,role_id")
      .eq("user_id", userId)
      .eq("status", "active"),
    processIds.length
      ? admin()
          .from("khpos_ops_work_items")
          .select(
            "id,process_id,owner_assignment_id,status,completed_at,submitted_for_verification_at,created_at",
          )
          .eq("organisation_id", organisationId)
          .neq("status", "cancelled")
          .in("process_id", processIds)
          .limit(2500)
      : Promise.resolve({ data: [], error: null }),
    admin()
      .from("khpos_ops_work_records")
      .select("work_item_id,submitted_at")
      .eq("organisation_id", organisationId)
      .gte("submitted_at", thirtyDaysAgo)
      .limit(2500),
    processIds.length
      ? admin()
          .from("khpos_ops_process_versions")
          .select("process_id,version,status,created_at,approved_at")
          .in("process_id", processIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const mapError = [
    processRolesResult.error,
    executionResult.error,
    checklistResult.error,
    requirementResult.error,
    actorAssignmentsResult.error,
    workResult.error,
    recordResult.error,
    versionResult.error,
  ].find(Boolean);
  if (mapError) {
    throw new KhposOpsLibraryError(
      mapError?.message ?? "Process operating connections could not be loaded.",
      500,
    );
  }

  const roleIds = Array.from(
    new Set([
      ...(processRolesResult.data ?? []).map((row) => row.role_id),
      ...(executionResult.data ?? [])
        .map((row) => row.owner_role_id)
        .filter((value): value is string => Boolean(value)),
    ]),
  );
  const { data: operatingRoles, error: operatingRolesError } = roleIds.length
    ? await admin()
        .from("khpos_ops_roles")
        .select("id,code,title")
        .eq("organisation_id", organisationId)
        .in("id", roleIds)
    : { data: [], error: null };

  if (operatingRolesError) {
    throw new KhposOpsLibraryError(operatingRolesError.message, 500);
  }

  const roleById = new Map(
    (operatingRoles ?? []).map((role) => [role.id, role]),
  );
  const toolById = new Map(
    library.tools.map((tool) => [tool.id, tool]),
  );
  const actorAssignmentIds = new Set(
    (actorAssignmentsResult.data ?? []).map((assignment) => assignment.id),
  );
  const visibleWork = (workResult.data ?? []).filter(
    (work) => institutionScope || actorAssignmentIds.has(work.owner_assignment_id),
  );
  const workById = new Map(visibleWork.map((work) => [work.id, work]));

  const operatingMapByProcess = new Map<
    string,
    KhposOpsProcessOperatingMap
  >();

  for (const processId of processIds) {
    const execution = (executionResult.data ?? []).find(
      (row) => row.process_id === processId,
    );
    const processWork = visibleWork.filter(
      (work) => work.process_id === processId,
    );
    const relevantWorkIds = new Set(processWork.map((work) => work.id));
    const roles = (processRolesResult.data ?? [])
      .filter((row) => row.process_id === processId)
      .map((row) => {
        const role = roleById.get(row.role_id);
        return role
          ? {
              code: role.code,
              title: role.title,
              participation: row.participation,
            }
          : null;
      })
      .filter(
        (
          row,
        ): row is { code: string; title: string; participation: string } =>
          Boolean(row),
      );

    const versions = (versionResult.data ?? []).filter(
      (row) => row.process_id === processId,
    );
    const latestVersionAt =
      versions
        .map((row) => row.approved_at ?? row.created_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    operatingMapByProcess.set(processId, {
      scope: institutionScope ? "institution" : "my_role",
      execution: execution
        ? {
            status: execution.status,
            mode: execution.activation_mode,
            ownerRoleTitle: execution.owner_role_id
              ? roleById.get(execution.owner_role_id)?.title ?? null
              : null,
            triggerSummary: execution.trigger_summary,
            evidenceRequired: execution.evidence_required,
            verificationRequired: execution.verification_required,
            escalationMinutes: execution.escalation_minutes,
          }
        : null,
      roles,
      checklists: (checklistResult.data ?? [])
        .filter((row) => row.process_id === processId)
        .map((row) => ({
          code: row.code,
          name: row.name,
          status: row.status,
        })),
      controlledRecords: (requirementResult.data ?? [])
        .filter((row) => row.process_id === processId)
        .map((row) => {
          const tool = toolById.get(row.tool_template_id);
          return {
            label: row.label,
            toolCode: tool?.code ?? "Controlled tool",
            toolName: tool?.name ?? "Controlled tool",
            required: row.required,
            verificationRequired: row.verification_required,
          };
        }),
      currentWork: processWork.filter((work) =>
        ["pending", "in_progress", "blocked", "awaiting_verification"].includes(
          work.status,
        ),
      ).length,
      awaitingVerification: processWork.filter(
        (work) => work.status === "awaiting_verification",
      ).length,
      completedLast30Days: processWork.filter(
        (work) =>
          work.status === "completed" &&
          work.completed_at &&
          work.completed_at >= thirtyDaysAgo,
      ).length,
      recordsLast30Days: (recordResult.data ?? []).filter(
        (record) => relevantWorkIds.has(record.work_item_id),
      ).length,
      versionCount: versions.length,
      lastChangedAt: latestVersionAt,
    });
  }

  return {
    ...library,
    tools: library.tools.map((tool) => ({
      ...tool,
      schemaDefinition: schemaById.get(tool.id) ?? {},
    })),
    processes: library.processes.map((process) => ({
      ...process,
      operatingMap: operatingMapByProcess.get(process.id),
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

