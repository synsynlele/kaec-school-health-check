import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type OperationalRecordStatus = "submitted" | "returned" | "verified";

export interface OperationalSubmittedRecord {
  id: string;
  workItemId: string;
  workTitle: string;
  processCode: string | null;
  processTitle: string | null;
  requirementLabel: string;
  toolCode: string;
  toolName: string;
  toolType: string;
  payload: Record<string, unknown>;
  status: OperationalRecordStatus;
  submittedAt: string;
  reviewNote: string | null;
  roleTitle: string;
  campusName: string | null;
  unitName: string | null;
}

export interface OperationalChecklistRun {
  workItemId: string;
  workTitle: string;
  processCode: string | null;
  processTitle: string | null;
  checklistCode: string;
  checklistName: string;
  workStatus: string;
  completedAt: string | null;
  roleTitle: string;
  campusName: string | null;
  unitName: string | null;
  items: Array<{
    id: string;
    label: string;
    guidance: string | null;
    required: boolean;
    response: unknown | null;
    note: string | null;
    completedAt: string | null;
  }>;
}

export interface OperationalEvidenceRecord {
  id: string;
  workItemId: string;
  workTitle: string;
  processCode: string | null;
  evidenceType: string;
  note: string | null;
  externalUrl: string | null;
  storageReference: string | null;
  verificationStatus: string;
  submittedAt: string;
  roleTitle: string;
  campusName: string | null;
}

export interface KhposOperationalRecordsWorkspace {
  organisation: { id: string; name: string };
  generatedAt: string;
  canSeeInstitutionRecords: boolean;
  summary: {
    reportsAndLogs: number;
    checklistRuns: number;
    evidenceRecords: number;
    awaitingVerification: number;
  };
  records: OperationalSubmittedRecord[];
  checklists: OperationalChecklistRun[];
  evidence: OperationalEvidenceRecord[];
}

