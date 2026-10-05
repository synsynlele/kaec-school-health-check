import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposExecutionMode =
  | "recurring"
  | "event"
  | "condition"
  | "manual_on_demand"
  | "continuous_control"
  | "external_system";

export const KHPOSEventTypes = [
  "role_assignment_activated",
  "staff_coverage_required",
  "academic_recovery_required",
  "learner_support_required",
  "asset_fault_reported",
  "decision_approved",
  "critical_issue_created",
  "work_blocked",
  "kpi_failing",
] as const;

export const KHPOSConditionKeys = [
  "work_overdue",
  "issue_overdue",
  "decision_overdue",
  "kpi_failing",
  "process_unmapped",
] as const;

export interface KhposExecutionItem {
  profileId: string;
  processId: string;
  code: string;
  title: string;
  criticality: string;
  ownerLabel: string;
  operatingSystem: string;
  mode: KhposExecutionMode;
  ownerRoleId: string | null;
  ownerRoleTitle: string | null;
  eventType: string | null;
  conditionKey: string | null;
  triggerSummary: string | null;
  dueOffsetMinutes: number | null;
  evidenceRequired: boolean;
  verificationRequired: boolean;
  escalationMinutes: number | null;
  kpiCodes: string[];
  status: "needs_mapping" | "configured" | "not_applicable";
  recurringRule: {
    code: string;
    title: string;
    cadence: string;
  } | null;
  controlledRecordCount: number;
  ownerParticipationRoleId: string | null;
  ownerParticipationCount: number;
  safeMappingCandidate: boolean;
  blockedByMissingAssignment: boolean;
  recentTriggerFailures: number;
}

export interface KhposExecutionSnapshot {
  organisation: { id: string; name: string };
  canConfigure: boolean;
  roles: Array<{ id: string; code: string; title: string; level: number }>;
  summary: {
    approvedProcesses: number;
    configured: number;
    needsMapping: number;
    recurring: number;
    eventDriven: number;
    conditionDriven: number;
    manual: number;
    continuous: number;
    external: number;
    triggerFailures7d: number;
    safeMappingCandidates: number;
    blockedMissingAssignment: number;
    multipleOwner: number;
    noOwner: number;
  };
  items: KhposExecutionItem[];
}

export interface ConfigureKhposExecutionInput {
  processId: string;
  mode: KhposExecutionMode;
  ownerRoleId?: string | null;
  eventType?: string | null;
  conditionKey?: string | null;
  triggerSummary?: string | null;
  dueOffsetMinutes?: number | null;
  evidenceRequired?: boolean;
  verificationRequired?: boolean;
  escalationMinutes?: number | null;
  kpiCodes?: string[];
}

export interface KhposSafeExecutionMappingResult {
  mapped: number;
  mappedP0: number;
  blockedMissingAssignment: number;
  multipleOwner: number;
  noOwner: number;
}

export interface KhposManualProcessStartResult {
  workId: string;
  processId: string;
  processCode: string;
  processTitle: string;
  ownerRoleId: string;
  ownerRoleTitle: string;
  ownerIsActor: boolean;
  campusId: string | null;
  unitId: string | null;
  dueAt: string | null;
}

export interface StartKhposManualProcessInput {
  processId: string;
  campusId?: string | null;
  unitId?: string | null;
}

export class KhposExecutionError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposExecutionError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposExecutionError("KHP-OS execution control is not configured.", 503);
  }

  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return adminClient;
}

async function actorContext(organisationId: string, userId: string) {
  const client = admin();
  const { data: membership, error: membershipError } = await client
    .from("organisation_memberships")
    .select("role,organisations!inner(id,name,status,partner_status,partner_entitlements)")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new KhposExecutionError(
      membershipError?.message ?? "Active school membership is required.",
      403,
    );
  }

  const organisation = Array.isArray(membership.organisations)
    ? membership.organisations[0]
    : membership.organisations;
  if (
    !organisation ||
    organisation.status !== "active" ||
    organisation.partner_status !== "active" ||
    !Array.isArray(organisation.partner_entitlements) ||
    !organisation.partner_entitlements.includes("khpos_core")
  ) {
    throw new KhposExecutionError(
      "An active KHP-OS school partnership is required.",
      403,
    );
  }

  const { data: assignments, error: assignmentError } = await client
    .from("khpos_ops_role_assignments")
    .select("role_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (assignmentError) throw new KhposExecutionError(assignmentError.message, 500);

  const roleIds = (assignments ?? []).map((item) => item.role_id);
  const { data: actorRoles, error: actorRoleError } = roleIds.length
    ? await client
        .from("khpos_ops_roles")
        .select("id,code,title,role_level")
        .eq("organisation_id", organisationId)
        .eq("status", "active")
        .in("id", roleIds)
    : { data: [], error: null };

  if (actorRoleError) throw new KhposExecutionError(actorRoleError.message, 500);

  const configuratorCodes = new Set([
    "VISION_CUSTODIAN",
    "SCHOOL_CUSTODIAN",
    "SCHOOL_GUARDIAN",
    "ACADEMIC_INSPECTOR",
    "SKILL_INSPECTOR",
  ]);

  return {
    organisation: { id: organisation.id, name: organisation.name },
    canConfigure: (actorRoles ?? []).some((role) => configuratorCodes.has(role.code)),
  };
}

