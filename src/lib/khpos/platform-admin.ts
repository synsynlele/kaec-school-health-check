import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getKhposPortfolioIntelligence,
  type KhposPortfolioIntelligence,
} from "@/lib/khpos/benchmarking";
import type {
  KhposAuthenticatorAssuranceLevel,
  VerifiedKhposUser,
} from "@/lib/khpos/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export type KhposPlatformRole =
  | "super_admin"
  | "portfolio_admin"
  | "support_reviewer";

export interface KhposPlatformAdminEntry {
  userId: string;
  email: string;
  role: KhposPlatformRole;
  status: "active" | "suspended";
  mfaEnrolled: boolean;
  grantedAt: string | null;
  lastReviewedAt: string | null;
}

export interface KhposPlatformEvent {
  id: string;
  eventType: string;
  actorEmail: string | null;
  targetEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface KhposAdminConsoleSnapshot {
  generatedAt: string;
  admin: {
    userId: string;
    email: string;
    role: KhposPlatformRole;
    status: "active";
    mfaEnrolled: boolean;
    canManageAdmins: boolean;
  };
  session: {
    aal: KhposAuthenticatorAssuranceLevel;
    provider: string | null;
    governanceChangesUnlocked: boolean;
  };
  summary: {
    activeInstitutions: number;
    institutionsWithBaseline: number;
    institutionsWithReassessment: number;
    verifiedImprovementInstitutions: number;
    activePriorities: number;
    criticalPriorities: number;
    reviewsAwaitingDecision: number;
    reviewsDue: number;
    evidenceNeedsAttention: number;
    reassessmentsInProgress: number;
    integrationsActive: number;
    integrationsNeedAttention: number;
    activePlatformAdmins: number;
    mfaEnrolledPlatformAdmins: number;
  };
  governance: {
    platformRolesVersion: string;
    namedPortfolioPrivate: boolean;
    schoolMembershipSeparate: boolean;
    adminChangesRequireMfaAal2: boolean;
    publicRankingEnabled: boolean;
  };
  admins: KhposPlatformAdminEntry[];
  recentEvents: KhposPlatformEvent[];
}

export interface KhposAdminDashboard {
  console: KhposAdminConsoleSnapshot;
  portfolio: KhposPortfolioIntelligence;
}

export class KhposPlatformAdminError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposPlatformAdminError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposPlatformAdminError("Platform Administration is not configured.", 503);
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

async function getConsole(user: VerifiedKhposUser): Promise<KhposAdminConsoleSnapshot> {
  const { data, error } = await admin().rpc("khpos_get_admin_console_server", {
    p_actor_user_id: user.id,
  });
  if (error || !isObject(data)) {
    throw new KhposPlatformAdminError(
      error?.message ?? "Admin Console could not be loaded.",
      error?.message?.includes("Platform Administrator") ? 403 : 500,
    );
  }

  const base = data as unknown as Omit<KhposAdminConsoleSnapshot, "session">;
  return {
    ...base,
    session: {
      aal: user.aal,
      provider: user.provider,
      governanceChangesUnlocked:
        base.admin.canManageAdmins && user.aal === "aal2",
    },
  };
}

export async function getKhposAdminDashboard(
  user: VerifiedKhposUser,
): Promise<KhposAdminDashboard> {
  const [console, portfolio] = await Promise.all([
    getConsole(user),
    getKhposPortfolioIntelligence(user.id),
  ]);
  return { console, portfolio };
}

export async function manageKhposPlatformAdmin(
  user: VerifiedKhposUser,
  input: {
    targetEmail: string;
    action: "grant" | "reactivate" | "suspend";
    role: KhposPlatformRole;
    reason: string;
  },
): Promise<KhposAdminDashboard> {
  if (user.aal !== "aal2") {
    throw new KhposPlatformAdminError(
      "Verify your administrator MFA before changing platform access.",
      403,
    );
  }

  const { error } = await admin().rpc("khpos_manage_platform_admin_server", {
    p_actor_user_id: user.id,
    p_target_email: input.targetEmail.trim().toLowerCase(),
    p_action: input.action,
    p_platform_role: input.role,
    p_reason: input.reason.trim(),
  });
  if (error) {
    throw new KhposPlatformAdminError(error.message, 400);
  }
  return getKhposAdminDashboard(user);
}
