import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: SupabaseClient | null = null;

export class KhposStandardError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposStandardError";
  }
}

export interface KhposStandardCoverage {
  expected: number;
  current: number;
  inheritedDrafts?: number;
  localOpenRevisions?: number;
}

export interface KhposStandardWorkspace {
  organisation: { id: string; name: string };
  access: {
    roleCodes: string[];
    canAdopt: boolean;
    custodianLabel: string;
  };
  release: {
    id: string;
    code: string;
    version: number;
    name: string;
    description: string;
    publishedAt: string | null;
    sourceOrganisationId: string | null;
    summary: Record<string, number>;
  } | null;
  installation: {
    id: string;
    status: "pending_adoption" | "active" | "superseded";
    installedAt: string;
    adoptedAt: string | null;
    summary: Record<string, unknown>;
  } | null;
  coverage: {
    policies: KhposStandardCoverage;
    processes: KhposStandardCoverage;
    tools: KhposStandardCoverage;
    executionProfiles: KhposStandardCoverage;
    checklists: KhposStandardCoverage;
    controlledRecords: KhposStandardCoverage;
    recurringRules: KhposStandardCoverage & {
      active: number;
      paused: number;
    };
  };
  readiness: {
    adoptable: boolean;
    blockers: string[];
    nextAction:
      | "install"
      | "adopt"
      | "finish_local_governance"
      | "activate_operations"
      | "current";
  };
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposStandardError("KAEC Standard services are not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numericSummary(value: unknown): Record<string, number> {
  const src = object(value);
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(src)) {
    if (typeof raw === "number" && Number.isFinite(raw)) result[key] = raw;
  }
  return result;
}

async function authorise(organisationId: string, userId: string) {
  const client = admin();
  const { data: membership, error } = await client
    .from("organisation_memberships")
    .select("organisations!inner(id,name,status,partner_status,partner_entitlements)")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !membership) {
    throw new KhposStandardError(
      error?.message ?? "Active school membership is required.",
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
    throw new KhposStandardError(
      "An active KHP-OS school partnership is required.",
      403,
    );
  }

  const { data: assignments, error: assignmentError } = await client
    .from("khpos_ops_role_assignments")
    .select("role_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (assignmentError) {
    throw new KhposStandardError(assignmentError.message, 500);
  }

  const roleIds = (assignments ?? []).map((item) => item.role_id);
  const { data: roles, error: roleError } = roleIds.length
    ? await client
        .from("khpos_ops_roles")
        .select("code,title")
        .eq("organisation_id", organisationId)
        .eq("status", "active")
        .in("id", roleIds)
    : { data: [], error: null };

  if (roleError) throw new KhposStandardError(roleError.message, 500);

  const roleCodes = (roles ?? []).map((role) => String(role.code));
  const canAdopt =
    roleCodes.includes("VISION_CUSTODIAN") ||
    roleCodes.includes("SCHOOL_CUSTODIAN");

  return {
    organisation: {
      id: String(organisation.id),
      name: String(organisation.name),
    },
    roleCodes,
    canAdopt,
    custodianLabel: roleCodes.includes("VISION_CUSTODIAN")
      ? "Vision Custodian"
      : roleCodes.includes("SCHOOL_CUSTODIAN")
        ? "School Custodian"
        : "Institutional Custodian",
  };
}

function codesFromSnapshot(
  snapshot: Record<string, unknown>,
  key: "policies" | "processes",
) {
  const items = Array.isArray(snapshot[key]) ? snapshot[key] : [];
  return items
    .map((item) => object(item).code)
    .filter(
      (code): code is string =>
        typeof code === "string" && code.length > 0,
    );
}

