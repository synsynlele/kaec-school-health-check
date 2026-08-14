import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VerifiedKhposUser } from "@/lib/khpos/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let serviceClient: SupabaseClient | null = null;

export type KhposPartnerStatus = "pending" | "active" | "suspended" | "ended";
export type KhposPartnerAction = "approve" | "suspend" | "reactivate" | "end";
export type KhposPartnerEntitlement =
  | "khpos_core"
  | "ksi_integration"
  | "pipupath_intelligence"
  | "benchmarking";

export interface KhposPartnerSnapshot {
  organisationId: string;
  name: string;
  country: string | null;
  state: string | null;
  schoolType: string | null;
  schoolLevel: string | null;
  partnerStatus: KhposPartnerStatus;
  requestedAt: string | null;
  approvedAt: string | null;
  statusReason: string | null;
  entitlements: KhposPartnerEntitlement[];
  membershipRole: string;
  membershipStatus: string;
}

export interface KhposPartnerRegistryEntry {
  organisationId: string;
  name: string;
  country: string | null;
  state: string | null;
  schoolType: string | null;
  schoolLevel: string | null;
  partnerStatus: KhposPartnerStatus;
  requestedAt: string | null;
  approvedAt: string | null;
  statusReason: string | null;
  entitlements: KhposPartnerEntitlement[];
  memberCount: number;
  latestAssessmentAt: string | null;
  latestOverallScore: number | null;
}

export interface KhposPartnerRegistry {
  viewerRole: "super_admin" | "portfolio_admin" | "support_reviewer";
  summary: { pending: number; active: number; suspended: number; ended: number };
  partners: KhposPartnerRegistryEntry[];
}

export class KhposPartnershipError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposPartnershipError";
  }
}

function service(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposPartnershipError("KHP-OS partnership services are not configured.", 503);
  }
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

interface MembershipRow {
  organisation_id: string;
  role: string;
  status: string;
}

interface OrganisationRow {
  id: string;
  name: string;
  country: string | null;
  state: string | null;
  school_type: string | null;
  school_level: string | null;
  partner_status: KhposPartnerStatus;
  partner_requested_at: string | null;
  partner_approved_at: string | null;
  partner_status_reason: string | null;
  partner_entitlements: KhposPartnerEntitlement[] | null;
}

function combine(membership: MembershipRow, organisation: OrganisationRow): KhposPartnerSnapshot {
  return {
    organisationId: organisation.id,
    name: organisation.name,
    country: organisation.country,
    state: organisation.state,
    schoolType: organisation.school_type,
    schoolLevel: organisation.school_level,
    partnerStatus: organisation.partner_status,
    requestedAt: organisation.partner_requested_at,
    approvedAt: organisation.partner_approved_at,
    statusReason: organisation.partner_status_reason,
    entitlements: organisation.partner_entitlements ?? [],
    membershipRole: membership.role,
    membershipStatus: membership.status,
  };
}

export async function getUserPartnerships(userId: string): Promise<KhposPartnerSnapshot[]> {
  const { data: memberships, error } = await service()
    .from("organisation_memberships")
    .select("organisation_id,role,status")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new KhposPartnershipError("Your school partnerships could not be loaded.", 500);
  if (!memberships?.length) return [];

  const organisationIds = memberships.map((row) => row.organisation_id);
  const { data: organisations, error: orgError } = await service()
    .from("organisations")
    .select(
      "id,name,country,state,school_type,school_level,partner_status,partner_requested_at,partner_approved_at,partner_status_reason,partner_entitlements",
    )
    .in("id", organisationIds);

  if (orgError) throw new KhposPartnershipError("Your school partnerships could not be loaded.", 500);
  const byId = new Map((organisations ?? []).map((row) => [row.id, row as OrganisationRow]));

  return (memberships as MembershipRow[])
    .map((membership) => {
      const organisation = byId.get(membership.organisation_id);
      return organisation ? combine(membership, organisation) : null;
    })
    .filter((value): value is KhposPartnerSnapshot => value !== null);
}

export async function getUserPartnership(
  organisationId: string,
  userId: string,
): Promise<KhposPartnerSnapshot> {
  const { data: membership, error } = await service()
    .from("organisation_memberships")
    .select("organisation_id,role,status")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new KhposPartnershipError("Partnership status could not be loaded.", 500);
  if (!membership) throw new KhposPartnershipError("You do not have access to this school partnership.", 403);

  const { data: organisation, error: orgError } = await service()
    .from("organisations")
    .select(
      "id,name,country,state,school_type,school_level,partner_status,partner_requested_at,partner_approved_at,partner_status_reason,partner_entitlements",
    )
    .eq("id", organisationId)
    .maybeSingle();

  if (orgError) throw new KhposPartnershipError("Partnership status could not be loaded.", 500);
  if (!organisation) throw new KhposPartnershipError("School partnership not found.", 404);

  return combine(membership as MembershipRow, organisation as OrganisationRow);
}

export async function getPartnerRegistry(user: VerifiedKhposUser): Promise<KhposPartnerRegistry> {
  const { data, error } = await service().rpc("khpos_get_partner_registry_server", {
    p_actor_user_id: user.id,
  });
  if (error || !data || typeof data !== "object") {
    throw new KhposPartnershipError(
      error?.message ?? "Partnership Registry could not be loaded.",
      error?.message?.includes("administrator") ? 403 : 500,
    );
  }
  return data as KhposPartnerRegistry;
}

export async function managePartner(
  user: VerifiedKhposUser,
  input: { organisationId: string; action: KhposPartnerAction; reason: string },
): Promise<KhposPartnerRegistry> {
  if (user.aal !== "aal2") {
    throw new KhposPartnershipError(
      "Verify administrator MFA in the Admin Console before changing a school partnership.",
      403,
    );
  }

  const { error } = await service().rpc("khpos_manage_partner_server", {
    p_actor_user_id: user.id,
    p_organisation_id: input.organisationId,
    p_action: input.action,
    p_reason: input.reason.trim(),
  });
  if (error) throw new KhposPartnershipError(error.message, 400);
  return getPartnerRegistry(user);
}
