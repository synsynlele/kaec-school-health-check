import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export type ReportField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "boolean" | "select" | "url";
  required: boolean;
  options?: string[];
};
export type ReportType = {
  id: string;
  title: string;
  scopeLabel: string;
  instructions: string;
  campus_id: string | null;
  unit_id: string | null;
  audience_mode: "all_role" | "selected";
  audience_assignment_ids?: string[];
  owner_role_id: string;
  reviewer_role_id: string;
  cadence: string;
  interval_days: number;
  start_date: string;
  end_date: string | null;
  due_days: number;
  due_time: string;
  fields: ReportField[];
  version: number;
  status: "active" | "paused" | "archived";
  canManage: boolean;
  stats: {
    open: number;
    overdue: number;
    submitted: number;
    accepted: number;
    withdrawn: number;
  } | null;
  assignments: { id: string; title: string }[];
};
export type SchoolReport = {
  id: string;
  type_id: string;
  occurrence_key: string;
  owner_assignment_id: string;
  title: string;
  instructions: string;
  fields: ReportField[];
  type_version: number;
  period_start: string;
  period_end: string;
  due_at: string;
  payload: Record<string, unknown>;
  status: "draft" | "submitted" | "returned" | "accepted" | "withdrawn";
  revision: number;
  lock_version: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  isMine: boolean;
  canEdit: boolean;
  canReview: boolean;
  reviewerAvailable: boolean;
  overdue: boolean;
  ownerName: string;
  reviewerTitle: string;
  campusName: string | null;
};
export type ReportsWorkspace = {
  items: SchoolReport[];
  total: number;
  summary: { open: number; overdue: number; review: number };
  types: ReportType[];
  scopes: { campusId: string | null; unitId: string | null; label: string }[];
  roles: { id: string; title: string }[];
  recipients: {id:string;roleId:string;campusId:string|null;unitId:string|null;label:string}[];
  history: {
    id: string;
    action: string;
    revision: number;
    note: string | null;
    at: string;
    payload: Record<string, unknown> | null;
  }[];
};
let client: SupabaseClient | null = null;
function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("School reporting is not configured.");
  return (client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}
export async function getReports(
  actor: string,
  school: string,
  options: {
    view?: "mine" | "review";
    query?: string;
    status?: string;
    offset?: number;
    report?: string | null;
    type?: string;
    from?: string;
    to?: string;
  } = {},
): Promise<ReportsWorkspace> {
  const { data, error } = await service().rpc(
    "khpos_reports_workspace_server",
    {
      p_actor: actor,
      p_school: school,
      p_query: options.query || "",
      p_status: (options.view === "review" ? "reviewer:" : "mine:") + (options.status || ""),
      p_offset: options.offset || 0,
      p_report: options.report || null,
      p_type: options.type || null,
      p_from: options.from || null,
      p_to: options.to || null,
    },
  );
  if (error) throw new Error(error.message);
  return data as ReportsWorkspace;
}
export async function reportAction(
  actor: string,
  school: string,
  mode: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await service().rpc("khpos_report_action_server", {
    p_actor: actor,
    p_school: school,
    p_mode: mode,
    p_input: input,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
export async function getReportAttention(
  school: string,
  actor: string,
): Promise<{
  summary: ReportsWorkspace["summary"];
  items: Pick<
    SchoolReport,
    | "id"
    | "status"
    | "lock_version"
    | "due_at"
    | "submitted_at"
    | "canEdit"
    | "canReview"
    | "overdue"
  >[];
}> {
  const { data, error } = await service().rpc("khpos_report_attention_server", {
    p_actor: actor,
    p_school: school,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function getReportAlerts(school: string, actor: string) {
  const { items } = await getReportAttention(school, actor);
  return items
    .filter(
      (n) =>
        (n.canEdit && ["draft", "returned"].includes(n.status)) ||
        (n.canReview && n.status === "submitted"),
    )
    .map((n) => ({
      id: `report:${n.id}:${n.status}:v${n.lock_version}`,
      title:
        n.canReview && n.status === "submitted"
          ? "Report awaiting review"
          : n.status === "returned"
            ? "Report returned for correction"
            : n.overdue
              ? "Report overdue"
              : "Report due soon",
      detail: "Open School Reports to view your assigned reporting action.",
      href: `/khpos/${school}/reports?report=${n.id}`,
      dueAt: n.status === "submitted" ? n.submitted_at || n.due_at : n.due_at,
      urgent: false,
      level: "action" as const,
      category: "school_report",
    }));
}
