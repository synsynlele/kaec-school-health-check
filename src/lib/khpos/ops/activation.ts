import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getKhposOpsLibrary,
  KhposOpsLibraryError,
  POLICY_EDITORS,
} from "@/lib/khpos/ops/library";
import {
  getKaecPolicyBaseline,
  getKaecProcessBaseline,
} from "@/lib/khpos/ops/baselines";

let service: SupabaseClient | undefined;

function admin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new KhposActivationError("KHP-OS Activation is not configured.", 503);
  }

  return (service ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ));
}

export class KhposActivationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposActivationError";
  }
}

export type ActivationAction = {
  key: string;
  title: string;
  detail: string;
  href: string;
  blocking: boolean;
};

export type ActivationSnapshot = {
  organisation: { id: string; name: string };
  foundationComplete: boolean;
  canPrepareDrafts: boolean;
  blockerCount: number;
  people: {
    activeMembers: number;
    assignedMembers: number;
    unassignedMembers: number;
    activeAssignments: number;
    custodianPresent: boolean;
    guardianPresent: boolean;
  };
  safeguarding: {
    activeCampuses: number;
    designatedCampuses: number;
    missingCampuses: number;
  };
  policies: {
    registered: number;
    active: number;
    criticalRegistered: number;
    criticalActive: number;
    criticalMissing: number;
    missingCritical: Array<{
      id: string;
      code: string;
      name: string;
      ownerLabel: string;
    }>;
  };
  processes: {
    registered: number;
    active: number;
    criticalRegistered: number;
    criticalActive: number;
    criticalMissing: number;
    blockedByPolicy: number;
    readyForDrafting: number;
    missingCritical: Array<{
      id: string;
      code: string;
      title: string;
      ownerLabel: string;
      missingPolicyCodes: string[];
    }>;
  };
  adoption: {
    workItems: number;
    issues: number;
    decisions: number;
  };
  actions: ActivationAction[];
};

function unique(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => !!value));
}

function schoolDate(yearOffset = 0) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + yearOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function runActivationDrafts<T>(
  items: T[],
  codeFor: (item: T) => string,
  task: (item: T) => Promise<void>,
) {
  const queue = items.values();
  const failedCodes: string[] = [];
  let created = 0;

  async function lane() {
    for (const item of queue) {
      try {
        await task(item);
        created += 1;
      } catch {
        failedCodes.push(codeFor(item));
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(4, Math.max(1, items.length)) },
      () => lane(),
    ),
  );

  return { created, failedCodes };
}

export type ActivationPackResult = {
  kind: "critical_policies" | "ready_processes";
  requested: number;
  existingOpen: number;
  created: number;
  failedCodes: string[];
};