export async function getKhposStandardWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposStandardWorkspace> {
  const client = admin();
  const auth = await authorise(organisationId, userId);

  const { data: release, error: releaseError } = await client
    .from("khpos_standard_releases")
    .select(
      "id,code,version,name,description,snapshot,source_organisation_id,published_at,status",
    )
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (releaseError) {
    throw new KhposStandardError(releaseError.message, 500);
  }

  if (!release) {
    return {
      organisation: auth.organisation,
      access: {
        roleCodes: auth.roleCodes,
        canAdopt: auth.canAdopt,
        custodianLabel: auth.custodianLabel,
      },
      release: null,
      installation: null,
      coverage: {
        policies: { expected: 0, current: 0 },
        processes: { expected: 0, current: 0 },
        tools: { expected: 0, current: 0 },
        executionProfiles: { expected: 0, current: 0 },
        checklists: { expected: 0, current: 0 },
        controlledRecords: { expected: 0, current: 0 },
        recurringRules: {
          expected: 0,
          current: 0,
          active: 0,
          paused: 0,
        },
      },
      readiness: {
        adoptable: false,
        blockers: ["No active KAEC Standard release is published."],
        nextAction: "install",
      },
    };
  }

  const snapshot = object(release.snapshot);
  const expected = numericSummary(snapshot.summary);
  const policyCodes = codesFromSnapshot(snapshot, "policies");
  const processCodes = codesFromSnapshot(snapshot, "processes");

  const { data: installation, error: installationError } = await client
    .from("khpos_standard_installations")
    .select("id,status,installed_at,adopted_at,summary")
    .eq("organisation_id", organisationId)
    .eq("release_id", release.id)
    .maybeSingle();

  if (installationError) {
    throw new KhposStandardError(installationError.message, 500);
  }

  const [
    policiesResult,
    processesResult,
    toolsResult,
    profilesResult,
    checklistsResult,
    recordsResult,
    recurringResult,
  ] = await Promise.all([
    policyCodes.length
      ? client
          .from("khpos_ops_policies")
          .select("id,code")
          .eq("organisation_id", organisationId)
          .in("code", policyCodes)
      : Promise.resolve({ data: [], error: null }),
    processCodes.length
      ? client
          .from("khpos_ops_processes")
          .select("id,code")
          .eq("organisation_id", organisationId)
          .in("code", processCodes)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("khpos_ops_tool_templates")
      .select("id", { count: "exact" })
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_process_execution_profiles")
      .select("id", { count: "exact" })
      .eq("organisation_id", organisationId),
    client
      .from("khpos_ops_checklist_templates")
      .select("id", { count: "exact" })
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_process_tool_requirements")
      .select("id", { count: "exact" })
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_recurring_rules")
      .select("id,status")
      .eq("organisation_id", organisationId)
      .neq("status", "retired"),
  ]);

  const firstError = [
    policiesResult.error,
    processesResult.error,
    toolsResult.error,
    profilesResult.error,
    checklistsResult.error,
    recordsResult.error,
    recurringResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new KhposStandardError(
      firstError?.message ??
        "KAEC Standard coverage could not be loaded.",
      500,
    );
  }

  const policyIds = (policiesResult.data ?? []).map((item) => item.id);
  const processIds = (processesResult.data ?? []).map((item) => item.id);

  const [policyVersionsResult, processVersionsResult] = await Promise.all([
    policyIds.length
      ? client
          .from("khpos_ops_policy_versions")
          .select("policy_id,status,standard_release_id")
          .in("policy_id", policyIds)
          .in("status", ["draft", "in_review", "active"])
      : Promise.resolve({ data: [], error: null }),
    processIds.length
      ? client
          .from("khpos_ops_process_versions")
          .select("process_id,status,standard_release_id")
          .in("process_id", processIds)
          .in("status", ["draft", "in_review", "active"])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (policyVersionsResult.error || processVersionsResult.error) {
    throw new KhposStandardError(
      policyVersionsResult.error?.message ??
        processVersionsResult.error?.message ??
        "KAEC Standard document state could not be loaded.",
      500,
    );
  }

  const policyVersions = policyVersionsResult.data ?? [];
  const processVersions = processVersionsResult.data ?? [];

  const activePolicies = new Set(
    policyVersions
      .filter((item) => item.status === "active")
      .map((item) => item.policy_id),
  ).size;

  const activeProcesses = new Set(
    processVersions
      .filter((item) => item.status === "active")
      .map((item) => item.process_id),
  ).size;

  const inheritedPolicyDrafts = policyVersions.filter(
    (item) =>
      item.status === "draft" &&
      item.standard_release_id === release.id,
  ).length;

  const inheritedProcessDrafts = processVersions.filter(
    (item) =>
      item.status === "draft" &&
      item.standard_release_id === release.id,
  ).length;

  const localPolicyOpen = policyVersions.filter(
    (item) =>
      ["draft", "in_review"].includes(item.status) &&
      item.standard_release_id !== release.id,
  ).length;

  const localProcessOpen = processVersions.filter(
    (item) =>
      ["draft", "in_review"].includes(item.status) &&
      item.standard_release_id !== release.id,
  ).length;

  const recurring = recurringResult.data ?? [];
  const paused = recurring.filter((item) => item.status === "paused").length;
  const active = recurring.filter((item) => item.status === "active").length;
  const blockers: string[] = [];

  if (!installation) {
    blockers.push(
      "This school has not installed the active KAEC Standard release.",
    );
  } else if (installation.status === "pending_adoption") {
    if (localPolicyOpen > 0) {
      blockers.push(
        String(localPolicyOpen) +
          " local policy revision" +
          (localPolicyOpen === 1 ? "" : "s") +
          " must complete governance before blanket adoption.",
      );
    }
    if (localProcessOpen > 0) {
      blockers.push(
        String(localProcessOpen) +
          " local process revision" +
          (localProcessOpen === 1 ? "" : "s") +
          " must complete governance before blanket adoption.",
      );
    }
    if (!auth.canAdopt) {
      blockers.push(
        "Only the active " +
          auth.custodianLabel +
          " can adopt the institutional standard.",
      );
    }
  }

  const adoptable =
    installation?.status === "pending_adoption" &&
    localPolicyOpen === 0 &&
    localProcessOpen === 0 &&
    auth.canAdopt;

  let nextAction: KhposStandardWorkspace["readiness"]["nextAction"];

  if (!installation) nextAction = "install";
  else if (
    installation.status === "pending_adoption" &&
    (localPolicyOpen > 0 || localProcessOpen > 0)
  ) {
    nextAction = "finish_local_governance";
  } else if (installation.status === "pending_adoption") {
    nextAction = "adopt";
  } else if (paused > 0) {
    nextAction = "activate_operations";
  } else {
    nextAction = "current";
  }

  return {
    organisation: auth.organisation,
    access: {
      roleCodes: auth.roleCodes,
      canAdopt: auth.canAdopt,
      custodianLabel: auth.custodianLabel,
    },
    release: {
      id: String(release.id),
      code: String(release.code),
      version: Number(release.version),
      name: String(release.name),
      description: String(release.description),
      publishedAt: (release.published_at as string | null) ?? null,
      sourceOrganisationId:
        (release.source_organisation_id as string | null) ?? null,
      summary: expected,
    },
    installation: installation
      ? {
          id: String(installation.id),
          status: installation.status as
            | "pending_adoption"
            | "active"
            | "superseded",
          installedAt: String(installation.installed_at),
          adoptedAt: (installation.adopted_at as string | null) ?? null,
          summary: object(installation.summary),
        }
      : null,
    coverage: {
      policies: {
        expected: expected.policies ?? policyCodes.length,
        current: activePolicies,
        inheritedDrafts: inheritedPolicyDrafts,
        localOpenRevisions: localPolicyOpen,
      },
      processes: {
        expected: expected.processes ?? processCodes.length,
        current: activeProcesses,
        inheritedDrafts: inheritedProcessDrafts,
        localOpenRevisions: localProcessOpen,
      },
      tools: {
        expected: expected.tools ?? 0,
        current: toolsResult.count ?? (toolsResult.data ?? []).length,
      },
      executionProfiles: {
        expected: expected.executionProfiles ?? 0,
        current:
          profilesResult.count ?? (profilesResult.data ?? []).length,
      },
      checklists: {
        expected: expected.checklists ?? 0,
        current:
          checklistsResult.count ?? (checklistsResult.data ?? []).length,
      },
      controlledRecords: {
        expected: expected.toolRequirements ?? 0,
        current: recordsResult.count ?? (recordsResult.data ?? []).length,
      },
      recurringRules: {
        expected: expected.recurringRules ?? 0,
        current: recurring.length,
        active,
        paused,
      },
    },
    readiness: { adoptable, blockers, nextAction },
  };
}

export async function adoptKhposStandard(
  organisationId: string,
  userId: string,
  installationId: string,
) {
  const auth = await authorise(organisationId, userId);

  if (!auth.canAdopt) {
    throw new KhposStandardError(
      "Only the active " +
        auth.custodianLabel +
        " can adopt the institutional standard.",
      403,
    );
  }

  const { error } = await admin().rpc(
    "khpos_ops_adopt_standard_release_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_installation_id: installationId,
    },
  );

  if (error) throw new KhposStandardError(error.message, 400);

  return getKhposStandardWorkspace(organisationId, userId);
}