export async function getKhposExecutionSnapshot(
  organisationId: string,
  userId: string,
): Promise<KhposExecutionSnapshot> {
  const client = admin();
  const actor = await actorContext(organisationId, userId);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    processResult,
    versionResult,
    profileResult,
    roleResult,
    recurringResult,
    recordResult,
    processRoleResult,
    failureResult,
  ] = await Promise.all([
    client
      .from("khpos_ops_processes")
      .select("id,code,title,criticality,owner_label,operating_system,status")
      .eq("organisation_id", organisationId)
      .neq("status", "retired"),
    client
      .from("khpos_ops_process_versions")
      .select("process_id")
      .eq("status", "active"),
    client
      .from("khpos_ops_process_execution_profiles")
      .select(
        "id,process_id,activation_mode,owner_role_id,event_type,condition_key,trigger_summary,due_offset_minutes,evidence_required,verification_required,escalation_minutes,kpi_codes,status",
      )
      .eq("organisation_id", organisationId),
    client
      .from("khpos_ops_roles")
      .select("id,code,title,role_level")
      .eq("organisation_id", organisationId)
      .eq("status", "active")
      .order("role_level"),
    client
      .from("khpos_ops_recurring_rules")
      .select("process_id,code,title,cadence,owner_role_id")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_process_tool_requirements")
      .select("process_id")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_process_roles")
      .select("process_id,role_id,participation")
      .eq("participation", "owner"),
    client
      .from("khpos_ops_trigger_events")
      .select("execution_profile_id")
      .eq("organisation_id", organisationId)
      .eq("status", "failed")
      .gte("occurred_at", weekAgo),
  ]);

  const error = [
    processResult.error,
    versionResult.error,
    profileResult.error,
    roleResult.error,
    recurringResult.error,
    recordResult.error,
    processRoleResult.error,
    failureResult.error,
  ].find(Boolean);
  if (error) throw new KhposExecutionError(error?.message ?? "Execution control could not be loaded.", 500);

  const activeRoleIds = (roleResult.data ?? []).map((role) => role.id);
  const { data: activeAssignments, error: activeAssignmentsError } =
    activeRoleIds.length
      ? await client
          .from("khpos_ops_role_assignments")
          .select("role_id")
          .in("role_id", activeRoleIds)
          .eq("status", "active")
      : { data: [], error: null };

  if (activeAssignmentsError) {
    throw new KhposExecutionError(activeAssignmentsError.message, 500);
  }

  const activeProcessIds = new Set((versionResult.data ?? []).map((row) => row.process_id));
  const processes = (processResult.data ?? []).filter((row) => activeProcessIds.has(row.id));
  const profileByProcess = new Map((profileResult.data ?? []).map((row) => [row.process_id, row]));
  const roleById = new Map((roleResult.data ?? []).map((role) => [role.id, role]));
  const recurringByProcess = new Map((recurringResult.data ?? []).map((row) => [row.process_id, row]));
  const recordCount = new Map<string, number>();
  for (const row of recordResult.data ?? []) {
    recordCount.set(row.process_id, (recordCount.get(row.process_id) ?? 0) + 1);
  }
  const ownerRolesByProcess = new Map<string, string[]>();
  for (const row of processRoleResult.data ?? []) {
    const roles = ownerRolesByProcess.get(row.process_id) ?? [];
    roles.push(row.role_id);
    ownerRolesByProcess.set(row.process_id, roles);
  }
  const activeAssignedRoleIds = new Set(
    (activeAssignments ?? []).map((assignment) => assignment.role_id),
  );
  const failuresByProfile = new Map<string, number>();
  for (const row of failureResult.data ?? []) {
    failuresByProfile.set(
      row.execution_profile_id,
      (failuresByProfile.get(row.execution_profile_id) ?? 0) + 1,
    );
  }

  const items: KhposExecutionItem[] = processes
    .map((process) => {
      const profile = profileByProcess.get(process.id);
      if (!profile) return null;
      const recurring = recurringByProcess.get(process.id);
      const ownerRole = profile.owner_role_id ? roleById.get(profile.owner_role_id) : null;
      const participationRoles = ownerRolesByProcess.get(process.id) ?? [];
      const singleParticipationRoleId =
        participationRoles.length === 1 ? participationRoles[0] : null;
      const singleOwnerHasAssignment =
        !!singleParticipationRoleId &&
        activeAssignedRoleIds.has(singleParticipationRoleId);
      return {
        profileId: profile.id,
        processId: process.id,
        code: process.code,
        title: process.title,
        criticality: process.criticality,
        ownerLabel: process.owner_label,
        operatingSystem: process.operating_system,
        mode: profile.activation_mode as KhposExecutionMode,
        ownerRoleId: profile.owner_role_id,
        ownerRoleTitle: ownerRole?.title ?? null,
        eventType: profile.event_type,
        conditionKey: profile.condition_key,
        triggerSummary: profile.trigger_summary,
        dueOffsetMinutes: profile.due_offset_minutes,
        evidenceRequired: profile.evidence_required,
        verificationRequired: profile.verification_required,
        escalationMinutes: profile.escalation_minutes,
        kpiCodes: Array.isArray(profile.kpi_codes) ? profile.kpi_codes : [],
        status: profile.status,
        recurringRule: recurring
          ? { code: recurring.code, title: recurring.title, cadence: recurring.cadence }
          : null,
        controlledRecordCount: recordCount.get(process.id) ?? 0,
        ownerParticipationRoleId: singleParticipationRoleId,
        ownerParticipationCount: participationRoles.length,
        safeMappingCandidate:
          profile.status === "needs_mapping" &&
          profile.activation_mode === "manual_on_demand" &&
          participationRoles.length === 1 &&
          singleOwnerHasAssignment,
        blockedByMissingAssignment:
          profile.status === "needs_mapping" &&
          participationRoles.length === 1 &&
          !singleOwnerHasAssignment,
        recentTriggerFailures: failuresByProfile.get(profile.id) ?? 0,
      };
    })
    .filter((item): item is KhposExecutionItem => Boolean(item))
    .sort(
      (a, b) =>
        Number(a.status === "configured") - Number(b.status === "configured") ||
        a.criticality.localeCompare(b.criticality) ||
        a.code.localeCompare(b.code),
    );

  const summary = {
    approvedProcesses: items.length,
    configured: items.filter((item) => item.status === "configured").length,
    needsMapping: items.filter((item) => item.status === "needs_mapping").length,
    recurring: items.filter((item) => item.status === "configured" && item.mode === "recurring").length,
    eventDriven: items.filter((item) => item.status === "configured" && item.mode === "event").length,
    conditionDriven: items.filter((item) => item.status === "configured" && item.mode === "condition").length,
    manual: items.filter((item) => item.status === "configured" && item.mode === "manual_on_demand").length,
    continuous: items.filter((item) => item.status === "configured" && item.mode === "continuous_control").length,
    external: items.filter((item) => item.status === "configured" && item.mode === "external_system").length,
    triggerFailures7d: items.reduce((sum, item) => sum + item.recentTriggerFailures, 0),
    safeMappingCandidates: items.filter((item) => item.safeMappingCandidate).length,
    blockedMissingAssignment: items.filter(
      (item) => item.blockedByMissingAssignment,
    ).length,
    multipleOwner: items.filter(
      (item) =>
        item.status === "needs_mapping" &&
        item.ownerParticipationCount > 1,
    ).length,
    noOwner: items.filter(
      (item) =>
        item.status === "needs_mapping" &&
        item.ownerParticipationCount === 0,
    ).length,
  };

  return {
    organisation: actor.organisation,
    canConfigure: actor.canConfigure,
    roles: (roleResult.data ?? []).map((role) => ({
      id: role.id,
      code: role.code,
      title: role.title,
      level: role.role_level,
    })),
    summary,
    items,
  };
}

