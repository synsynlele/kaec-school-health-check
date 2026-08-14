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
  privacy: {
    learnerDataIncluded: false;
    evidenceContentIncluded: false;
    publicRankingEnabled: false;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function getKhposBenchmarkWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposBenchmarkWorkspace> {
  const { data, error } = await admin().rpc("khpos_get_school_benchmark_server", {
    p_actor_user_id: userId,
    p_organisation_id: organisationId,
  });
  if (error || !isObject(data)) {
    throw new KhposBenchmarkingError(
      error?.message ?? "Benchmark Intelligence could not be loaded.",
      error?.message?.includes("membership") ? 403 : 500,
    );
  }
  return data as unknown as KhposBenchmarkWorkspace;
}

export async function getKhposPortfolioIntelligence(
  userId: string,
): Promise<KhposPortfolioIntelligence> {
  const { data, error } = await admin().rpc(
    "khpos_get_portfolio_intelligence_server",
    { p_actor_user_id: userId },
  );
  if (error || !isObject(data)) {
    throw new KhposBenchmarkingError(
      error?.message ?? "Portfolio Intelligence could not be loaded.",
      error?.message?.includes("Platform Administrator") ? 403 : 500,
    );
  }
  return data as unknown as KhposPortfolioIntelligence;
}