export async function prepareKhposActivationPack(
  organisationId: string,
  userId: string,
  kind: ActivationPackResult["kind"],
): Promise<ActivationPackResult> {
  const library = await getKhposOpsLibrary(organisationId, userId);
  if (!library.operatingRoleCodes.some((code) => POLICY_EDITORS.includes(code))) {
    throw new KhposActivationError(
      "An active school leadership assignment is required to prepare controlled drafts.",
      403,
    );
  }

  const client = admin();
  const effectiveDate = schoolDate();
  const reviewDate = schoolDate(1);

  if (kind === "critical_policies") {
    const missing = library.policies.filter(
      (policy) =>
        policy.priority === "C0" &&
        policy.status !== "retired" &&
        !policy.activeVersion,
    );

    if (!missing.length) {
      return {
        kind,
        requested: 0,
        existingOpen: 0,
        created: 0,
        failedCodes: [],
      };
    }

    const { data: openRows, error: openError } = await client
      .from("khpos_ops_policy_versions")
      .select("policy_id")
      .in("policy_id", missing.map((policy) => policy.id))
      .in("status", ["draft", "in_review"]);

    if (openError) {
      throw new KhposActivationError(
        openError.message || "Open policy drafts could not be checked.",
        500,
      );
    }

    const openIds = new Set((openRows ?? []).map((row) => row.policy_id));
    const candidates = missing.filter((policy) => !openIds.has(policy.id));

    const outcome = await runActivationDrafts(
      candidates,
      (policy) => policy.code,
      async (policy) => {
        const baseline = getKaecPolicyBaseline(policy);
        const { error } = await client.rpc("khpos_ops_govern_policy_server", {
          p_actor_user_id: userId,
          p_organisation_id: organisationId,
          p_policy_id: policy.id,
          p_action: "save",
          p_input: {
            purpose: baseline.purpose,
            scope: baseline.scope,
            principles: baseline.principles,
            policyStatements: baseline.policyStatements,
            rolesResponsibilities: baseline.rolesResponsibilities,
            rules: baseline.rules,
            exceptions: baseline.exceptions,
            escalation: baseline.escalation,
            recordsEvidence: baseline.recordsEvidence,
            effectiveDate,
            reviewDate,
          },
        });
        if (error) throw error;
      },
    );

    return {
      kind,
      requested: missing.length,
      existingOpen: missing.length - candidates.length,
      created: outcome.created,
      failedCodes: outcome.failedCodes,
    };
  }

  const activePolicyCodes = new Set(
    library.policies
      .filter((policy) => !!policy.activeVersion)
      .map((policy) => policy.code),
  );
  const ready = library.processes.filter(
    (process) =>
      process.criticality === "P0" &&
      process.status !== "retired" &&
      !process.activeVersion &&
      process.governingPolicyCodes.every((code) => activePolicyCodes.has(code)),
  );

  if (!ready.length) {
    return {
      kind,
      requested: 0,
      existingOpen: 0,
      created: 0,
      failedCodes: [],
    };
  }

  const { data: openRows, error: openError } = await client
    .from("khpos_ops_process_versions")
    .select("process_id")
    .in("process_id", ready.map((process) => process.id))
    .in("status", ["draft", "in_review"]);

  if (openError) {
    throw new KhposActivationError(
      openError.message || "Open process drafts could not be checked.",
      500,
    );
  }

  const openIds = new Set((openRows ?? []).map((row) => row.process_id));
  const candidates = ready.filter((process) => !openIds.has(process.id));

  const outcome = await runActivationDrafts(
    candidates,
    (process) => process.code,
    async (process) => {
      const baseline = getKaecProcessBaseline(process);
      const { error } = await client.rpc("khpos_ops_govern_process_server", {
        p_actor_user_id: userId,
        p_organisation_id: organisationId,
        p_process_id: process.id,
        p_action: "save",
        p_input: {
          purpose: baseline.purpose,
          trigger: baseline.trigger,
          inputs: baseline.inputs,
          steps: baseline.steps,
          sla: baseline.sla,
          evidence: baseline.evidence,
          expectedOutcome: baseline.expectedOutcome,
          exceptionConditions: baseline.exceptionConditions,
          escalation: baseline.escalation,
          kpis: baseline.kpis,
          effectiveDate,
        },
      });
      if (error) throw error;
    },
  );

  return {
    kind,
    requested: ready.length,
    existingOpen: ready.length - candidates.length,
    created: outcome.created,
    failedCodes: outcome.failedCodes,
  };
}

