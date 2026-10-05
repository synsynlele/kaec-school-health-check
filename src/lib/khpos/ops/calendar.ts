import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getKhposOpsDecisions } from "@/lib/khpos/ops/decisions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: SupabaseClient | null = null;

export type KhposCalendarKind =
  | "work"
  | "decision"
  | "event"
  | "policy_review"
  | "recurring";

export interface KhposCalendarItem {
  id: string;
  kind: KhposCalendarKind;
  title: string;
  detail: string;
  date: string;
  time: string | null;
  dueAt: string | null;
  href: string;
  priority: "critical" | "high" | "standard" | "planned";
  status: string;
  overdue: boolean;
}

export interface KhposCalendarSnapshot {
  organisation: { id: string; name: string };
  generatedAt: string;
  range: { start: string; end: string; days: number };
  institutionView: boolean;
  summary: {
    total: number;
    overdue: number;
    work: number;
    decisions: number;
    events: number;
    policyReviews: number;
    scheduledOperations: number;
  };
  items: KhposCalendarItem[];
}

export class KhposCalendarError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposCalendarError";
  }
}

function admin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposCalendarError("KHP-OS Calendar is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isodow(value: Date) {
  const day = value.getUTCDay();
  return day === 0 ? 7 : day;
}

function dateValid(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month, day));
  return (
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month &&
    value.getUTCDate() === day
  );
}

function priorityFromDecision(value: string) {
  if (value === "P1") return "critical" as const;
  if (value === "P2") return "high" as const;
  if (value === "P4") return "planned" as const;
  return "standard" as const;
}