export async function configureKhposExecution(
  organisationId: string,
  userId: string,
  input: ConfigureKhposExecutionInput,
): Promise<KhposExecutionSnapshot> {
  const client = admin();
  const actor = await actorContext(organisationId, userId);
  if (!actor.canConfigure) {
    throw new KhposExecutionError(
      "An active school leadership role is required to configure process execution.",
      403,
    );
  }

  const { data: process, error: processError } = await client
    .from("khpos_ops_processes")
    .select("id")
    .eq("id", input.processId)
    .eq("organisation_id", organisationId)
    .neq("status", "retired")
    .maybeSingle();

  if (processError || !process) {
    throw new KhposExecutionError(processError?.message ?? "Controlled process not found.", 404);
  }

  const { data: activeVersion, error: versionError } = await client
    .from("khpos_ops_process_versions")
    .select("id")
    .eq("process_id", input.processId)
    .eq("status", "active")
    .maybeSingle();

  if (versionError || !activeVersion) {
    throw new KhposExecutionError(
      "Only an approved active process can be mapped for execution.",
      400,
    );
  }

  let ownerRoleId = input.ownerRoleId ?? null;
  if (input.mode === "recurring") {
    const { data: recurringRule, error: recurringError } = await client
      .from("khpos_ops_recurring_rules")
      .select("owner_role_id")
      .eq("organisation_id", organisationId)
      .eq("process_id", input.processId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (recurringError || !recurringRule) {
      throw new KhposExecutionError(
        "Recurring execution requires an active recurring rule for this process.",
        400,
      );
    }
    ownerRoleId = recurringRule.owner_role_id;
  }

  if (
    ["event", "condition", "manual_on_demand", "continuous_control"].includes(input.mode) &&
    !ownerRoleId
  ) {
    throw new KhposExecutionError("Choose the role accountable for this execution mode.", 400);
  }

  if (ownerRoleId) {
    const { data: role, error: roleError } = await client
      .from("khpos_ops_roles")
      .select("id")
      .eq("id", ownerRoleId)
      .eq("organisation_id", organisationId)
      .eq("status", "active")
      .maybeSingle();
    if (roleError || !role) {
      throw new KhposExecutionError("The selected operating role is not active in this school.", 400);
    }
  }

  if (
    input.mode === "event" &&
    (!input.eventType ||
      !KHPOSEventTypes.includes(input.eventType as (typeof KHPOSEventTypes)[number]))
  ) {
    throw new KhposExecutionError("Choose a supported institutional event.", 400);
  }

  if (
    input.mode === "condition" &&
    (!input.conditionKey ||
      !KHPOSConditionKeys.includes(
        input.conditionKey as (typeof KHPOSConditionKeys)[number],
      ))
  ) {
    throw new KhposExecutionError("Choose a supported institutional condition.", 400);
  }

  const { error } = await client
    .from("khpos_ops_process_execution_profiles")
    .update({
      activation_mode: input.mode,
      owner_role_id: ownerRoleId,
      event_type: input.mode === "event" ? input.eventType ?? null : null,
      condition_key: input.mode === "condition" ? input.conditionKey ?? null : null,
      trigger_summary: input.triggerSummary?.trim() || null,
      due_offset_minutes: input.dueOffsetMinutes ?? null,
      evidence_required: input.evidenceRequired ?? false,
      verification_required: input.verificationRequired ?? false,
      escalation_minutes: input.escalationMinutes ?? null,
      kpi_codes: input.kpiCodes ?? [],
      status: "configured",
      configured_by: userId,
      configured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", organisationId)
    .eq("process_id", input.processId);

  if (error) throw new KhposExecutionError(error.message, 400);

  return getKhposExecutionSnapshot(organisationId, userId);
}


export async function applySafeKhposExecutionMappings(
  organisationId: string,
  userId: string,
): Promise<{
  result: KhposSafeExecutionMappingResult;
  execution: KhposExecutionSnapshot;
}> {
  const { data, error } = await admin().rpc(
    "khpos_ops_apply_safe_execution_mappings_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
    },
  );

  if (error || !isObject(data)) {
    const message =
      error?.message ?? "Safe execution mappings could not be applied.";
    throw new KhposExecutionError(
      message,
      /membership|leadership|required/i.test(message) ? 403 : 400,
    );
  }

  const result: KhposSafeExecutionMappingResult = {
    mapped: Number(data.mapped ?? 0),
    mappedP0: Number(data.mappedP0 ?? 0),
    blockedMissingAssignment: Number(data.blockedMissingAssignment ?? 0),
    multipleOwner: Number(data.multipleOwner ?? 0),
    noOwner: Number(data.noOwner ?? 0),
  };

  return {
    result,
    execution: await getKhposExecutionSnapshot(organisationId, userId),
  };
}

export async function startKhposManualProcess(
  organisationId: string,
  userId: string,
  input: StartKhposManualProcessInput,
): Promise<KhposManualProcessStartResult> {
  const { data, error } = await admin().rpc(
    "khpos_ops_start_manual_process_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_process_id: input.processId,
      p_campus_id: input.campusId ?? null,
      p_unit_id: input.unitId ?? null,
    },
  );

  if (error || !isObject(data)) {
    const message = error?.message ?? "The process could not be started.";
    throw new KhposExecutionError(
      message,
      /membership|leader|accountable role holder|authorised/i.test(message)
        ? 403
        : 400,
    );
  }

  return {
    workId: String(data.workId),
    processId: String(data.processId),
    processCode: String(data.processCode),
    processTitle: String(data.processTitle),
    ownerRoleId: String(data.ownerRoleId),
    ownerRoleTitle: String(data.ownerRoleTitle),
    ownerIsActor: Boolean(data.ownerIsActor),
    campusId:
      typeof data.campusId === "string" ? data.campusId : null,
    unitId: typeof data.unitId === "string" ? data.unitId : null,
    dueAt: typeof data.dueAt === "string" ? data.dueAt : null,
  };
}
