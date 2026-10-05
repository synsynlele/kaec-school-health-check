import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { prepareKhposMeetingAgenda } from "@/lib/khpos/ops/meeting-agenda";
import { getKhposAttention } from "@/lib/khpos/ops/attention";
import { getKhposCalendar } from "@/lib/khpos/ops/calendar";
import { getKhposOpsPerformance } from "@/lib/khpos/ops/performance";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: SupabaseClient | null = null;

export interface KhposLeadershipBrief {
  organisation: { id: string; name: string };
  generatedAt: string;
  periodDays: 7;
  attention: Awaited<ReturnType<typeof getKhposAttention>>;
  derivedPerformance: Awaited<ReturnType<typeof getKhposOpsPerformance>>["derivedPerformance"];
  progress: {
    workCompleted: number;
    issuesResolved: number;
    decisionsImplemented: number;
    recordsSubmitted: number;
  };
  upcoming: Array<{
    id: string;
    date: string;
    time: string | null;
    title: string;
    detail: string;
    href: string;
    kind: string;
  }>;
  meetingQuestions: string[];
  meetingAgenda: ReturnType<typeof prepareKhposMeetingAgenda>;
}

export class KhposLeadershipBriefError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposLeadershipBriefError";
  }
}

function admin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposLeadershipBriefError(
      "KHP-OS leadership briefing is not configured.",
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

export async function getKhposLeadershipBrief(
  organisationId: string,
  userId: string,
): Promise<KhposLeadershipBrief> {
  const [attention, performance, calendar] = await Promise.all([
    getKhposAttention(organisationId, userId),
    getKhposOpsPerformance(organisationId, userId),
    getKhposCalendar(organisationId, userId, 30),
  ]);

  if (!performance.canGovernKpis) {
    throw new KhposLeadershipBriefError(
      "An active school leadership role is required to open the institutional leadership brief.",
      403,
    );
  }

  const client = admin();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [completedWork, resolvedIssues, implementedDecisions, submittedRecords] =
    await Promise.all([
      client
        .from("khpos_ops_work_items")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("status", "completed")
        .gte("completed_at", since),
      client
        .from("khpos_ops_issues")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .in("status", ["resolved", "verified", "closed"])
        .gte("resolved_at", since),
      client
        .from("khpos_ops_decisions")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .in("status", ["implemented", "closed"])
        .gte("implemented_at", since),
      client
        .from("khpos_ops_work_records")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .gte("submitted_at", since),
    ]);

  const firstError = [
    completedWork.error,
    resolvedIssues.error,
    implementedDecisions.error,
    submittedRecords.error,
  ].find(Boolean);

  if (firstError) {
    throw new KhposLeadershipBriefError(
      firstError?.message ?? "Leadership progress could not be calculated.",
      500,
    );
  }

  const derived = performance.derivedPerformance;
  const meetingQuestions: string[] = [];

  if (attention.summary.critical > 0) {
    meetingQuestions.push(
      "What must leadership decide or unblock today for the " +
        attention.summary.critical +
        " critical item" +
        (attention.summary.critical === 1 ? "" : "s") +
        "?",
    );
  }
  if (attention.summary.overdue > 0) {
    meetingQuestions.push(
      "Why are " +
        attention.summary.overdue +
        " responsibilities overdue, and what systemic cause must be removed rather than merely chased?",
    );
  }
  if (
    derived.executionCoverage.percent !== null &&
    derived.executionCoverage.percent < 100
  ) {
    meetingQuestions.push(
      "Which approved processes will receive explicit execution mapping before the next review?",
    );
  }
  if (
    derived.verificationFirstPass.percent !== null &&
    derived.verificationFirstPass.percent < 80
  ) {
    meetingQuestions.push(
      "Why is work being returned at verification, and which process, training or role clarity should change?",
    );
  }
  if (
    derived.decisionActionClosure.percent !== null &&
    derived.decisionActionClosure.percent < 80
  ) {
    meetingQuestions.push(
      "Which approved decisions are not becoming verified outcomes quickly enough?",
    );
  }
  if (!meetingQuestions.length) {
    meetingQuestions.push(
      "What improvement would create the greatest institutional leverage before the next leadership review?",
    );
  }

  const nowDate = new Date().toISOString().slice(0, 10);
  const upcoming = calendar.items
    .filter((item) => item.date >= nowDate)
    .slice(0, 12)
    .map((item) => ({
      id: item.id,
      date: item.date,
      time: item.time,
      title: item.title,
      detail: item.detail,
      href: item.href,
      kind: item.kind,
    }));

  return {
    organisation: performance.organisation,
    generatedAt: new Date().toISOString(),
    periodDays: 7,
    attention,
    derivedPerformance: derived,
    progress: {
      workCompleted: completedWork.count ?? 0,
      issuesResolved: resolvedIssues.count ?? 0,
      decisionsImplemented: implementedDecisions.count ?? 0,
      recordsSubmitted: submittedRecords.count ?? 0,
    },
    upcoming,
    meetingQuestions,
    meetingAgenda: prepareKhposMeetingAgenda(attention.items),
  };
}
