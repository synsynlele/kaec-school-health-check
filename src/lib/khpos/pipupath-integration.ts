import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getKhposWorkspaceSnapshot } from "@/lib/khpos/workspace";

export const KHPOS_PIPUPATH_CONTRACT_VERSION = "1.0";
export const KHPOS_PIPUPATH_REPORTING_MINIMUM = 5;
export const PIPUPATH_INTEGRATION_BASE_URL =
  process.env.PIPUPATH_INTEGRATION_URL ?? "https://www.pipupath.name.ng";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export class KhposPipupathIntegrationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposPipupathIntegrationError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposPipupathIntegrationError("PipuPath integration is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export type PipupathSignalState = "insufficient" | "attention" | "developing" | "strong";

export interface PipupathSignalPayload {
  contractVersion: "1.0";
  externalCohortId: string;
  sourceGeneratedAt: string;
  windowStart: string;
  windowEnd: string;
  reportingEligible: boolean;
  cohortMemberCount: number;
  activeProfileCount: number;
  pathSelectedCount: number;
  questParticipantCount: number;
  evidenceBackedQuestParticipantCount: number;
  projectParticipantCount: number;
  projectCompletionParticipantCount: number;
  continuationEligibleCount: number;
  continuingCycleParticipantCount: number;
}

interface IntegrationRow {
  id: string;
  status: "pending" | "active" | "revoked" | "error";
  external_tenant_id: string | null;
  external_tenant_name: string | null;
  external_invite_url: string | null;
  pairing_expires_at: string | null;
  source_contract_version: string;
  last_synced_at: string | null;
  last_source_generated_at: string | null;
}

interface SnapshotRow {
  source_generated_at: string;
  window_start: string;
  window_end: string;
  reporting_eligible: boolean;
  cohort_member_count: number;
  active_profile_count: number;
  path_selected_count: number;
  quest_participant_count: number;
  evidence_backed_quest_participant_count: number;
  project_participant_count: number;
  project_completion_participant_count: number;
  continuation_eligible_count: number;
  continuing_cycle_participant_count: number;
}

export interface PipupathSignalCard {
  key: "potential_direction" | "capability_practice" | "value_creation" | "development_continuity";
  title: string;
  state: PipupathSignalState;
  headline: string;
  detail: string;
  systems: string[];
}

export interface KhposPipupathWorkspace {
  organisation: { id: string; name: string };
  membership: { role: string; canConnect: boolean };
  integration: {
    status: "not_connected" | "pending" | "active" | "revoked" | "error";
    externalCohortId: string | null;
    externalCohortName: string | null;
    invitationUrl: string | null;
    pairingExpiresAt: string | null;
    contractVersion: string;
    lastSyncedAt: string | null;
    lastSourceGeneratedAt: string | null;
  };
  latest: PipupathSignalPayload | null;
  signals: PipupathSignalCard[];
  privacy: { reportingMinimum: number; learnerLevelDataReceived: false };
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function suppressedCards(): PipupathSignalCard[] {
  const detail = `PipuPath will release group-level signals only after at least ${KHPOS_PIPUPATH_REPORTING_MINIMUM} learners have voluntarily joined this school cohort.`;
  return [
    ["potential_direction", "Potential discovery & direction", ["Identity & Direction", "Human Development Ecosystem"]],
    ["capability_practice", "Capability practice", ["Capability Development", "Learning & Mastery"]],
    ["value_creation", "Value creation", ["Value Creation & Application", "Capability Development"]],
    ["development_continuity", "Development continuity", ["Human Development Ecosystem", "Intelligence & Continuous Improvement"]],
  ].map(([key, title, systems]) => ({
    key: key as PipupathSignalCard["key"],
    title: title as string,
    state: "insufficient" as const,
    headline: "Waiting for a privacy-safe cohort",
    detail,
    systems: systems as string[],
  }));
}

export function derivePipupathSignals(snapshot: PipupathSignalPayload | null): PipupathSignalCard[] {
  if (!snapshot) return [];
  if (!snapshot.reportingEligible) return suppressedCards();

  const profileRate = pct(snapshot.activeProfileCount, snapshot.cohortMemberCount);
  const selectedPathRate = pct(snapshot.pathSelectedCount, snapshot.activeProfileCount);
  const directionState: PipupathSignalState = profileRate >= 80 && selectedPathRate >= 70
    ? "strong"
    : profileRate >= 60 && selectedPathRate >= 50
      ? "developing"
      : "attention";

  const questParticipation = pct(snapshot.questParticipantCount, snapshot.cohortMemberCount);
  const evidenceRate = pct(snapshot.evidenceBackedQuestParticipantCount, snapshot.questParticipantCount);
  const capabilityState: PipupathSignalState = questParticipation >= 60 && evidenceRate >= 70
    ? "strong"
    : questParticipation >= 35 && evidenceRate >= 50
      ? "developing"
      : "attention";

  const projectParticipation = pct(snapshot.projectParticipantCount, snapshot.cohortMemberCount);
  const projectCompletion = pct(snapshot.projectCompletionParticipantCount, snapshot.projectParticipantCount);
  const valueState: PipupathSignalState = projectParticipation >= 40 && projectCompletion >= 60
    ? "strong"
    : projectParticipation >= 20 && projectCompletion >= 40
      ? "developing"
      : "attention";

  const continuationRate = pct(snapshot.continuingCycleParticipantCount, snapshot.continuationEligibleCount);
  const continuityState: PipupathSignalState = snapshot.continuationEligibleCount === 0
    ? "insufficient"
    : continuationRate >= 60
      ? "strong"
      : continuationRate >= 35
        ? "developing"
        : "attention";

  return [
    {
      key: "potential_direction",
      title: "Potential discovery & direction",
      state: directionState,
      headline: `${profileRate}% active profiles · ${selectedPathRate}% selected a path`,
      detail: `${snapshot.activeProfileCount}/${snapshot.cohortMemberCount} participating learners have an active Human Potential Profile; ${snapshot.pathSelectedCount} have made an explicit pathway choice.`,
      systems: ["Identity & Direction", "Human Development Ecosystem"],
    },
    {
      key: "capability_practice",
      title: "Capability practice",
      state: capabilityState,
      headline: `${questParticipation}% practised · ${evidenceRate}% evidence-backed`,
      detail: `${snapshot.questParticipantCount} cohort members entered practical quests in the 90-day window; ${snapshot.evidenceBackedQuestParticipantCount} completed evidence-backed practice.`,
      systems: ["Capability Development", "Learning & Mastery"],
    },
    {
      key: "value_creation",
      title: "Value creation",
      state: valueState,
      headline: `${projectParticipation}% built projects · ${projectCompletion}% completed`,
      detail: `${snapshot.projectParticipantCount} cohort members moved into Builder Projects; ${snapshot.projectCompletionParticipantCount} completed at least one project in the signal window.`,
      systems: ["Value Creation & Application", "Capability Development"],
    },
    {
      key: "development_continuity",
      title: "Development continuity",
      state: continuityState,
      headline: snapshot.continuationEligibleCount
        ? `${continuationRate}% continued into another development cycle`
        : "Not enough completed-builder journeys to assess continuity",
      detail: `${snapshot.continuingCycleParticipantCount}/${snapshot.continuationEligibleCount} continuation-eligible learners have moved beyond their first Journey cycle.`,
      systems: ["Human Development Ecosystem", "Intelligence & Continuous Improvement"],
    },
  ];
}

function toPayload(row: SnapshotRow, cohortId: string): PipupathSignalPayload {
  return {
    contractVersion: "1.0",
    externalCohortId: cohortId,
    sourceGeneratedAt: row.source_generated_at,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    reportingEligible: row.reporting_eligible,
    cohortMemberCount: row.cohort_member_count,
    activeProfileCount: row.active_profile_count,
    pathSelectedCount: row.path_selected_count,
    questParticipantCount: row.quest_participant_count,
    evidenceBackedQuestParticipantCount: row.evidence_backed_quest_participant_count,
    projectParticipantCount: row.project_participant_count,
    projectCompletionParticipantCount: row.project_completion_participant_count,
    continuationEligibleCount: row.continuation_eligible_count,
    continuingCycleParticipantCount: row.continuing_cycle_participant_count,
  };
}

export async function getKhposPipupathWorkspace(organisationId: string, userId: string): Promise<KhposPipupathWorkspace> {
  const foundation = await getKhposWorkspaceSnapshot(organisationId, userId);
  const client = admin();
  const { data: integrations, error } = await client
    .from("khpos_integrations")
    .select("id,status,external_tenant_id,external_tenant_name,external_invite_url,pairing_expires_at,source_contract_version,last_synced_at,last_source_generated_at")
    .eq("organisation_id", organisationId)
    .eq("provider", "pipupath")
    .limit(1);
  if (error) throw new KhposPipupathIntegrationError("PipuPath connection state could not be loaded.", 500);

  const integration = (integrations?.[0] as IntegrationRow | undefined) ?? null;
  let latest: PipupathSignalPayload | null = null;
  if (integration?.status === "active" && integration.external_tenant_id) {
    const { data: snapshots, error: snapshotError } = await client
      .from("khpos_pipupath_signal_snapshots")
      .select("source_generated_at,window_start,window_end,reporting_eligible,cohort_member_count,active_profile_count,path_selected_count,quest_participant_count,evidence_backed_quest_participant_count,project_participant_count,project_completion_participant_count,continuation_eligible_count,continuing_cycle_participant_count")
      .eq("integration_id", integration.id)
      .order("source_generated_at", { ascending: false })
      .limit(1);
    if (snapshotError) throw new KhposPipupathIntegrationError("PipuPath human-potential signals could not be loaded.", 500);
    const row = snapshots?.[0] as SnapshotRow | undefined;
    if (row) latest = toPayload(row, integration.external_tenant_id);
  }

  const role = foundation.membership.role;
  const canConnect = role === "executive" || role === "transformation_lead";
  return {
    organisation: { id: foundation.organisation.id, name: foundation.organisation.name },
    membership: { role, canConnect },
    integration: integration
      ? {
          status: integration.status,
          externalCohortId: integration.external_tenant_id,
          externalCohortName: integration.external_tenant_name,
          invitationUrl: canConnect ? integration.external_invite_url : null,
          pairingExpiresAt: integration.pairing_expires_at,
          contractVersion: integration.source_contract_version,
          lastSyncedAt: integration.last_synced_at,
          lastSourceGeneratedAt: integration.last_source_generated_at,
        }
      : {
          status: "not_connected",
          externalCohortId: null,
          externalCohortName: null,
          invitationUrl: null,
          pairingExpiresAt: null,
          contractVersion: KHPOS_PIPUPATH_CONTRACT_VERSION,
          lastSyncedAt: null,
          lastSourceGeneratedAt: null,
        },
    latest,
    signals: derivePipupathSignals(latest),
    privacy: { reportingMinimum: KHPOS_PIPUPATH_REPORTING_MINIMUM, learnerLevelDataReceived: false },
  };
}

function rpcSignalArgs(signal: PipupathSignalPayload) {
  return {
    p_contract_version: signal.contractVersion,
    p_source_generated_at: signal.sourceGeneratedAt,
    p_window_start: signal.windowStart,
    p_window_end: signal.windowEnd,
    p_reporting_eligible: signal.reportingEligible,
    p_cohort_member_count: signal.cohortMemberCount,
    p_active_profile_count: signal.activeProfileCount,
    p_path_selected_count: signal.pathSelectedCount,
    p_quest_participant_count: signal.questParticipantCount,
    p_evidence_backed_quest_participant_count: signal.evidenceBackedQuestParticipantCount,
    p_project_participant_count: signal.projectParticipantCount,
    p_project_completion_participant_count: signal.projectCompletionParticipantCount,
    p_continuation_eligible_count: signal.continuationEligibleCount,
    p_continuing_cycle_participant_count: signal.continuingCycleParticipantCount,
  };
}

async function postPipupath(path: string, body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`${PIPUPATH_INTEGRATION_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new KhposPipupathIntegrationError("PipuPath could not be reached. The connection has not been trusted yet.", 502);
  }
  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) {
    throw new KhposPipupathIntegrationError(result.error ?? "PipuPath could not complete the institutional sync.", response.status || 502);
  }
}

export async function createKhposPipupathConnection(organisationId: string, userId: string): Promise<KhposPipupathWorkspace> {
  const foundation = await getKhposWorkspaceSnapshot(organisationId, userId);
  const client = admin();
  const { data, error } = await client.rpc("khpos_create_pipupath_pairing_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });
  if (error || !data || typeof data !== "object") {
    throw new KhposPipupathIntegrationError(error?.message ?? "PipuPath pairing could not be created.", 400);
  }
  const pairing = data as Record<string, unknown>;
  const pairingToken = String(pairing.pairingToken ?? "");
  if (!pairingToken) throw new KhposPipupathIntegrationError("PipuPath pairing could not be created.", 500);
  await postPipupath("/api/integrations/khpos/bootstrap", {
    pairingToken,
    organisationName: foundation.organisation.name,
    contractVersion: KHPOS_PIPUPATH_CONTRACT_VERSION,
  });
  return getKhposPipupathWorkspace(organisationId, userId);
}

export async function refreshKhposPipupathSignals(organisationId: string, userId: string): Promise<KhposPipupathWorkspace> {
  const client = admin();
  const { data, error } = await client.rpc("khpos_create_pipupath_sync_token_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });
  if (error || !data || typeof data !== "object") {
    throw new KhposPipupathIntegrationError(error?.message ?? "PipuPath refresh could not be started.", 400);
  }
  const result = data as Record<string, unknown>;
  const syncToken = String(result.syncToken ?? "");
  const externalCohortId = String(result.externalCohortId ?? "");
  if (!syncToken || !externalCohortId) throw new KhposPipupathIntegrationError("PipuPath refresh could not be started.", 500);
  await postPipupath("/api/integrations/khpos/sync", {
    syncToken,
    externalCohortId,
    contractVersion: KHPOS_PIPUPATH_CONTRACT_VERSION,
  });
  return getKhposPipupathWorkspace(organisationId, userId);
}

export async function pairPipupathAndStoreInitialSignal(input: {
  pairingToken: string;
  cohortName: string;
  invitationUrl: string;
  signal: PipupathSignalPayload;
}): Promise<{ organisationId: string }> {
  const { data, error } = await admin().rpc("khpos_pair_pipupath_with_signal_server", {
    p_pairing_token: input.pairingToken,
    p_external_cohort_id: input.signal.externalCohortId,
    p_external_cohort_name: input.cohortName,
    p_external_invite_url: input.invitationUrl,
    ...rpcSignalArgs(input.signal),
  });
  if (error || !data || typeof data !== "object") {
    throw new KhposPipupathIntegrationError(error?.message ?? "PipuPath pairing could not be completed.", 400);
  }
  const organisationId = String((data as Record<string, unknown>).organisationId ?? "");
  if (!organisationId) throw new KhposPipupathIntegrationError("PipuPath pairing could not be completed.", 500);
  return { organisationId };
}

export async function ingestPipupathSignal(syncToken: string, signal: PipupathSignalPayload): Promise<void> {
  const { error } = await admin().rpc("khpos_ingest_pipupath_signal_server", {
    p_sync_token: syncToken,
    p_external_cohort_id: signal.externalCohortId,
    ...rpcSignalArgs(signal),
  });
  if (error) throw new KhposPipupathIntegrationError(error.message, 400);
}