function recurringDates(
  rule: {
    cadence: string;
    weekdays: number[] | null;
    weekday: number | null;
    day_of_month: number | null;
    start_date: string;
    end_date: string | null;
  },
  start: Date,
  end: Date,
) {
  const dates: string[] = [];
  const ruleStart = new Date(rule.start_date + "T00:00:00Z");
  const ruleEnd = rule.end_date
    ? new Date(rule.end_date + "T23:59:59Z")
    : end;
  const cursor = new Date(
    Math.max(start.getTime(), ruleStart.getTime()),
  );
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= end && cursor <= ruleEnd && dates.length < 32) {
    let include = false;
    if (rule.cadence === "daily") {
      include =
        !rule.weekdays?.length || rule.weekdays.includes(isodow(cursor));
    } else if (rule.cadence === "weekly") {
      include = rule.weekday === isodow(cursor);
    } else if (rule.cadence === "monthly" && rule.day_of_month) {
      include =
        cursor.getUTCDate() === rule.day_of_month &&
        dateValid(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          rule.day_of_month,
        );
    }

    if (include) dates.push(dateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function getKhposCalendar(
  organisationId: string,
  userId: string,
  days = 60,
): Promise<KhposCalendarSnapshot> {
  const client = admin();
  const safeDays = Math.min(120, Math.max(14, days));
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 7);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + safeDays);
  end.setUTCHours(23, 59, 59, 999);

  const { data: membership, error: membershipError } = await client
    .from("organisation_memberships")
    .select("organisations!inner(id,name,status,partner_status,partner_entitlements)")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new KhposCalendarError(
      membershipError?.message ?? "Active school membership is required.",
      403,
    );
  }

  const organisation = Array.isArray(membership.organisations)
    ? membership.organisations[0]
    : membership.organisations;
  if (
    !organisation ||
    organisation.status !== "active" ||
    organisation.partner_status !== "active" ||
    !Array.isArray(organisation.partner_entitlements) ||
    !organisation.partner_entitlements.includes("khpos_core")
  ) {
    throw new KhposCalendarError(
      "An active KHP-OS school partnership is required.",
      403,
    );
  }

  const { data: assignments, error: assignmentsError } = await client
    .from("khpos_ops_role_assignments")
    .select("id,role_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (assignmentsError) throw new KhposCalendarError(assignmentsError.message, 500);

  const roleIds = (assignments ?? []).map((item) => item.role_id);
  const { data: roles, error: rolesError } = roleIds.length
    ? await client
        .from("khpos_ops_roles")
        .select("id,code")
        .eq("organisation_id", organisationId)
        .eq("status", "active")
        .in("id", roleIds)
    : { data: [], error: null };

  if (rolesError) throw new KhposCalendarError(rolesError.message, 500);

  const leaderCodes = new Set([
    "VISION_CUSTODIAN",
    "SCHOOL_CUSTODIAN",
    "SCHOOL_GUARDIAN",
    "ACADEMIC_INSPECTOR",
    "SKILL_INSPECTOR",
    "SECTIONAL_PROMOTER",
  ]);
  const institutionView = (roles ?? []).some((role) => leaderCodes.has(role.code));
  const assignmentIds = (assignments ?? []).map((item) => item.id);

  let workQuery = client
    .from("khpos_ops_work_items")
    .select("id,title,status,priority,due_at")
    .eq("organisation_id", organisationId)
    .neq("status", "cancelled")
    .not("due_at", "is", null)
    .gte("due_at", start.toISOString())
    .lte("due_at", end.toISOString())
    .order("due_at");

  if (!institutionView) {
    if (!assignmentIds.length) {
      workQuery = workQuery.in("owner_assignment_id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      workQuery = workQuery.in("owner_assignment_id", assignmentIds);
    }
  }

  let recurringQuery = client
    .from("khpos_ops_recurring_rules")
    .select(
      "id,code,title,description,cadence,weekdays,weekday,day_of_month,due_time,timezone,start_date,end_date,priority,owner_role_id",
    )
    .eq("organisation_id", organisationId)
    .eq("status", "active");

  if (!institutionView) {
    recurringQuery = roleIds.length
      ? recurringQuery.in("owner_role_id", roleIds)
      : recurringQuery.in("owner_role_id", ["00000000-0000-0000-0000-000000000000"]);
  }

  const [
    workResult,
    recurringResult,
    eventResult,
    policyResult,
    decisions,
  ] = await Promise.all([
    workQuery,
    recurringQuery,
    client
      .from("khpos_ops_events")
      .select("id,title,purpose,event_date,status")
      .eq("organisation_id", organisationId)
      .gte("event_date", dateOnly(start))
      .lte("event_date", dateOnly(end))
      .not("status", "eq", "cancelled")
      .order("event_date"),
    institutionView
      ? client
          .from("khpos_ops_policy_versions")
          .select("id,policy_id,review_date,khpos_ops_policies!inner(code,name,organisation_id)")
          .eq("status", "active")
          .not("review_date", "is", null)
          .gte("review_date", dateOnly(start))
          .lte("review_date", dateOnly(end))
          .eq("khpos_ops_policies.organisation_id", organisationId)
      : Promise.resolve({ data: [], error: null }),
    getKhposOpsDecisions(organisationId, userId),
  ]);

  const firstError = [
    workResult.error,
    recurringResult.error,
    eventResult.error,
    policyResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new KhposCalendarError(
      firstError?.message ?? "Institutional calendar could not be loaded.",
      500,
    );
  }

  const items: KhposCalendarItem[] = [];
  const nowMs = now.getTime();

  for (const work of workResult.data ?? []) {
    const due = work.due_at ? Date.parse(work.due_at) : Number.NaN;
    items.push({
      id: "work:" + work.id,
      kind: "work",
      title: work.title,
      detail: "Operational work · " + work.status.replaceAll("_", " "),
      date: work.due_at.slice(0, 10),
      time: work.due_at.slice(11, 16),
      dueAt: work.due_at,
      href: "/khpos/" + organisationId + "/work",
      priority: work.priority,
      status: work.status,
      overdue: Number.isFinite(due) && due < nowMs && work.status !== "completed",
    });
  }

  for (const decision of decisions.items) {
    const implementation =
      decision.actionRequired &&
      decision.status === "approved" &&
      decision.isImplementationOwner;
    const review =
      decision.isAuthority &&
      ["submitted", "under_review"].includes(decision.status);
    if (!implementation && !review) continue;
    const dueAt = implementation
      ? decision.implementationDueAt
      : decision.decisionDueAt;
    if (!dueAt) continue;
    const due = Date.parse(dueAt);
    if (due < start.getTime() || due > end.getTime()) continue;

    items.push({
      id: "decision:" + decision.id,
      kind: "decision",
      title: decision.title,
      detail: implementation
        ? "Decision implementation due"
        : "Decision authority deadline",
      date: dueAt.slice(0, 10),
      time: dueAt.slice(11, 16),
      dueAt,
      href: "/khpos/" + organisationId + "/decisions",
      priority: priorityFromDecision(decision.priority),
      status: decision.status,
      overdue: due < nowMs,
    });
  }

  for (const event of eventResult.data ?? []) {
    items.push({
      id: "event:" + event.id,
      kind: "event",
      title: event.title,
      detail: event.purpose || "School event / programme",
      date: event.event_date,
      time: null,
      dueAt: null,
      href: "/khpos/" + organisationId + "/events",
      priority: "standard",
      status: event.status,
      overdue: false,
    });
  }

  for (const row of policyResult.data ?? []) {
    const policy = Array.isArray(row.khpos_ops_policies)
      ? row.khpos_ops_policies[0]
      : row.khpos_ops_policies;
    items.push({
      id: "policy:" + row.id,
      kind: "policy_review",
      title: policy ? policy.code + " · " + policy.name : "Policy review",
      detail: "Controlled policy review due",
      date: row.review_date,
      time: null,
      dueAt: row.review_date + "T23:59:59",
      href: "/khpos/" + organisationId + "/library?tab=policies",
      priority: "high",
      status: "review_due",
      overdue: Date.parse(row.review_date + "T23:59:59") < nowMs,
    });
  }

  const futureStart = new Date(now);
  futureStart.setUTCDate(futureStart.getUTCDate() + 1);
  futureStart.setUTCHours(0, 0, 0, 0);
  for (const rule of recurringResult.data ?? []) {
    if (rule.cadence === "manual") continue;
    for (const date of recurringDates(rule, futureStart, end)) {
      items.push({
        id: "recurring:" + rule.id + ":" + date,
        kind: "recurring",
        title: rule.title,
        detail:
          rule.code +
          " · scheduled " +
          rule.cadence +
          " operation · " +
          (rule.timezone || "school time"),
        date,
        time: rule.due_time ? String(rule.due_time).slice(0, 5) : null,
        dueAt: null,
        href: "/khpos/" + organisationId + "/work",
        priority: rule.priority,
        status: "scheduled",
        overdue: false,
      });
    }
  }

  items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
      a.title.localeCompare(b.title),
  );

  return {
    organisation: { id: organisationId, name: organisation.name },
    generatedAt: now.toISOString(),
    range: { start: dateOnly(start), end: dateOnly(end), days: safeDays },
    institutionView,
    summary: {
      total: items.length,
      overdue: items.filter((item) => item.overdue).length,
      work: items.filter((item) => item.kind === "work").length,
      decisions: items.filter((item) => item.kind === "decision").length,
      events: items.filter((item) => item.kind === "event").length,
      policyReviews: items.filter((item) => item.kind === "policy_review").length,
      scheduledOperations: items.filter((item) => item.kind === "recurring").length,
    },
    items,
  };
}
