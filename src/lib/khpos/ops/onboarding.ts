import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: SupabaseClient | null = null;

export const KHPOS_PRACTICE_STEPS = [
  {
    code: "find_process",
    title: "Find the right process",
    detail: "Use the Institutional Library to identify the controlled process before acting.",
  },
  {
    code: "start_work",
    title: "Start assigned work",
    detail: "Open Today, confirm ownership and start the work before recording execution.",
  },
  {
    code: "complete_checklist",
    title: "Complete a checklist",
    detail: "Use the checklist as a control, not as paperwork completed after the fact.",
  },
  {
    code: "attach_evidence",
    title: "Attach evidence",
    detail: "Record evidence or a controlled report/log against the work itself.",
  },
  {
    code: "handle_return",
    title: "Recover returned work",
    detail: "When verification returns work, correct the record and resubmit instead of creating a duplicate.",
  },
] as const;

export interface KhposMyOnboarding {
  organisation: { id: string; name: string };
  staff: {
    id: string;
    reference: string;
    displayName: string;
    status: string;
    onboardingDueDate: string | null;
    mandatoryOutstanding: number;
  } | null;
  role: {
    id: string;
    code: string;
    title: string;
    activeAssignment: boolean;
  } | null;
  charter: {
    mission: string;
    ownedOutcomes: string[];
    responsibilities: string[];
    decisionRights: string[];
    escalationRules: string[];
    kpis: string[];
    requiredPolicyCodes: string[];
  } | null;
  onboarding: Array<{
    id: string;
    code: string;
    title: string;
    description: string;
    category: string;
    mandatory: boolean;
    evidenceRequired: boolean;
    status: string;
    submissionNote: string | null;
    evidenceReference: string | null;
    reviewNote: string | null;
  }>;
  requiredPolicies: Array<{
    id: string;
    code: string;
    name: string;
    acknowledged: boolean;
  }>;
  relevantProcesses: Array<{
    id: string;
    code: string;
    title: string;
    participation: string;
    published: boolean;
  }>;
  practice: {
    completedSteps: string[];
    status: "not_started" | "in_progress" | "completed";
    completedAt: string | null;
  };
}

export class KhposOnboardingError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOnboardingError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOnboardingError("KHP-OS onboarding is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function membership(organisationId: string, userId: string) {
  const { data, error } = await admin()
    .from("organisation_memberships")
    .select("organisations!inner(id,name,status,partner_status,partner_entitlements)")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    throw new KhposOnboardingError(error?.message ?? "Active school membership is required.", 403);
  }
  const org = Array.isArray(data.organisations) ? data.organisations[0] : data.organisations;
  if (
    !org ||
    org.status !== "active" ||
    org.partner_status !== "active" ||
    !Array.isArray(org.partner_entitlements) ||
    !org.partner_entitlements.includes("khpos_core")
  ) {
    throw new KhposOnboardingError("An active KHP-OS school partnership is required.", 403);
  }
  return { id: org.id, name: org.name };
}

