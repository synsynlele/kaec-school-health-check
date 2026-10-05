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

export interface KhposOpsEvidenceRecord {
  id: string;
  evidenceType: "note" | "link" | "file_reference" | "system_record";
  note: string | null;
  externalUrl: string | null;
  storageReference: string | null;
  verificationStatus: "unverified" | "verified" | "rejected";
  submittedAt: string;
}

export interface KhposOpsWorkRecord {
  id: string;
  requirementId: string;
  toolCode: string;
  toolName: string;
  toolType: string;
  payload: Record<string, unknown>;
  status: "submitted" | "returned" | "verified";
  submittedAt: string;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface KhposOpsWorkRecordRequirement {
  id: string;
  label: string;
  required: boolean;
  minimumEntries: number;
  verificationRequired: boolean;
  toolCode: string;
  toolName: string;
  toolType: string;
  schemaDefinition: Record<string, unknown>;
  records: KhposOpsWorkRecord[];
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
  submittedForVerificationAt: string | null;
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
  evidenceRecords: KhposOpsEvidenceRecord[];
  recordRequirements: KhposOpsWorkRecordRequirement[];
}

export interface KhposOpsVerificationItem extends KhposOpsWorkItem {
  ownerUserId: string;
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
  verificationQueue: KhposOpsVerificationItem[];
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
  return /membership|partnership|required|owned work item|authorised|cannot verify/i.test(
    message ?? "",
  )
    ? 403
    : /does not exist|not configured/i.test(message ?? "")
      ? 503
      : 400;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function hydrateArtifacts<T extends KhposOpsWorkItem>(
  organisationId: string,
  items: T[],
): Promise<T[]> {
  if (!items.length) return items;

  const client = admin();
  const workIds = items.map((item) => item.id);

  const [requirementsResult, recordsResult, evidenceResult, workStateResult] =
    await Promise.all([
      client
        .from("khpos_ops_work_record_requirements")
        .select(
          "id,work_item_id,label,required,minimum_entries,verification_required,tool_code_snapshot,tool_name_snapshot,tool_type_snapshot,schema_snapshot",
        )
        .eq("organisation_id", organisationId)
        .in("work_item_id", workIds),
      client
        .from("khpos_ops_work_records")
        .select(
          "id,work_item_id,requirement_id,tool_code_snapshot,tool_name_snapshot,tool_type_snapshot,payload,status,submitted_at,review_note,reviewed_at",
        )
        .eq("organisation_id", organisationId)
        .in("work_item_id", workIds)
        .order("submitted_at", { ascending: false }),
      client
        .from("khpos_ops_evidence")
        .select(
          "id,work_item_id,evidence_type,note,external_url,storage_reference,verification_status,submitted_at",
        )
        .eq("organisation_id", organisationId)
        .in("work_item_id", workIds)
        .order("submitted_at", { ascending: false }),
      client
        .from("khpos_ops_work_items")
        .select("id,submitted_for_verification_at")
        .eq("organisation_id", organisationId)
        .in("id", workIds),
    ]);

  const firstError = [
    requirementsResult.error,
    recordsResult.error,
    evidenceResult.error,
    workStateResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new KhposOpsWorkError(
      firstError?.message ?? "Operating records could not be loaded.",
      500,
    );
  }

  const recordsByRequirement = new Map<string, KhposOpsWorkRecord[]>();
  for (const row of recordsResult.data ?? []) {
    const list = recordsByRequirement.get(row.requirement_id) ?? [];
    list.push({
      id: row.id,
      requirementId: row.requirement_id,
      toolCode: row.tool_code_snapshot,
      toolName: row.tool_name_snapshot,
      toolType: row.tool_type_snapshot,
      payload: isObject(row.payload) ? row.payload : {},
      status: row.status,
      submittedAt: row.submitted_at,
      reviewNote: row.review_note,
      reviewedAt: row.reviewed_at,
    });
    recordsByRequirement.set(row.requirement_id, list);
  }

  const requirementsByWork = new Map<string, KhposOpsWorkRecordRequirement[]>();
  for (const row of requirementsResult.data ?? []) {
    const list = requirementsByWork.get(row.work_item_id) ?? [];
    list.push({
      id: row.id,
      label: row.label,
      required: row.required,
      minimumEntries: row.minimum_entries,
      verificationRequired: row.verification_required,
      toolCode: row.tool_code_snapshot,
      toolName: row.tool_name_snapshot,
      toolType: row.tool_type_snapshot,
      schemaDefinition: isObject(row.schema_snapshot) ? row.schema_snapshot : {},
      records: recordsByRequirement.get(row.id) ?? [],
    });
    requirementsByWork.set(row.work_item_id, list);
  }

  const evidenceByWork = new Map<string, KhposOpsEvidenceRecord[]>();
  for (const row of evidenceResult.data ?? []) {
    const list = evidenceByWork.get(row.work_item_id) ?? [];
    list.push({
      id: row.id,
      evidenceType: row.evidence_type,
      note: row.note,
      externalUrl: row.external_url,
      storageReference: row.storage_reference,
      verificationStatus: row.verification_status,
      submittedAt: row.submitted_at,
    });
    evidenceByWork.set(row.work_item_id, list);
  }

  const verificationAtByWork = new Map(
    (workStateResult.data ?? []).map((row) => [
      row.id,
      row.submitted_for_verification_at,
    ]),
  );

  return items.map((item) => ({
    ...item,
    submittedForVerificationAt:
      verificationAtByWork.get(item.id) ?? item.submittedForVerificationAt ?? null,
    recordRequirements: requirementsByWork.get(item.id) ?? [],
    evidenceRecords: evidenceByWork.get(item.id) ?? [],
  }));
}

async function getVerificationQueue(
  organisationId: string,
  userId: string,
): Promise<KhposOpsVerificationItem[]> {
  const client = admin();

  const { data: actorAssignments, error: actorAssignmentError } = await client
    .from("khpos_ops_role_assignments")
    .select("id,role_id,campus_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (actorAssignmentError) {
    throw new KhposOpsWorkError(actorAssignmentError.message, 500);
  }
  if (!actorAssignments?.length) return [];

  const actorRoleIds = unique(actorAssignments.map((item) => item.role_id));
  const { data: actorRoles, error: actorRolesError } = await client
    .from("khpos_ops_roles")
    .select("id,code")
    .eq("organisation_id", organisationId)
    .eq("status", "active")
    .in("id", actorRoleIds);

  if (actorRolesError) {
    throw new KhposOpsWorkError(actorRolesError.message, 500);
  }

  const actorCodeByRole = new Map(
    (actorRoles ?? []).map((role) => [role.id, role.code]),
  );
  const leadershipCodes = new Set([
    "VISION_CUSTODIAN",
    "SCHOOL_CUSTODIAN",
    "SCHOOL_GUARDIAN",
  ]);

  const { data: workRows, error: workError } = await client
    .from("khpos_ops_work_items")
    .select(
      "id,title,description,status,priority,due_at,started_at,submitted_for_verification_at,completed_at,blocked_reason,evidence_required,verification_required,process_id,owner_assignment_id,campus_id,unit_id,checklist_template_id",
    )
    .eq("organisation_id", organisationId)
    .eq("status", "awaiting_verification")
    .order("submitted_for_verification_at", { ascending: true });

  if (workError) throw new KhposOpsWorkError(workError.message, 500);
  if (!workRows?.length) return [];

  const ownerAssignmentIds = unique(
    workRows.map((item) => item.owner_assignment_id),
  );
  const { data: ownerAssignments, error: ownerAssignmentError } = await client
    .from("khpos_ops_role_assignments")
    .select("id,user_id,role_id,campus_id,unit_id")
    .in("id", ownerAssignmentIds);

  if (ownerAssignmentError) {
    throw new KhposOpsWorkError(ownerAssignmentError.message, 500);
  }

  const ownerAssignmentById = new Map(
    (ownerAssignments ?? []).map((item) => [item.id, item]),
  );
  const ownerRoleIds = unique(
    (ownerAssignments ?? []).map((item) => item.role_id),
  );
  const { data: ownerRoles, error: ownerRolesError } = await client
    .from("khpos_ops_roles")
    .select("id,title,reports_to_role_id")
    .eq("organisation_id", organisationId)
    .in("id", ownerRoleIds);

  if (ownerRolesError) throw new KhposOpsWorkError(ownerRolesError.message, 500);
  const ownerRoleById = new Map((ownerRoles ?? []).map((item) => [item.id, item]));

  const eligibleRows = workRows.filter((work) => {
    const ownerAssignment = ownerAssignmentById.get(work.owner_assignment_id);
    if (!ownerAssignment || ownerAssignment.user_id === userId) return false;
    const ownerRole = ownerRoleById.get(ownerAssignment.role_id);
    if (!ownerRole) return false;

    return actorAssignments.some((actorAssignment) => {
      const actorCode = actorCodeByRole.get(actorAssignment.role_id);
      const roleAllowed =
        actorAssignment.role_id === ownerRole.reports_to_role_id ||
        (actorCode ? leadershipCodes.has(actorCode) : false);
      const campusAllowed =
        !actorAssignment.campus_id ||
        !work.campus_id ||
        actorAssignment.campus_id === work.campus_id;
      return roleAllowed && campusAllowed;
    });
  });

  if (!eligibleRows.length) return [];

  const processIds = unique(eligibleRows.map((item) => item.process_id));
  const campusIds = unique(eligibleRows.map((item) => item.campus_id));
  const unitIds = unique(eligibleRows.map((item) => item.unit_id));
  const checklistTemplateIds = unique(
    eligibleRows.map((item) => item.checklist_template_id),
  );

  const [processResult, campusResult, unitResult, checklistTemplateResult] =
    await Promise.all([
      processIds.length
        ? client
            .from("khpos_ops_processes")
            .select("id,code,title")
            .in("id", processIds)
        : Promise.resolve({ data: [], error: null }),
      campusIds.length
        ? client
            .from("khpos_ops_campuses")
            .select("id,name")
            .in("id", campusIds)
        : Promise.resolve({ data: [], error: null }),
      unitIds.length
        ? client.from("khpos_ops_units").select("id,name").in("id", unitIds)
        : Promise.resolve({ data: [], error: null }),
      checklistTemplateIds.length
        ? client
            .from("khpos_ops_checklist_templates")
            .select("id,code,name")
            .in("id", checklistTemplateIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const lookupError = [
    processResult.error,
    campusResult.error,
    unitResult.error,
    checklistTemplateResult.error,
  ].find(Boolean);
  if (lookupError) {
    throw new KhposOpsWorkError(lookupError?.message ?? "Verification work could not be loaded.", 500);
  }

  const workIds = eligibleRows.map((item) => item.id);
  const [checklistItemsResult, responsesResult, evidenceCountResult] =
    await Promise.all([
      checklistTemplateIds.length
        ? client
            .from("khpos_ops_checklist_template_items")
            .select(
              "id,template_id,position,label,guidance,response_type,required,options",
            )
            .in("template_id", checklistTemplateIds)
        : Promise.resolve({ data: [], error: null }),
      client
        .from("khpos_ops_checklist_responses")
        .select("work_item_id,template_item_id,response,note,completed_at")
        .in("work_item_id", workIds),
      client
        .from("khpos_ops_evidence")
        .select("work_item_id")
        .eq("organisation_id", organisationId)
        .in("work_item_id", workIds),
    ]);

  const detailError = [
    checklistItemsResult.error,
    responsesResult.error,
    evidenceCountResult.error,
  ].find(Boolean);
  if (detailError) {
    throw new KhposOpsWorkError(detailError?.message ?? "Verification detail could not be loaded.", 500);
  }

  const processById = new Map(
    (processResult.data ?? []).map((item) => [item.id, item]),
  );
  const campusById = new Map(
    (campusResult.data ?? []).map((item) => [item.id, item.name]),
  );
  const unitById = new Map(
    (unitResult.data ?? []).map((item) => [item.id, item.name]),
  );
  const checklistTemplateById = new Map(
    (checklistTemplateResult.data ?? []).map((item) => [item.id, item]),
  );
  const responseByKey = new Map(
    (responsesResult.data ?? []).map((item) => [
      `${item.work_item_id}:${item.template_item_id}`,
      item,
    ]),
  );

  const checklistItemsByTemplate = new Map<string, typeof checklistItemsResult.data>();
  for (const item of checklistItemsResult.data ?? []) {
    const list = checklistItemsByTemplate.get(item.template_id) ?? [];
    list.push(item);
    checklistItemsByTemplate.set(item.template_id, list);
  }

  const evidenceCountByWork = new Map<string, number>();
  for (const row of evidenceCountResult.data ?? []) {
    evidenceCountByWork.set(
      row.work_item_id,
      (evidenceCountByWork.get(row.work_item_id) ?? 0) + 1,
    );
  }

  const baseItems: KhposOpsVerificationItem[] = eligibleRows.map((work) => {
    const ownerAssignment = ownerAssignmentById.get(work.owner_assignment_id)!;
    const ownerRole = ownerRoleById.get(ownerAssignment.role_id)!;
    const process = work.process_id ? processById.get(work.process_id) : undefined;
    const checklistTemplate = work.checklist_template_id
      ? checklistTemplateById.get(work.checklist_template_id)
      : undefined;
    const checklistItems = work.checklist_template_id
      ? [...(checklistItemsByTemplate.get(work.checklist_template_id) ?? [])].sort(
          (a, b) => a.position - b.position,
        )
      : [];

    return {
      id: work.id,
      title: work.title,
      description: work.description,
      status: "awaiting_verification",
      priority: work.priority,
      dueAt: work.due_at,
      startedAt: work.started_at,
      submittedForVerificationAt: work.submitted_for_verification_at,
      completedAt: work.completed_at,
      blockedReason: work.blocked_reason,
      evidenceRequired: work.evidence_required,
      verificationRequired: work.verification_required,
      processCode: process?.code ?? null,
      processTitle: process?.title ?? null,
      roleTitle: ownerRole.title,
      ownerUserId: ownerAssignment.user_id,
      campusName: work.campus_id ? campusById.get(work.campus_id) ?? null : null,
      unitName: work.unit_id ? unitById.get(work.unit_id) ?? null : null,
      checklist: checklistTemplate
        ? {
            code: checklistTemplate.code,
            name: checklistTemplate.name,
            items: checklistItems.map((item) => {
              const response = responseByKey.get(`${work.id}:${item.id}`);
              return {
                id: item.id,
                position: item.position,
                label: item.label,
                guidance: item.guidance,
                responseType: item.response_type,
                required: item.required,
                options: Array.isArray(item.options) ? item.options : [],
                response: response?.response ?? null,
                note: response?.note ?? null,
                completedAt: response?.completed_at ?? null,
              };
            }),
          }
        : null,
      evidenceCount: evidenceCountByWork.get(work.id) ?? 0,
      evidenceRecords: [],
      recordRequirements: [],
    };
  });

  return hydrateArtifacts(organisationId, baseItems);
}

export async function getKhposOpsMyWork(
  organisationId: string,
  userId: string,
): Promise<KhposOpsMyWork> {
  // The database read function materialises due recurring work atomically
  // before returning the queue, so one RPC is sufficient here.
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

  const base = data as unknown as Omit<
    KhposOpsMyWork,
    "verificationQueue" | "items"
  > & { items: KhposOpsWorkItem[] };

  const [items, verificationQueue] = await Promise.all([
    hydrateArtifacts(
      organisationId,
      base.items.map((item) => ({
        ...item,
        submittedForVerificationAt: item.submittedForVerificationAt ?? null,
        evidenceRecords: item.evidenceRecords ?? [],
        recordRequirements: item.recordRequirements ?? [],
      })),
    ),
    getVerificationQueue(organisationId, userId),
  ]);

  return {
    ...base,
    items,
    verificationQueue,
  };
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

export async function submitKhposOpsWorkRecord(
  organisationId: string,
  userId: string,
  workItemId: string,
  requirementId: string,
  payload: Record<string, unknown>,
  recordId?: string | null,
): Promise<KhposOpsMyWork> {
  const { error } = await admin().rpc("khpos_ops_submit_work_record_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_work_item_id: workItemId,
    p_requirement_id: requirementId,
    p_payload: payload,
    p_record_id: recordId ?? null,
  });

  if (error) {
    throw new KhposOpsWorkError(error.message, statusFor(error.message));
  }

  return getKhposOpsMyWork(organisationId, userId);
}

export async function verifyKhposOpsWork(
  organisationId: string,
  userId: string,
  workItemId: string,
  action: "verify" | "return",
  note?: string,
): Promise<KhposOpsMyWork> {
  const { error } = await admin().rpc("khpos_ops_verify_work_server", {
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
