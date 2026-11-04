import { createClient } from "@supabase/supabase-js";

export type Meeting = { id: string; title: string; agenda: string; starts_at: string; ends_at: string; call_url: string | null; status: "scheduled" | "live" | "closed" | "cancelled"; created_by: string; call_parts: string[]; active_call_part: number; call_part_started_at: string | null };
export type MeetingPerson = { id: string; name: string; email: string; isHq: boolean; schools: { id: string; name: string; personName: string }[] };
export type MeetingWorkspace = {
  serverNow?: string; userId: string; canCreate: boolean; meetings: Meeting[];
  people: MeetingPerson[];
  room: null | { meeting: Meeting; participants: { user_id: string; name: string; email?: string; is_hq?: boolean }[];
    messages: { id: string; author_id: string; author_name: string; body: string; created_at: string }[];
    decisions: { id: string; body: string; created_at: string }[];
    actions: { id: string; title: string; due_at: string; work_item_id: string; status: string; owner_name: string }[] };
};

export async function meetingOperation(actor: string, org: string, mode: string, input: Record<string, unknown> = {}): Promise<MeetingWorkspace> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Meetings are not configured.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("khpos_meetings_server", { p_actor: actor, p_org: org === "hq" ? null : org, p_mode: mode, p_input: input });
  if (error) {
    if (error.code === "42501") throw Object.assign(new Error("You do not have access to this meeting."), { status: 403 });
    if (error.code === "22023") throw Object.assign(new Error(error.message), { status: 400 });
    console.error("[khpos] meeting operation failed", error.code);
    throw new Error("Meetings could not be loaded or saved. Try again.");
  }
  return data as MeetingWorkspace;
}

export async function getMeetingAlerts(org: string, actor: string, nowMs = Date.now()) {
  const [workspace, corporate] = await Promise.all([
    meetingOperation(actor, org, "list", { omitRoster: true }),
    org === "hq" ? Promise.resolve(null) : meetingOperation(actor, "hq", "list", { omitRoster: true }).catch(error => {
      if (error && typeof error === "object" && "status" in error && error.status === 403) return null;
      throw error;
    }),
  ]);
  const rooms = new Map<string, { meeting: Meeting; scope: string }>();
  for (const meeting of workspace.meetings) rooms.set(meeting.id, { meeting, scope: org });
  for (const meeting of corporate?.meetings ?? []) if (!rooms.has(meeting.id)) rooms.set(meeting.id, { meeting, scope: "hq" });
  return Array.from(rooms.values()).filter(({meeting:m}) => m.status === "live" || (m.status === "scheduled" && Date.parse(m.ends_at) >= nowMs && Date.parse(m.starts_at) <= nowMs + 7 * 86400000)).map(({meeting:m,scope}) => ({
    id: `meeting:${m.id}`, live: m.status === "live", title: m.title, detail: `Private meeting · ${new Date(m.starts_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} (Lagos)`,
    href: `/khpos/${scope}/meetings?meeting=${m.id}`, dueAt: m.starts_at, urgent: false, level: "action" as const, category: "meeting",
  }));
}
