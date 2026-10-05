import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export const KHPOS_BENCHMARK_MINIMUM_PEERS = 5;

export class KhposBenchmarkingError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposBenchmarkingError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposBenchmarkingError("Benchmark Intelligence is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export type BenchmarkPosition =
  | "above_peer_band"
  | "within_peer_band"
  | "below_peer_band"
  | "insufficient";

export type OperatingBenchmarkPosition =
  | "above_peer_band"
  | "within_peer_band"
  | "below_peer_band"
  | "insufficient_own_data"
  | "insufficient_peers";

export interface OperatingBenchmarkMetric {
  id:
    | "execution_coverage"
    | "work_completion_reliability"
    | "on_time_completion"
    | "verification_first_pass"
    | "issue_closure"
    | "decision_action_closure";
  label: string;
  ownPercent: number | null;
  ownNumerator: number;
  ownDenominator: number;
  minimumObservations: number;
  ownEligible: boolean;
  peerCount: number;
  peerP25: number | null;
  peerMedian: number | null;
  peerP75: number | null;
  position: OperatingBenchmarkPosition;
}

export interface KhposOperatingBenchmark {
  status: "standard_required" | "insufficient_peers" | "ready";
  generatedAt: string;
  windowDays: 30;
  standardCode?: string;
  policy: {
    minimumPeers: 5;
    availablePeers?: number;
    minimumObservationsPerMetric: 5;
    scope?: "country_school_level" | "country" | "global";
    scopeLabel?: string;
    rankingDisabled: true;
    namedPeersExposed: false;
    sameStandardRequired: true;
  };
  metrics: OperatingBenchmarkMetric[];
}

export interface BenchmarkBand {
  ownScore: number;
  peerCount: number;
  peerP25: number;
  peerMedian: number;
  peerP75: number;
  position: BenchmarkPosition;
}

export interface BenchmarkSystem extends BenchmarkBand {
  systemId: string;
}

export interface KhposBenchmarkWorkspace {
  status: "awaiting_baseline" | "insufficient_peers" | "ready";
  generatedAt: string;
  organisation: { id: string; name: string };
  latestAssessment?: {
    id: string;
    overallScore: number;
    completedAt: string | null;
  };
  policy: {
    minimumPeers: number;
    availablePeers?: number;
    scope?: "country_school_level" | "country" | "global";
    scopeLabel?: string;
    rankingDisabled: true;
    namedPeersExposed: false;
  };
  overall?: BenchmarkBand;
  systems?: BenchmarkSystem[];
  improvement?: {
    eligible: boolean;
    peerCount: number;
    ownDeltaFromBaseline: number | null;
    ownVerifiedImprovement: boolean | null;
    ownClassification: string | null;
    peerP25: number | null;
    peerMedian: number | null;
    peerP75: number | null;
    peerVerifiedImprovementRate: number | null;
  };
  operating: KhposOperatingBenchmark;
  portfolioAccess: boolean;
}

export interface PortfolioSystemBand {
  systemId: string;
  institutionCount: number;
  p25: number;
  median: number;
  p75: number;
}

export interface PortfolioInstitution {
  organisationId: string;
  name: string;
  country: string | null;
  state: string | null;
  city: string | null;
  schoolLevel: string | null;
  schoolType: string | null;
  currentOverallScore: number | null;
  latestAssessmentAt: string | null;
  deltaFromBaseline: number | null;
  improvementClassification: string | null;
  verifiedImprovement: boolean;
  activePriorityCount: number;
  criticalPriorityCount: number;
  attention:
    | "baseline_required"
    | "regression"
    | "critical_priorities"
    | "reassessment_required"
    | "monitor";
}

export interface KhposPortfolioObservabilityInstitution {
  organisationId: string;
  name: string;
  standardStatus: "current" | "pending_adoption" | "missing";
  failedTriggers7d: number;
  overdueWork: number;
  staleVerification: number;
  p0Unmapped: number;
  pausedRoutines: number;
  activeRoutines: number;
  attention: "critical" | "high" | "standard";
}

export interface KhposPortfolioObservability {
  generatedAt: string;
  release: {
    id: string;
    code: string;
    version: number;
    name: string;
  } | null;
  summary: {
    eligibleInstitutions: number;
    currentStandard: number;
    pendingAdoption: number;
    missingInstallation: number;
    failedTriggers7d: number;
    overdueWork: number;
    staleVerification: number;
    p0Unmapped: number;
    pausedRoutines: number;
    activeRoutines: number;
  };
  institutions: KhposPortfolioObservabilityInstitution[];
}

export interface KhposPortfolioIntelligence {
  generatedAt: string;
  summary: {
    activeInstitutions: number;
    institutionsWithBaseline: number;
    institutionsWithReassessment: number;
    verifiedImprovementInstitutions: number;
    activePriorities: number;
    criticalPriorities: number;
  };
  systems: PortfolioSystemBand[];
  institutions: PortfolioInstitution[];
  observability: KhposPortfolioObservability;
  privacy: {
    learnerDataIncluded: false;
    evidenceContentIncluded: false;
    publicRankingEnabled: false;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isJwtClockSkewError(message: string | undefined): boolean {
  return /jwt issued at future/i.test(message ?? "");
}

async function retryReadOnJwtClockSkew<T>(
  operation: () => PromiseLike<{ data: T | null; error: { message?: string } | null }>,
): Promise<{ data: T | null; error: { message?: string } | null }> {
  const first = await operation();
  if (!first.error || !isJwtClockSkewError(first.error.message)) return first;

  // Supabase documents clock skew as a possible JWT timing edge case.
  // Retry this read-only request once without changing authentication rules.
  await new Promise((resolve) => setTimeout(resolve, 750));
  return operation();
}

export async function getKhposBenchmarkWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposBenchmarkWorkspace> {
  const [diagnosticResult, operatingResult] = await Promise.all([
    retryReadOnJwtClockSkew(() =>
      admin().rpc("khpos_get_school_benchmark_server", {
        p_actor_user_id: userId,
        p_organisation_id: organisationId,
      }),
    ),
    retryReadOnJwtClockSkew(() =>
      admin().rpc("khpos_get_school_operating_benchmark_server", {
        p_actor_user_id: userId,
        p_organisation_id: organisationId,
      }),
    ),
  ]);

  if (
    diagnosticResult.error ||
    !isObject(diagnosticResult.data) ||
    operatingResult.error ||
    !isObject(operatingResult.data)
  ) {
    const message =
      diagnosticResult.error?.message ??
      operatingResult.error?.message ??
      "Benchmark Intelligence could not be loaded.";
    throw new KhposBenchmarkingError(
      message,
      message.includes("membership") ? 403 : 500,
    );
  }

  return {
    ...(diagnosticResult.data as unknown as Omit<
      KhposBenchmarkWorkspace,
      "operating"
    >),
    operating: operatingResult.data as unknown as KhposOperatingBenchmark,
  };
}

async function getPortfolioObservability(
  institutions: PortfolioInstitution[],
): Promise<KhposPortfolioObservability> {
  const client = admin();
  const generatedAt = new Date().toISOString();
  const now = new Date();
  const nowIso = now.toISOString();
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 86_400_000,
  ).toISOString();
  const fortyEightHoursAgo = new Date(
    now.getTime() - 48 * 3_600_000,
  ).toISOString();

  const organisationIds = institutions.map((item) => item.organisationId);
  const names = new Map(
    institutions.map((item) => [item.organisationId, item.name]),
  );

  const { data: release, error: releaseError } = await client
    .from("khpos_standard_releases")
    .select("id,code,version,name")
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (releaseError) {
    throw new KhposBenchmarkingError(
      "Portfolio standard release health could not be loaded.",
      500,
    );
  }

  if (!organisationIds.length) {
    return {
      generatedAt,
      release: release
        ? {
            id: String(release.id),
            code: String(release.code),
            version: Number(release.version),
            name: String(release.name),
          }
        : null,
      summary: {
        eligibleInstitutions: 0,
        currentStandard: 0,
        pendingAdoption: 0,
        missingInstallation: 0,
        failedTriggers7d: 0,
        overdueWork: 0,
        staleVerification: 0,
        p0Unmapped: 0,
        pausedRoutines: 0,
        activeRoutines: 0,
      },
      institutions: [],
    };
  }

  const [
    installationsResult,
    failedTriggersResult,
    openWorkResult,
    recurringResult,
    p0ProcessesResult,
  ] = await Promise.all([
    release
      ? client
          .from("khpos_standard_installations")
          .select("organisation_id,status,release_id")
          .in("organisation_id", organisationIds)
          .eq("release_id", release.id)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("khpos_ops_trigger_events")
      .select("organisation_id,id")
      .in("organisation_id", organisationIds)
      .eq("status", "failed")
      .gte("occurred_at", sevenDaysAgo)
      .limit(10000),
    client
      .from("khpos_ops_work_items")
      .select(
        "organisation_id,id,status,due_at,submitted_for_verification_at",
      )
      .in("organisation_id", organisationIds)
      .neq("status", "cancelled")
      .neq("status", "completed")
      .limit(10000),
    client
      .from("khpos_ops_recurring_rules")
      .select("organisation_id,id,status")
      .in("organisation_id", organisationIds)
      .in("status", ["active", "paused"])
      .limit(10000),
    client
      .from("khpos_ops_processes")
      .select("id,organisation_id")
      .in("organisation_id", organisationIds)
      .eq("criticality", "P0")
      .neq("status", "retired")
      .limit(10000),
  ]);

  const firstError = [
    installationsResult.error,
    failedTriggersResult.error,
    openWorkResult.error,
    recurringResult.error,
    p0ProcessesResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new KhposBenchmarkingError(
      firstError?.message ?? "Portfolio observability could not be loaded.",
      500,
    );
  }

  const p0Processes = p0ProcessesResult.data ?? [];
  const p0Ids = p0Processes.map((item) => item.id);

  const [activeP0VersionsResult, p0ProfilesResult] = await Promise.all([
    p0Ids.length
      ? client
          .from("khpos_ops_process_versions")
          .select("process_id")
          .in("process_id", p0Ids)
          .eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    p0Ids.length
      ? client
          .from("khpos_ops_process_execution_profiles")
          .select("process_id,status")
          .in("process_id", p0Ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (activeP0VersionsResult.error || p0ProfilesResult.error) {
    throw new KhposBenchmarkingError(
      activeP0VersionsResult.error?.message ??
        p0ProfilesResult.error?.message ??
        "Critical process observability could not be loaded.",
      500,
    );
  }

  const activeP0 = new Set(
    (activeP0VersionsResult.data ?? []).map((item) => item.process_id),
  );
  const p0ProfileByProcess = new Map(
    (p0ProfilesResult.data ?? []).map((item) => [
      item.process_id,
      item.status,
    ]),
  );

  const currentInstallation = new Set<string>();
  const pendingInstallation = new Set<string>();

  for (const item of installationsResult.data ?? []) {
    if (item.status === "active") currentInstallation.add(item.organisation_id);
    if (item.status === "pending_adoption") {
      pendingInstallation.add(item.organisation_id);
    }
  }

  function countByOrganisation(
    rows: Array<{ organisation_id: string }>,
  ) {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(
        row.organisation_id,
        (map.get(row.organisation_id) ?? 0) + 1,
      );
    }
    return map;
  }

  const failedByOrg = countByOrganisation(
    (failedTriggersResult.data ?? []) as Array<{ organisation_id: string }>,
  );
  const pausedByOrg = countByOrganisation(
    (recurringResult.data ?? []).filter((item) => item.status === "paused"),
  );
  const activeByOrg = countByOrganisation(
    (recurringResult.data ?? []).filter((item) => item.status === "active"),
  );

  const overdueByOrg = new Map<string, number>();
  const staleVerificationByOrg = new Map<string, number>();
  for (const item of openWorkResult.data ?? []) {
    if (item.due_at && item.due_at < nowIso) {
      overdueByOrg.set(
        item.organisation_id,
        (overdueByOrg.get(item.organisation_id) ?? 0) + 1,
      );
    }
    if (
      item.status === "awaiting_verification" &&
      item.submitted_for_verification_at &&
      item.submitted_for_verification_at < fortyEightHoursAgo
    ) {
      staleVerificationByOrg.set(
        item.organisation_id,
        (staleVerificationByOrg.get(item.organisation_id) ?? 0) + 1,
      );
    }
  }

  const p0UnmappedByOrg = new Map<string, number>();
  for (const process of p0Processes) {
    if (!activeP0.has(process.id)) continue;
    if (p0ProfileByProcess.get(process.id) === "configured") continue;
    p0UnmappedByOrg.set(
      process.organisation_id,
      (p0UnmappedByOrg.get(process.organisation_id) ?? 0) + 1,
    );
  }

  const observabilityInstitutions =
    organisationIds.map((organisationId) => {
      const standardStatus: KhposPortfolioObservabilityInstitution["standardStatus"] =
        currentInstallation.has(organisationId)
          ? "current"
          : pendingInstallation.has(organisationId)
            ? "pending_adoption"
            : "missing";

      const failedTriggers7d = failedByOrg.get(organisationId) ?? 0;
      const overdueWork = overdueByOrg.get(organisationId) ?? 0;
      const staleVerification =
        staleVerificationByOrg.get(organisationId) ?? 0;
      const p0Unmapped = p0UnmappedByOrg.get(organisationId) ?? 0;
      const pausedRoutines = pausedByOrg.get(organisationId) ?? 0;
      const activeRoutines = activeByOrg.get(organisationId) ?? 0;

      const attention: KhposPortfolioObservabilityInstitution["attention"] =
        standardStatus === "missing" ||
        failedTriggers7d > 0 ||
        p0Unmapped > 0
          ? "critical"
          : standardStatus === "pending_adoption" ||
              overdueWork > 0 ||
              staleVerification > 0
            ? "high"
            : "standard";

      return {
        organisationId,
        name: names.get(organisationId) ?? "Participating institution",
        standardStatus,
        failedTriggers7d,
        overdueWork,
        staleVerification,
        p0Unmapped,
        pausedRoutines,
        activeRoutines,
        attention,
      };
    }).sort((a, b) => {
      const rank = { critical: 0, high: 1, standard: 2 };
      return (
        rank[a.attention] - rank[b.attention] ||
        b.failedTriggers7d - a.failedTriggers7d ||
        b.p0Unmapped - a.p0Unmapped ||
        b.overdueWork - a.overdueWork ||
        a.name.localeCompare(b.name)
      );
    });

  return {
    generatedAt,
    release: release
      ? {
          id: String(release.id),
          code: String(release.code),
          version: Number(release.version),
          name: String(release.name),
        }
      : null,
    summary: {
      eligibleInstitutions: organisationIds.length,
      currentStandard: observabilityInstitutions.filter(
        (item) => item.standardStatus === "current",
      ).length,
      pendingAdoption: observabilityInstitutions.filter(
        (item) => item.standardStatus === "pending_adoption",
      ).length,
      missingInstallation: observabilityInstitutions.filter(
        (item) => item.standardStatus === "missing",
      ).length,
      failedTriggers7d: observabilityInstitutions.reduce(
        (sum, item) => sum + item.failedTriggers7d,
        0,
      ),
      overdueWork: observabilityInstitutions.reduce(
        (sum, item) => sum + item.overdueWork,
        0,
      ),
      staleVerification: observabilityInstitutions.reduce(
        (sum, item) => sum + item.staleVerification,
        0,
      ),
      p0Unmapped: observabilityInstitutions.reduce(
        (sum, item) => sum + item.p0Unmapped,
        0,
      ),
      pausedRoutines: observabilityInstitutions.reduce(
        (sum, item) => sum + item.pausedRoutines,
        0,
      ),
      activeRoutines: observabilityInstitutions.reduce(
        (sum, item) => sum + item.activeRoutines,
        0,
      ),
    },
    institutions: observabilityInstitutions,
  };
}

export async function getKhposPortfolioIntelligence(
  userId: string,
): Promise<KhposPortfolioIntelligence> {
  const { data, error } = await retryReadOnJwtClockSkew(() =>
    admin().rpc("khpos_get_portfolio_intelligence_server", {
      p_actor_user_id: userId,
    }),
  );
  if (error || !isObject(data)) {
    throw new KhposBenchmarkingError(
      error?.message ?? "Portfolio Intelligence could not be loaded.",
      error?.message?.includes("Platform Administrator") ? 403 : 500,
    );
  }

  const base = data as unknown as Omit<
    KhposPortfolioIntelligence,
    "observability"
  >;
  const observability = await getPortfolioObservability(
    base.institutions ?? [],
  );

  return {
    ...base,
    observability,
  };
}