export async function getKhposMyOnboarding(
  organisationId: string,
  userId: string,
): Promise<KhposMyOnboarding> {
  const client = admin();
  const organisation = await membership(organisationId, userId);

  const { data: staff, error: staffError } = await client
    .from("khpos_ops_staff")
    .select(
      "id,staff_reference,display_name,status,onboarding_due_date,desired_role_id,role_assignment_id",
    )
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (staffError) throw new KhposOnboardingError(staffError.message, 500);

  const { data: assignments, error: assignmentsError } = await client
    .from("khpos_ops_role_assignments")
    .select("id,role_id,primary_assignment,status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (assignmentsError) throw new KhposOnboardingError(assignmentsError.message, 500);

  const assignmentRoleIds = (assignments ?? []).map((item) => item.role_id);
  let roleId = staff?.desired_role_id ?? null;
  if (!roleId && assignments?.length) {
    roleId =
      assignments.find((item) => item.primary_assignment)?.role_id ??
      assignments[0].role_id;
  }

  const [
    roleResult,
    charterResult,
    onboardingResult,
    practiceResult,
    processRoleResult,
  ] = await Promise.all([
    roleId
      ? client
          .from("khpos_ops_roles")
          .select("id,code,title")
          .eq("id", roleId)
          .eq("organisation_id", organisationId)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    roleId
      ? client
          .from("khpos_ops_role_charters")
          .select(
            "mission,owned_outcomes,responsibilities,decision_rights,escalation_rules,kpis,required_policy_codes",
          )
          .eq("role_id", roleId)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    staff
      ? client
          .from("khpos_ops_staff_onboarding_items")
          .select(
            "id,requirement_code,title,description,category,mandatory,evidence_required,status,submission_note,evidence_reference,review_note",
          )
          .eq("organisation_id", organisationId)
          .eq("staff_id", staff.id)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    client
      .from("khpos_ops_practice_runs")
      .select("completed_steps,status,completed_at")
      .eq("organisation_id", organisationId)
      .eq("user_id", userId)
      .eq("scenario_code", "KHPOS_CORE_V1")
      .maybeSingle(),
    roleId
      ? client
          .from("khpos_ops_process_roles")
          .select("process_id,participation")
          .eq("role_id", roleId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError = [
    roleResult.error,
    charterResult.error,
    onboardingResult.error,
    practiceResult.error,
    processRoleResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new KhposOnboardingError(firstError?.message ?? "Onboarding could not be loaded.", 500);
  }

  const role = roleResult.data;
  const charter = charterResult.data;
  const processIds = Array.from(
    new Set((processRoleResult.data ?? []).map((item) => item.process_id)),
  );

  const [processResult, versionResult, policyResult] = await Promise.all([
    processIds.length
      ? client
          .from("khpos_ops_processes")
          .select("id,code,title")
          .eq("organisation_id", organisationId)
          .in("id", processIds)
      : Promise.resolve({ data: [], error: null }),
    processIds.length
      ? client
          .from("khpos_ops_process_versions")
          .select("process_id")
          .eq("status", "active")
          .in("process_id", processIds)
      : Promise.resolve({ data: [], error: null }),
    charter && stringArray(charter.required_policy_codes).length
      ? client
          .from("khpos_ops_policies")
          .select("id,code,name")
          .eq("organisation_id", organisationId)
          .in("code", stringArray(charter.required_policy_codes))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lookupError = [processResult.error, versionResult.error, policyResult.error].find(Boolean);
  if (lookupError) {
    throw new KhposOnboardingError(lookupError?.message ?? "Role learning map could not be loaded.", 500);
  }

  const policyIds = (policyResult.data ?? []).map((item) => item.id);
  const { data: activePolicyVersions, error: policyVersionError } = policyIds.length
    ? await client
        .from("khpos_ops_policy_versions")
        .select("id,policy_id")
        .eq("status", "active")
        .in("policy_id", policyIds)
    : { data: [], error: null };

  if (policyVersionError) throw new KhposOnboardingError(policyVersionError.message, 500);

  const versionIds = (activePolicyVersions ?? []).map((item) => item.id);
  const { data: acknowledgements, error: acknowledgementError } = versionIds.length
    ? await client
        .from("khpos_ops_policy_acknowledgements")
        .select("policy_version_id")
        .eq("organisation_id", organisationId)
        .eq("user_id", userId)
        .in("policy_version_id", versionIds)
    : { data: [], error: null };

  if (acknowledgementError) throw new KhposOnboardingError(acknowledgementError.message, 500);

  const activePolicyVersionByPolicy = new Map(
    (activePolicyVersions ?? []).map((item) => [item.policy_id, item.id]),
  );
  const acknowledgedVersionIds = new Set(
    (acknowledgements ?? []).map((item) => item.policy_version_id),
  );
  const activeProcessIds = new Set((versionResult.data ?? []).map((item) => item.process_id));
  const participationByProcess = new Map(
    (processRoleResult.data ?? []).map((item) => [item.process_id, item.participation]),
  );
  const onboarding = (onboardingResult.data ?? []).map((item) => ({
    id: item.id,
    code: item.requirement_code,
    title: item.title,
    description: item.description,
    category: item.category,
    mandatory: item.mandatory,
    evidenceRequired: item.evidence_required,
    status: item.status,
    submissionNote: item.submission_note,
    evidenceReference: item.evidence_reference,
    reviewNote: item.review_note,
  }));
  const mandatoryOutstanding = onboarding.filter(
    (item) => item.mandatory && !["completed", "waived"].includes(item.status),
  ).length;

  return {
    organisation,
    staff: staff
      ? {
          id: staff.id,
          reference: staff.staff_reference,
          displayName: staff.display_name,
          status: staff.status,
          onboardingDueDate: staff.onboarding_due_date,
          mandatoryOutstanding,
        }
      : null,
    role: role
      ? {
          id: role.id,
          code: role.code,
          title: role.title,
          activeAssignment: assignmentRoleIds.includes(role.id),
        }
      : null,
    charter: charter
      ? {
          mission: charter.mission,
          ownedOutcomes: stringArray(charter.owned_outcomes),
          responsibilities: stringArray(charter.responsibilities),
          decisionRights: stringArray(charter.decision_rights),
          escalationRules: stringArray(charter.escalation_rules),
          kpis: stringArray(charter.kpis),
          requiredPolicyCodes: stringArray(charter.required_policy_codes),
        }
      : null,
    onboarding,
    requiredPolicies: (policyResult.data ?? []).map((policy) => {
      const versionId = activePolicyVersionByPolicy.get(policy.id);
      return {
        id: policy.id,
        code: policy.code,
        name: policy.name,
        acknowledged: versionId ? acknowledgedVersionIds.has(versionId) : false,
      };
    }),
    relevantProcesses: (processResult.data ?? [])
      .map((process) => ({
        id: process.id,
        code: process.code,
        title: process.title,
        participation: participationByProcess.get(process.id) ?? "participant",
        published: activeProcessIds.has(process.id),
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    practice: practiceResult.data
      ? {
          completedSteps: stringArray(practiceResult.data.completed_steps),
          status: practiceResult.data.status as "in_progress" | "completed",
          completedAt: practiceResult.data.completed_at,
        }
      : {
          completedSteps: [],
          status: "not_started",
          completedAt: null,
        },
  };
}

export async function saveKhposPractice(
  organisationId: string,
  userId: string,
  completedSteps: string[],
) {
  const allowed = new Set(KHPOS_PRACTICE_STEPS.map((step) => step.code));
  if (completedSteps.some((step) => !allowed.has(step as (typeof KHPOS_PRACTICE_STEPS)[number]["code"]))) {
    throw new KhposOnboardingError("Unsupported practice step.", 400);
  }

  const { error } = await admin().rpc("khpos_ops_save_practice_run_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_completed_steps: completedSteps,
  });
  if (error) throw new KhposOnboardingError(error.message, 400);
  return getKhposMyOnboarding(organisationId, userId);
}

export async function submitMyOnboardingItem(
  organisationId: string,
  userId: string,
  itemId: string,
  note: string | null,
  evidenceReference: string | null,
) {
  const { data: staff, error: staffError } = await admin()
    .from("khpos_ops_staff")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (staffError || !staff) {
    throw new KhposOnboardingError(staffError?.message ?? "Linked staff record is required.", 403);
  }

  const { error } = await admin().rpc("khpos_ops_staff_onboarding_action_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
    p_staff_id: staff.id,
    p_item_id: itemId,
    p_action: "submit",
    p_note: note,
    p_evidence_reference: evidenceReference,
  });
  if (error) throw new KhposOnboardingError(error.message, 400);
  return getKhposMyOnboarding(organisationId, userId);
}