export class KhposOperationalRecordsError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOperationalRecordsError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOperationalRecordsError(
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

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export async function getKhposOperationalRecords(
  organisationId: string,
  userId: string,
): Promise<KhposOperationalRecordsWorkspace> {
  const client = admin();

  const { data: membership, error: membershipError } = await client
    .from("organisation_memberships")
    .select("role,organisations!inner(id,name,status,partner_status,partner_entitlements)")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new KhposOperationalRecordsError(
      membershipError?.message ?? "Active school membership is required.",
      403,
    );
  }

  const organisation = Array.isArray(membership.organisations)
    ? membership.organisations[0]
    : membership.organisations;
  const entitled =
    organisation &&
    organisation.status === "active" &&
    organisation.partner_status === "active" &&
    Array.isArray(organisation.partner_entitlements) &&
    organisation.partner_entitlements.includes("khpos_core");

  if (!entitled) {
    throw new KhposOperationalRecordsError(
      "An active KHP-OS school partnership is required.",
      403,
    );
  }

  const { data: actorAssignments, error: actorAssignmentsError } = await client
    .from("khpos_ops_role_assignments")
    .select("id,role_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (actorAssignmentsError) {
    throw new KhposOperationalRecordsError(actorAssignmentsError.message, 500);
  }

  const actorRoleIds = unique((actorAssignments ?? []).map((item) => item.role_id));
  const { data: actorRoles, error: actorRolesError } = actorRoleIds.length
    ? await client
        .from("khpos_ops_roles")
        .select("id,code")
        .eq("organisation_id", organisationId)
        .eq("status", "active")
        .in("id", actorRoleIds)
    : { data: [], error: null };

  if (actorRolesError) {
    throw new KhposOperationalRecordsError(actorRolesError.message, 500);
  }

  const institutionViewerCodes = new Set([
    "VISION_CUSTODIAN",
    "SCHOOL_CUSTODIAN",
    "SCHOOL_GUARDIAN",
    "ACADEMIC_INSPECTOR",
    "SKILL_INSPECTOR",
    "SECTIONAL_PROMOTER",
  ]);
  const canSeeInstitutionRecords = (actorRoles ?? []).some((role) =>
    institutionViewerCodes.has(role.code),
  );

  let workQuery = client
    .from("khpos_ops_work_items")
    .select(
      "id,title,status,completed_at,process_id,owner_assignment_id,campus_id,unit_id,checklist_template_id,created_at",
    )
    .eq("organisation_id", organisationId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(500);

  if (!canSeeInstitutionRecords) {
    const ownAssignmentIds = (actorAssignments ?? []).map((item) => item.id);
    if (!ownAssignmentIds.length) {
      return {
        organisation: { id: organisationId, name: organisation.name },
        generatedAt: new Date().toISOString(),
        canSeeInstitutionRecords: false,
        summary: {
          reportsAndLogs: 0,
          checklistRuns: 0,
          evidenceRecords: 0,
          awaitingVerification: 0,
        },
        records: [],
        checklists: [],
        evidence: [],
      };
    }
    workQuery = workQuery.in("owner_assignment_id", ownAssignmentIds);
  }

  const { data: workRows, error: workError } = await workQuery;
  if (workError) {
    throw new KhposOperationalRecordsError(workError.message, 500);
  }
  if (!workRows?.length) {
    return {
      organisation: { id: organisationId, name: organisation.name },
      generatedAt: new Date().toISOString(),
      canSeeInstitutionRecords,
      summary: {
        reportsAndLogs: 0,
        checklistRuns: 0,
        evidenceRecords: 0,
        awaitingVerification: 0,
      },
      records: [],
      checklists: [],
      evidence: [],
    };
  }

  const workIds = workRows.map((item) => item.id);
  const processIds = unique(workRows.map((item) => item.process_id));
  const ownerAssignmentIds = unique(workRows.map((item) => item.owner_assignment_id));
  const campusIds = unique(workRows.map((item) => item.campus_id));
  const unitIds = unique(workRows.map((item) => item.unit_id));
  const checklistTemplateIds = unique(
    workRows.map((item) => item.checklist_template_id),
  );

  const [
    submittedResult,
    requirementsResult,
    evidenceResult,
    responseResult,
    checklistItemResult,
    checklistTemplateResult,
    processResult,
    ownerAssignmentResult,
    campusResult,
    unitResult,
    awaitingResult,
  ] = await Promise.all([
    client
      .from("khpos_ops_work_records")
      .select(
        "id,work_item_id,requirement_id,tool_code_snapshot,tool_name_snapshot,tool_type_snapshot,payload,status,submitted_at,review_note",
      )
      .eq("organisation_id", organisationId)
      .in("work_item_id", workIds)
      .order("submitted_at", { ascending: false }),
    client
      .from("khpos_ops_work_record_requirements")
      .select("id,label")
      .eq("organisation_id", organisationId)
      .in("work_item_id", workIds),
    client
      .from("khpos_ops_evidence")
      .select(
        "id,work_item_id,evidence_type,note,external_url,storage_reference,verification_status,submitted_at",
      )
      .eq("organisation_id", organisationId)
      .in("work_item_id", workIds)
      .order("submitted_at", { ascending: false }),
    client
      .from("khpos_ops_checklist_responses")
      .select("work_item_id,template_item_id,response,note,completed_at")
      .in("work_item_id", workIds),
    checklistTemplateIds.length
      ? client
          .from("khpos_ops_checklist_template_items")
          .select("id,template_id,position,label,guidance,required")
          .in("template_id", checklistTemplateIds)
      : Promise.resolve({ data: [], error: null }),
    checklistTemplateIds.length
      ? client
          .from("khpos_ops_checklist_templates")
          .select("id,code,name")
          .in("id", checklistTemplateIds)
      : Promise.resolve({ data: [], error: null }),
    processIds.length
      ? client
          .from("khpos_ops_processes")
          .select("id,code,title")
          .in("id", processIds)
      : Promise.resolve({ data: [], error: null }),
    ownerAssignmentIds.length
      ? client
          .from("khpos_ops_role_assignments")
          .select("id,role_id")
          .in("id", ownerAssignmentIds)
      : Promise.resolve({ data: [], error: null }),
    campusIds.length
      ? client.from("khpos_ops_campuses").select("id,name").in("id", campusIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? client.from("khpos_ops_units").select("id,name").in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("khpos_ops_work_items")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .eq("status", "awaiting_verification"),
  ]);

  const firstError = [
    submittedResult.error,
    requirementsResult.error,
    evidenceResult.error,
    responseResult.error,
    checklistItemResult.error,
    checklistTemplateResult.error,
    processResult.error,
    ownerAssignmentResult.error,
    campusResult.error,
    unitResult.error,
    awaitingResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new KhposOperationalRecordsError(
      firstError?.message ?? "Institutional records could not be loaded.",
      500,
    );
  }

  const roleIds = unique(
    (ownerAssignmentResult.data ?? []).map((item) => item.role_id),
  );
  const { data: roles, error: rolesError } = roleIds.length
    ? await client
        .from("khpos_ops_roles")
        .select("id,title")
        .in("id", roleIds)
    : { data: [], error: null };
  if (rolesError) throw new KhposOperationalRecordsError(rolesError.message, 500);

  const workById = new Map(workRows.map((item) => [item.id, item]));
  const processById = new Map(
    (processResult.data ?? []).map((item) => [item.id, item]),
  );
  const requirementLabelById = new Map(
    (requirementsResult.data ?? []).map((item) => [item.id, item.label]),
  );
  const ownerAssignmentById = new Map(
    (ownerAssignmentResult.data ?? []).map((item) => [item.id, item]),
  );
  const roleById = new Map((roles ?? []).map((item) => [item.id, item.title]));
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
    (responseResult.data ?? []).map((item) => [
      `${item.work_item_id}:${item.template_item_id}`,
      item,
    ]),
  );
  const checklistItemsByTemplate = new Map<
    string,
    NonNullable<typeof checklistItemResult.data>
  >();
  for (const item of checklistItemResult.data ?? []) {
    const list = checklistItemsByTemplate.get(item.template_id) ?? [];
    list.push(item);
    checklistItemsByTemplate.set(item.template_id, list);
  }

  function workContext(workItemId: string) {
    const work = workById.get(workItemId);
    const process = work?.process_id ? processById.get(work.process_id) : undefined;
    const assignment = work
      ? ownerAssignmentById.get(work.owner_assignment_id)
      : undefined;
    return {
      work,
      process,
      roleTitle: assignment ? roleById.get(assignment.role_id) ?? "Staff" : "Staff",
      campusName: work?.campus_id
        ? campusById.get(work.campus_id) ?? null
        : null,
      unitName: work?.unit_id ? unitById.get(work.unit_id) ?? null : null,
    };
  }

  const records: OperationalSubmittedRecord[] = (submittedResult.data ?? []).map(
    (record) => {
      const context = workContext(record.work_item_id);
      return {
        id: record.id,
        workItemId: record.work_item_id,
        workTitle: context.work?.title ?? "Operational work",
        processCode: context.process?.code ?? null,
        processTitle: context.process?.title ?? null,
        requirementLabel:
          requirementLabelById.get(record.requirement_id) ?? record.tool_name_snapshot,
        toolCode: record.tool_code_snapshot,
        toolName: record.tool_name_snapshot,
        toolType: record.tool_type_snapshot,
        payload: isObject(record.payload) ? record.payload : {},
        status: record.status,
        submittedAt: record.submitted_at,
        reviewNote: record.review_note,
        roleTitle: context.roleTitle,
        campusName: context.campusName,
        unitName: context.unitName,
      };
    },
  );

  const checklists: OperationalChecklistRun[] = workRows.flatMap((work) => {
    if (!work.checklist_template_id) return [];
    const template = checklistTemplateById.get(work.checklist_template_id);
    if (!template) return [];
    const items = [
      ...(checklistItemsByTemplate.get(work.checklist_template_id) ?? []),
    ].sort((a, b) => a.position - b.position);
    const answered = items.some((item) =>
      responseByKey.has(`${work.id}:${item.id}`),
    );
    if (!answered) return [];

    const context = workContext(work.id);
    return [
      {
        workItemId: work.id,
        workTitle: work.title,
        processCode: context.process?.code ?? null,
        processTitle: context.process?.title ?? null,
        checklistCode: template.code,
        checklistName: template.name,
        workStatus: work.status,
        completedAt: work.completed_at,
        roleTitle: context.roleTitle,
        campusName: context.campusName,
        unitName: context.unitName,
        items: items.map((item) => {
          const response = responseByKey.get(`${work.id}:${item.id}`);
          return {
            id: item.id,
            label: item.label,
            guidance: item.guidance,
            required: item.required,
            response: response?.response ?? null,
            note: response?.note ?? null,
            completedAt: response?.completed_at ?? null,
          };
        }),
      },
    ];
  });

  const evidence: OperationalEvidenceRecord[] = (evidenceResult.data ?? []).map(
    (item) => {
      const context = workContext(item.work_item_id);
      return {
        id: item.id,
        workItemId: item.work_item_id,
        workTitle: context.work?.title ?? "Operational work",
        processCode: context.process?.code ?? null,
        evidenceType: item.evidence_type,
        note: item.note,
        externalUrl: item.external_url,
        storageReference: item.storage_reference,
        verificationStatus: item.verification_status,
        submittedAt: item.submitted_at,
        roleTitle: context.roleTitle,
        campusName: context.campusName,
      };
    },
  );

  return {
    organisation: { id: organisationId, name: organisation.name },
    generatedAt: new Date().toISOString(),
    canSeeInstitutionRecords,
    summary: {
      reportsAndLogs: records.length,
      checklistRuns: checklists.length,
      evidenceRecords: evidence.length,
      awaitingVerification: awaitingResult.count ?? 0,
    },
    records,
    checklists,
    evidence,
  };
}
