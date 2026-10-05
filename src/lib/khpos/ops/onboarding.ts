import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getKhposOpsLibrary } from "@/lib/khpos/ops/library";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: SupabaseClient | null = null;

export interface KhposOnboardingRole {
  assignmentId: string;
  roleId: string;
  code: string;
  title: string;
  level: number;
  reportsTo: string | null;
  campusName: string | null;
  unitName: string | null;
  primary: boolean;
}

export interface KhposOnboardingProcess {
  id: string;
  code: string;
  title: string;
  participation: "owner" | "approver" | "participant" | "consulted" | "informed";
  criticality: string;
  published: boolean;
}

export interface KhposOnboardingGuide {
  organisation: { id: string; name: string };
  generatedAt: string;
  roles: KhposOnboardingRole[];
  requiredPolicies: Array<{
    id: string;
    code: string;
    name: string;
    acknowledged: boolean;
    published: boolean;
  }>;
  processes: KhposOnboardingProcess[];
  summary: {
    assignedRoles: number;
    requiredPolicies: number;
    policiesAcknowledged: number;
    ownedProcesses: number;
    participatingProcesses: number;
    ready: boolean;
  };
  firstActions: Array<{
    key: string;
    title: string;
    detail: string;
    href: string;
    complete: boolean;
  }>;
}

export class KhposOnboardingError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposOnboardingError";
  }
}

