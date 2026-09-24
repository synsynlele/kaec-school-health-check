import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export interface KhposOpsCampus {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface KhposOpsUnit {
  id: string;
  campusId: string | null;
  parentUnitId: string | null;
  code: string;
  name: string;
  unitType: string;
  status: string;
}

export interface KhposOpsRoleAssignment {
  id: string;
  userId: string;
  displayName: string;
  campusName: string | null;
  unitName: string | null;
  primaryAssignment: boolean;
  status: string;
}

export interface KhposOpsRoleCharter {
  version: number;
  mission: string;
  ownedOutcomes: string[];
  responsibilities: string[];
  decisionRights: string[];
  escalationRules: string[];
  kpis: string[];
  effectiveDate: string | null;
  status: string;
}

export interface KhposOpsRole {
  id: string;
  code: string;
  title: string;
  category: string;
  level: number;
  reportsToRoleId: string | null;
  reportsToTitle: string | null;
  status: string;
  charter: KhposOpsRoleCharter | null;
  assignments: KhposOpsRoleAssignment[];
}

export interface KhposOpsStructure {
  organisation: {
    id: string;
    name: string;
  };
  membershipRole: string;
  campuses: KhposOpsCampus[];
  units: KhposOpsUnit[];
  roles: KhposOpsRole[];
  summary: {
    campusCount: number;
    unitCount: number;
    roleCount: number;
    assignedRoleCount: number;
    unassignedRoleCount: number;
  };
}

export class KhposOpsStructureError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "KhposOpsStructureError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposOpsStructureError(
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

export async function getKhposOpsStructure(
  organisationId: string,
  userId: string,
): Promise<KhposOpsStructure> {
  const { data, error } = await admin().rpc("khpos_ops_get_structure_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });

  if (error || !isObject(data)) {
    const message = error?.message ?? "Institutional structure could not be loaded.";
    const status =
      /active organisation membership|active partnership|not found/i.test(message)
        ? 403
        : /not configured|does not exist|function .* does not exist/i.test(message)
          ? 503
          : 500;

    throw new KhposOpsStructureError(message, status);
  }

  return data as unknown as KhposOpsStructure;
}