export async function getKhposActivation(
  organisationId: string,
  userId: string,
): Promise<ActivationSnapshot> {
  let library;
  try {
    library = await getKhposOpsLibrary(organisationId, userId);
  } catch (error) {
    if (error instanceof KhposOpsLibraryError) {
      throw new KhposActivationError(error.message, error.status);
    }
    throw error;
  }

  const client = admin();
  const [
    membershipsResult,
    campusesResult,
    rolesResult,
    designationsResult,
    workCountResult,
    issueCountResult,
    decisionCountResult,
  ] = await Promise.all([
    client
      .from("organisation_memberships")
      .select("user_id")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_campuses")
      .select("id")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_roles")
      .select("id,code")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_safeguarding_designations")
      .select("campus_id")
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
    client
      .from("khpos_ops_work_items")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId),
    client
      .from("khpos_ops_issues")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId),
    client
      .from("khpos_ops_decisions")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId),
  ]);

  const firstError = [
    membershipsResult.error,
    campusesResult.error,
    rolesResult.error,
    designationsResult.error,
    workCountResult.error,
    issueCountResult.error,
    decisionCountResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new KhposActivationError(
      firstError.message || "Activation status could not be loaded.",
      500,
    );
  }

  const memberships = membershipsResult.data ?? [];
  const campuses = campusesResult.data ?? [];
  const roles = rolesResult.data ?? [];
  const roleIds = roles.map((role) => role.id);
  const assignmentsResult = roleIds.length
    ? await client
        .from("khpos_ops_role_assignments")
        .select("user_id,role_id")
        .in("role_id", roleIds)
        .eq("status", "active")
    : { data: [], error: null };

  if (assignmentsResult.error) {
    throw new KhposActivationError(
      assignmentsResult.error.message || "Operating roles could not be loaded.",
      500,
    );
  }

  const activeMemberIds = unique(memberships.map((item) => item.user_id));
  const roleCodeById = new Map(roles.map((role) => [role.id, role.code]));
  const assignments = assignmentsResult.data ?? [];
  const assignedMemberIds = unique(
    assignments
      .filter((assignment) => activeMemberIds.has(assignment.user_id))
      .map((assignment) => assignment.user_id),
  );
  const assignedRoleCodes = unique(
    assignments.map((assignment) => roleCodeById.get(assignment.role_id)),
  );

  const activePolicyCodes = unique(
    library.policies
      .filter((policy) => !!policy.activeVersion)
      .map((policy) => policy.code),
  );
  const criticalPolicies = library.policies.filter(
    (policy) => policy.priority === "C0" && policy.status !== "retired",
  );
  const missingCriticalPolicies = criticalPolicies.filter(
    (policy) => !policy.activeVersion,
  );

  const criticalProcesses = library.processes.filter(
    (process) => process.criticality === "P0" && process.status !== "retired",
  );
  const missingCriticalProcesses = criticalProcesses
    .filter((process) => !process.activeVersion)
    .map((process) => ({
      id: process.id,
      code: process.code,
      title: process.title,
      ownerLabel: process.ownerLabel,
      missingPolicyCodes: process.governingPolicyCodes.filter(
        (code) => !activePolicyCodes.has(code),
      ),
    }));

  const activeCampusIds = unique(campuses.map((campus) => campus.id));
  const designatedCampusIds = unique(
    (designationsResult.data ?? [])
      .map((designation) => designation.campus_id)
      .filter((campusId) => activeCampusIds.has(campusId)),
  );

  const activeMembers = activeMemberIds.size;
  const assignedMembers = assignedMemberIds.size;
  const unassignedMembers = Math.max(0, activeMembers - assignedMembers);
  const activeCampuses = activeCampusIds.size;
  const designatedCampuses = designatedCampusIds.size;
  const missingCampuses = Math.max(0, activeCampuses - designatedCampuses);
  const custodianPresent =
    assignedRoleCodes.has("VISION_CUSTODIAN") ||
    assignedRoleCodes.has("SCHOOL_CUSTODIAN");
  const guardianPresent = assignedRoleCodes.has("SCHOOL_GUARDIAN");
  const criticalPolicyMissing = missingCriticalPolicies.length;
  const criticalProcessMissing = missingCriticalProcesses.length;
  const blockedByPolicy = missingCriticalProcesses.filter(
    (process) => process.missingPolicyCodes.length > 0,
  ).length;

  const actions: ActivationAction[] = [];
  if (unassignedMembers > 0 || !custodianPresent || !guardianPresent) {
    actions.push({
      key: "people",
      title: "Complete operating authority",
      detail:
        unassignedMembers > 0
          ? `${unassignedMembers} active school member${unassignedMembers === 1 ? "" : "s"} still need an operating-role assignment.`
          : "Core School Custodian / School Guardian authority is incomplete.",
      href: `/khpos/${organisationId}/team`,
      blocking: true,
    });
  }
  if (missingCampuses > 0) {
    actions.push({
      key: "safeguarding",
      title: "Appoint safeguarding lead and deputy",
      detail: `${missingCampuses} active campus${missingCampuses === 1 ? "" : "es"} still need both designated safeguarding people.`,
      href: `/khpos/${organisationId}/safeguarding`,
      blocking: true,
    });
  }
  if (criticalPolicyMissing > 0) {
    actions.push({
      key: "policies",
      title: "Publish critical school policies",
      detail: `${criticalPolicyMissing} C0 polic${criticalPolicyMissing === 1 ? "y is" : "ies are"} still without an active school-approved version. Policies come before dependent processes.`,
      href: `/khpos/${organisationId}/library`,
      blocking: true,
    });
  }
  if (criticalProcessMissing > 0) {
    actions.push({
      key: "processes",
      title: "Publish critical operating processes",
      detail:
        blockedByPolicy > 0
          ? `${criticalProcessMissing} P0 processes are still inactive; ${blockedByPolicy} are currently blocked by unpublished governing policies.`
          : `${criticalProcessMissing} P0 processes are ready to be drafted, reviewed and published.`,
      href: `/khpos/${organisationId}/library`,
      blocking: true,
    });
  }

  const blockerCount = actions.filter((action) => action.blocking).length;
  if (blockerCount === 0) {
    actions.push({
      key: "operate",
      title: "Run the school through KHP-OS",
      detail:
        "The core operating foundation is active. Drive assigned work, issues, decisions and evidence through the system so governance becomes daily behaviour.",
      href: `/khpos/${organisationId}/work`,
      blocking: false,
    });
  }

  return {
    organisation: library.organisation,
    foundationComplete: blockerCount === 0,
    canPrepareDrafts: library.operatingRoleCodes.some((code) =>
      POLICY_EDITORS.includes(code),
    ),
    blockerCount,
    people: {
      activeMembers,
      assignedMembers,
      unassignedMembers,
      activeAssignments: assignments.length,
      custodianPresent,
      guardianPresent,
    },
    safeguarding: {
      activeCampuses,
      designatedCampuses,
      missingCampuses,
    },
    policies: {
      registered: library.policies.filter((policy) => policy.status !== "retired").length,
      active: library.policies.filter((policy) => !!policy.activeVersion).length,
      criticalRegistered: criticalPolicies.length,
      criticalActive: criticalPolicies.length - criticalPolicyMissing,
      criticalMissing: criticalPolicyMissing,
      missingCritical: missingCriticalPolicies.slice(0, 12).map((policy) => ({
        id: policy.id,
        code: policy.code,
        name: policy.name,
        ownerLabel: policy.ownerLabel,
      })),
    },
    processes: {
      registered: library.processes.filter((process) => process.status !== "retired").length,
      active: library.processes.filter((process) => !!process.activeVersion).length,
      criticalRegistered: criticalProcesses.length,
      criticalActive: criticalProcesses.length - criticalProcessMissing,
      criticalMissing: criticalProcessMissing,
      blockedByPolicy,
      readyForDrafting: criticalProcessMissing - blockedByPolicy,
      missingCritical: missingCriticalProcesses.slice(0, 12),
    },
    adoption: {
      workItems: workCountResult.count ?? 0,
      issues: issueCountResult.count ?? 0,
      decisions: decisionCountResult.count ?? 0,
    },
    actions,
  };
}