function admin() {
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

export async function getKhposOnboardingGuide(
  organisationId: string,
  userId: string,
): Promise<KhposOnboardingGuide> {
  const client = admin();
  const library = await getKhposOpsLibrary(organisationId, userId);

  const { data: assignments, error: assignmentError } = await client
    .from("khpos_ops_role_assignments")
    .select("id,role_id,campus_id,unit_id,primary_assignment")
    .eq("user_id", userId)
    .eq("status", "active");

  if (assignmentError) {
    throw new KhposOnboardingError(assignmentError.message, 500);
  }

  const roleIds = (assignments ?? []).map((row) => row.role_id);
  if (!roleIds.length) {
    return {
      organisation: library.organisation,
      generatedAt: new Date().toISOString(),
      roles: [],
      requiredPolicies: library.policies
        .filter((policy) => policy.requiredForMyRole)
        .map((policy) => ({
          id: policy.id,
          code: policy.code,
          name: policy.name,
          acknowledged: Boolean(policy.acknowledgedAt),
          published: Boolean(policy.activeVersion),
        })),
      processes: [],
      summary: {
        assignedRoles: 0,
        requiredPolicies: 0,
        policiesAcknowledged: 0,
        ownedProcesses: 0,
        participatingProcesses: 0,
        ready: false,
      },
      firstActions: [
        {
          key: "role",
          title: "Receive your operating role",
          detail:
            "KHP-OS will not guess your authority or responsibilities. A school leader must assign your operating role first.",
          href: "/khpos/" + organisationId + "/team",
          complete: false,
        },
      ],
    };
  }

  const [
    rolesResult,
    campusesResult,
    unitsResult,
    processRolesResult,
  ] = await Promise.all([
    client
      .from("khpos_ops_roles")
      .select("id,code,title,role_level,reports_to_role_id")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_campuses")
      .select("id,name")
      .eq("organisation_id", organisationId),
    client
      .from("khpos_ops_units")
      .select("id,name")
      .eq("organisation_id", organisationId),
    client
      .from("khpos_ops_process_roles")
      .select("process_id,role_id,participation")
      .in("role_id", roleIds),
  ]);

  const firstError = [
    rolesResult.error,
    campusesResult.error,
    unitsResult.error,
    processRolesResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new KhposOnboardingError(
      firstError?.message ?? "Your operating guide could not be assembled.",
      500,
    );
  }

  const allRoles = rolesResult.data ?? [];
  const roleById = new Map(allRoles.map((role) => [role.id, role]));
  const campusById = new Map((campusesResult.data ?? []).map((row) => [row.id, row.name]));
  const unitById = new Map((unitsResult.data ?? []).map((row) => [row.id, row.name]));

  const roles: KhposOnboardingRole[] = (assignments ?? [])
    .map((assignment) => {
      const role = roleById.get(assignment.role_id);
      if (!role) return null;
      return {
        assignmentId: assignment.id,
        roleId: role.id,
        code: role.code,
        title: role.title,
        level: role.role_level,
        reportsTo: role.reports_to_role_id
          ? roleById.get(role.reports_to_role_id)?.title ?? null
          : null,
        campusName: assignment.campus_id
          ? campusById.get(assignment.campus_id) ?? null
          : null,
        unitName: assignment.unit_id
          ? unitById.get(assignment.unit_id) ?? null
          : null,
        primary: assignment.primary_assignment,
      };
    })
    .filter((row): row is KhposOnboardingRole => Boolean(row))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.level - b.level);

  const processById = new Map(library.processes.map((process) => [process.id, process]));
  const strongest = new Map<string, KhposOnboardingProcess["participation"]>();
  const weight: Record<KhposOnboardingProcess["participation"], number> = {
    owner: 5,
    approver: 4,
    participant: 3,
    consulted: 2,
    informed: 1,
  };

  for (const row of processRolesResult.data ?? []) {
    const participation = row.participation as KhposOnboardingProcess["participation"];
    const current = strongest.get(row.process_id);
    if (!current || weight[participation] > weight[current]) {
      strongest.set(row.process_id, participation);
    }
  }

  const processes: KhposOnboardingProcess[] = [];
  for (const [processId, participation] of strongest) {
    const process = processById.get(processId);
    if (!process) continue;
    processes.push({
      id: process.id,
      code: process.code,
      title: process.title,
      participation,
      criticality: process.criticality,
      published: Boolean(process.activeVersion),
    });
  }
  processes.sort(
    (a, b) =>
      weight[b.participation] - weight[a.participation] ||
      a.code.localeCompare(b.code),
  );

  const requiredPolicies = library.policies
    .filter((policy) => policy.requiredForMyRole)
    .map((policy) => ({
      id: policy.id,
      code: policy.code,
      name: policy.name,
      acknowledged: Boolean(policy.acknowledgedAt),
      published: Boolean(policy.activeVersion),
    }));

  const acknowledged = requiredPolicies.filter((policy) => policy.acknowledged).length;
  const publishedRoleProcesses = processes.filter((process) => process.published);
  const ready =
    roles.length > 0 &&
    requiredPolicies.every((policy) => !policy.published || policy.acknowledged) &&
    publishedRoleProcesses.length > 0;

  return {
    organisation: library.organisation,
    generatedAt: new Date().toISOString(),
    roles,
    requiredPolicies,
    processes,
    summary: {
      assignedRoles: roles.length,
      requiredPolicies: requiredPolicies.length,
      policiesAcknowledged: acknowledged,
      ownedProcesses: processes.filter((process) => process.participation === "owner").length,
      participatingProcesses: processes.filter((process) =>
        ["owner", "approver", "participant"].includes(process.participation),
      ).length,
      ready,
    },
    firstActions: [
      {
        key: "role",
        title: "Understand your operating role",
        detail:
          roles.length === 1
            ? "You operate as " +
              roles[0].title +
              (roles[0].reportsTo ? " and report to " + roles[0].reportsTo + "." : ".")
            : "Review the active roles you hold and which authority applies when you act in each one.",
        href: "/khpos/" + organisationId + "/onboarding",
        complete: roles.length > 0,
      },
      {
        key: "policies",
        title: "Read the policies required for your role",
        detail:
          requiredPolicies.length === 0
            ? "No published policy acknowledgement is currently required for your role."
            : acknowledged +
              " of " +
              requiredPolicies.length +
              " required policies acknowledged.",
        href: "/khpos/" + organisationId + "/library?tab=policies",
        complete:
          requiredPolicies.length === 0 ||
          requiredPolicies.every((policy) => !policy.published || policy.acknowledged),
      },
      {
        key: "processes",
        title: "Learn how your responsibilities are executed",
        detail:
          processes.length +
          " controlled processes are mapped to your current operating role(s).",
        href: "/khpos/" + organisationId + "/library?tab=processes",
        complete: publishedRoleProcesses.length > 0,
      },
      {
        key: "today",
        title: "Use Today as your daily starting point",
        detail:
          "Today combines work, verification, issues and decisions that need your action. You should not need to hunt through modules.",
        href: "/khpos/" + organisationId + "/work",
        complete: true,
      },
      {
        key: "practice",
        title: "Run the safe practice workflow",
        detail:
          "Practice Start → Checklist → Evidence → Submit → Verification without creating institutional records.",
        href: "/khpos/" + organisationId + "/onboarding#practice",
        complete: false,
      },
    ],
  };
}
