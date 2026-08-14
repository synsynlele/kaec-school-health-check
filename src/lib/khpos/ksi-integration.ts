import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getKhposWorkspaceSnapshot } from "@/lib/khpos/workspace";

export const KHPOS_KSI_CONTRACT_VERSION = "1.0";
export const KHPOS_KSI_PAIRING_URL =
  process.env.KSI_INTEGRATION_URL ?? "https://ksi.name.ng/integrations/khpos";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export class KhposKsiIntegrationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposKsiIntegrationError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposKsiIntegrationError("KSI integration is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export type KsiSignalState = "insufficient" | "attention" | "developing" | "strong";

export interface KsiSignalPayload {
  contractVersion: "1.0";
  externalWorkspaceId: string;
  sourceGeneratedAt: string;
  windowStart: string;
  windowEnd: string;
  lessonCount: number;
  validatedLessonCount: number;
  fidelityCheckCount: number;
  fidelityPassCount: number;
  fidelityAverageScore: number | null;
  assessmentCount: number;
  validatedAssessmentCount: number;
  assessmentFromLessonCount: number;
  diagnosisCount: number;
  finalDiagnosisCount: number;
  confirmedInterventionCount: number;
  linkedNextLessonCount: number;
}

interface IntegrationRow {
  id: string;
  status: "pending" | "active" | "revoked" | "error";
  external_tenant_id: string | null;
  external_tenant_name: string | null;
  pairing_expires_at: string | null;
  source_contract_version: string;
  last_synced_at: string | null;
  last_source_generated_at: string | null;
}

interface SnapshotRow {
  source_generated_at: string;
  window_start: string;
  window_end: string;
  lesson_count: number;
  validated_lesson_count: number;
  fidelity_check_count: number;
  fidelity_pass_count: number;
  fidelity_average_score: number | string | null;
  assessment_count: number;
  validated_assessment_count: number;
  assessment_from_lesson_count: number;
  diagnosis_count: number;
  final_diagnosis_count: number;
  confirmed_intervention_count: number;
  linked_next_lesson_count: number;
}

export interface KsiSignalCard {
  key: "hqls_fidelity" | "assessment_alignment" | "diagnosis_governance" | "intervention_continuity";
  title: string;
  state: KsiSignalState;
  headline: string;
  detail: string;
  systems: string[];
}

export interface KhposKsiWorkspace {
  organisation: { id: string; name: string };
  membership: { role: string; canConnect: boolean };
  integration: {
    status: "not_connected" | "pending" | "active" | "revoked" | "error";
    externalWorkspaceId: string | null;
    externalWorkspaceName: string | null;
    pairingExpiresAt: string | null;
    contractVersion: string;
    lastSyncedAt: string | null;
    lastSourceGeneratedAt: string | null;
  };
  latest: KsiSignalPayload | null;
  signals: KsiSignalCard[];
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function deriveSignals(snapshot: KsiSignalPayload | null): KsiSignalCard[] {
  if (!snapshot) return [];
  const fidelityPassRate = pct(snapshot.fidelityPassCount, snapshot.fidelityCheckCount);
  const avgFidelity = snapshot.fidelityAverageScore ?? 0;
  const fidelityState: KsiSignalState = snapshot.fidelityCheckCount < 3
    ? "insufficient"
    : fidelityPassRate >= 80 && avgFidelity >= 85
      ? "strong"
      : fidelityPassRate >= 60 && avgFidelity >= 70
        ? "developing"
        : "attention";

  const validatedAssessmentRate = pct(snapshot.validatedAssessmentCount, snapshot.assessmentCount);
  const lessonLinkedRate = pct(snapshot.assessmentFromLessonCount, snapshot.assessmentCount);
  const assessmentState: KsiSignalState = snapshot.assessmentCount < 3
    ? "insufficient"
    : validatedAssessmentRate >= 80 && lessonLinkedRate >= 80
      ? "strong"
      : validatedAssessmentRate >= 60 && lessonLinkedRate >= 60
        ? "developing"
        : "attention";

  const finalDiagnosisRate = pct(snapshot.finalDiagnosisCount, snapshot.diagnosisCount);
  const diagnosisState: KsiSignalState = snapshot.diagnosisCount < 3
    ? "insufficient"
    : finalDiagnosisRate >= 80
      ? "strong"
      : finalDiagnosisRate >= 60
        ? "developing"
        : "attention";

  const nextLessonRate = pct(snapshot.linkedNextLessonCount, snapshot.confirmedInterventionCount);
  const interventionState: KsiSignalState = snapshot.confirmedInterventionCount < 2
    ? "insufficient"
    : nextLessonRate >= 80
      ? "strong"
      : nextLessonRate >= 60
        ? "developing"
        : "attention";

  return [
    {
      key: "hqls_fidelity",
      title: "HQLS fidelity",
      state: fidelityState,
      headline: snapshot.fidelityCheckCount
        ? `${fidelityPassRate}% pass rate · ${Math.round(avgFidelity)} average fidelity`
        : "No fidelity checks in the signal window",
      detail: `${snapshot.validatedLessonCount}/${snapshot.lessonCount} lessons validated; ${snapshot.fidelityCheckCount} fidelity checks sampled.`,
      systems: ["Learning & Mastery", "Institutional Excellence"],
    },
    {
      key: "assessment_alignment",
      title: "Assessment alignment",
      state: assessmentState,
      headline: `${validatedAssessmentRate}% validated · ${lessonLinkedRate}% lesson-linked`,
      detail: `${snapshot.assessmentCount} assessments observed in the governed 90-day window.`,
      systems: ["Learning & Mastery", "Intelligence & Continuous Improvement"],
    },
    {
      key: "diagnosis_governance",
      title: "Diagnosis governance",
      state: diagnosisState,
      headline: `${finalDiagnosisRate}% finalised`,
      detail: `${snapshot.finalDiagnosisCount}/${snapshot.diagnosisCount} diagnoses reached final governed status.`,
      systems: ["Intelligence & Continuous Improvement", "Human Development Ecosystem"],
    },
    {
      key: "intervention_continuity",
      title: "Intervention continuity",
      state: interventionState,
      headline: `${nextLessonRate}% closed-loop continuity`,
      detail: `${snapshot.linkedNextLessonCount}/${snapshot.confirmedInterventionCount} confirmed handoffs were linked into a next lesson.`,
      systems: ["Learning & Mastery", "Human Development Ecosystem"],
    },
  ];
}

function toPayload(row: SnapshotRow, workspaceId: string): KsiSignalPayload {
  return {
    contractVersion: "1.0",
    externalWorkspaceId: workspaceId,
    sourceGeneratedAt: row.source_generated_at,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    lessonCount: row.lesson_count,
    validatedLessonCount: row.validated_lesson_count,
    fidelityCheckCount: row.fidelity_check_count,
    fidelityPassCount: row.fidelity_pass_count,
    fidelityAverageScore: row.fidelity_average_score === null ? null : Number(row.fidelity_average_score),
    assessmentCount: row.assessment_count,
    validatedAssessmentCount: row.validated_assessment_count,
    assessmentFromLessonCount: row.assessment_from_lesson_count,
    diagnosisCount: row.diagnosis_count,
    finalDiagnosisCount: row.final_diagnosis_count,
    confirmedInterventionCount: row.confirmed_intervention_count,
    linkedNextLessonCount: row.linked_next_lesson_count,
  };
}

export async function getKhposKsiWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposKsiWorkspace> {
  const foundation = await getKhposWorkspaceSnapshot(organisationId, userId);
  const client = admin();
  const { data: integrations, error } = await client
    .from("khpos_integrations")
    .select("id,status,external_tenant_id,external_tenant_name,pairing_expires_at,source_contract_version,last_synced_at,last_source_generated_at")
    .eq("organisation_id", organisationId)
    .eq("provider", "ksi")
    .limit(1);
  if (error) throw new KhposKsiIntegrationError("KSI connection state could not be loaded.", 500);

  const integration = (integrations?.[0] as IntegrationRow | undefined) ?? null;
  let latest: KsiSignalPayload | null = null;
  if (integration?.status === "active" && integration.external_tenant_id) {
    const { data: snapshots, error: snapshotError } = await client
      .from("khpos_ksi_signal_snapshots")
      .select("source_generated_at,window_start,window_end,lesson_count,validated_lesson_count,fidelity_check_count,fidelity_pass_count,fidelity_average_score,assessment_count,validated_assessment_count,assessment_from_lesson_count,diagnosis_count,final_diagnosis_count,confirmed_intervention_count,linked_next_lesson_count")
      .eq("integration_id", integration.id)
      .order("source_generated_at", { ascending: false })
      .limit(1);
    if (snapshotError) throw new KhposKsiIntegrationError("KSI learning signals could not be loaded.", 500);
    const row = snapshots?.[0] as SnapshotRow | undefined;
    if (row) latest = toPayload(row, integration.external_tenant_id);
  }

  const role = foundation.membership.role;
  return {
    organisation: { id: foundation.organisation.id, name: foundation.organisation.name },
    membership: {
      role,
      canConnect: role === "executive" || role === "transformation_lead",
    },
    integration: integration
      ? {
          status: integration.status,
          externalWorkspaceId: integration.external_tenant_id,
          externalWorkspaceName: integration.external_tenant_name,
          pairingExpiresAt: integration.pairing_expires_at,
          contractVersion: integration.source_contract_version,
          lastSyncedAt: integration.last_synced_at,
          lastSourceGeneratedAt: integration.last_source_generated_at,
        }
      : {
          status: "not_connected",
          externalWorkspaceId: null,
          externalWorkspaceName: null,
          pairingExpiresAt: null,
          contractVersion: KHPOS_KSI_CONTRACT_VERSION,
          lastSyncedAt: null,
          lastSourceGeneratedAt: null,
        },
    latest,
    signals: deriveSignals(latest),
  };
}

export async function createKhposKsiPairing(
  organisationId: string,
  userId: string,
): Promise<{ pairingUrl: string; expiresAt: string; integrationId: string }> {
  const client = admin();
  const { data, error } = await client.rpc("khpos_create_ksi_pairing_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });
  if (error || !data || typeof data !== "object") {
    throw new KhposKsiIntegrationError(error?.message ?? "KSI pairing could not be created.", 400);
  }
  const result = data as Record<string, unknown>;
  const token = String(result.pairingToken ?? "");
  const integrationId = String(result.integrationId ?? "");
  const expiresAt = String(result.expiresAt ?? "");
  if (!token || !integrationId || !expiresAt) {
    throw new KhposKsiIntegrationError("KSI pairing could not be created.", 500);
  }
  return {
    pairingUrl: `${KHPOS_KSI_PAIRING_URL}#code=${encodeURIComponent(token)}`,
    expiresAt,
    integrationId,
  };
}

function rpcSignalArgs(signal: KsiSignalPayload) {
  return {
    p_contract_version: signal.contractVersion,
    p_source_generated_at: signal.sourceGeneratedAt,
    p_window_start: signal.windowStart,
    p_window_end: signal.windowEnd,
    p_lesson_count: signal.lessonCount,
    p_validated_lesson_count: signal.validatedLessonCount,
    p_fidelity_check_count: signal.fidelityCheckCount,
    p_fidelity_pass_count: signal.fidelityPassCount,
    p_fidelity_average_score: signal.fidelityAverageScore,
    p_assessment_count: signal.assessmentCount,
    p_validated_assessment_count: signal.validatedAssessmentCount,
    p_assessment_from_lesson_count: signal.assessmentFromLessonCount,
    p_diagnosis_count: signal.diagnosisCount,
    p_final_diagnosis_count: signal.finalDiagnosisCount,
    p_confirmed_intervention_count: signal.confirmedInterventionCount,
    p_linked_next_lesson_count: signal.linkedNextLessonCount,
  };
}

export async function pairKsiAndStoreInitialSignal(input: {
  pairingToken: string;
  workspaceName: string;
  externalActor: string;
  signal: KsiSignalPayload;
}): Promise<{ connectorToken: string; organisationId: string }> {
  const client = admin();
  const { data, error } = await client.rpc("khpos_pair_ksi_with_signal_server", {
    p_pairing_token: input.pairingToken,
    p_external_workspace_id: input.signal.externalWorkspaceId,
    p_external_workspace_name: input.workspaceName,
    p_external_actor: input.externalActor,
    ...rpcSignalArgs(input.signal),
  });
  if (error || !data || typeof data !== "object") {
    throw new KhposKsiIntegrationError(error?.message ?? "KSI pairing could not be completed.", 400);
  }
  const result = data as Record<string, unknown>;
  const connectorToken = String(result.connectorToken ?? "");
  const organisationId = String(result.organisationId ?? "");
  if (!connectorToken || !organisationId) {
    throw new KhposKsiIntegrationError("KSI pairing could not be completed.", 500);
  }
  return { connectorToken, organisationId };
}

export async function ingestKsiSignal(
  connectorToken: string,
  signal: KsiSignalPayload,
): Promise<void> {
  const client = admin();
  const { error } = await client.rpc("khpos_ingest_ksi_signal_server", {
    p_connector_token: connectorToken,
    p_external_workspace_id: signal.externalWorkspaceId,
    ...rpcSignalArgs(signal),
  });
  if (error) throw new KhposKsiIntegrationError(error.message, 400);
}
