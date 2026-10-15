import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
let client: SupabaseClient | null = null;

export interface KhposPresencePeriod {
  id: string; streamId: string; weekday: number; start: string; end: string; room: string | null;
  campusId: string; class: string; subject: string; teacher: string;
  teacherUserId: string; termActive: boolean;
  session: null | { id: string; in: string; out: string | null; outcome: string | null; topic: string | null; administrativelyClosed: boolean };
}
export interface KhposHqlsDomain {
  code: string; score: number; evidence: string; automaticFailure: boolean;
}
export interface KhposHqlsObservation {
  id: string; streamId: string; teacherUserId: string; mode: "full" | "walk";
  domains: KhposHqlsDomain[]; total: number | null; band: "model" | "developing" | "violation" | null;
  automaticFailure: boolean; strengths: string; improvement: string | null;
  coaching: string | null; due: string | null; coachingWorkId: string | null;
  teacherResponse: string | null; acknowledgedAt: string | null; observedAt: string;
}
export interface KhposPresenceWorkspace {
  localDay: string; userId: string; canManage: boolean; canEnablePilot: boolean; pilotEnabled: boolean; canEnableHqls: boolean; hqlsEnabled: boolean; staff: null | { id: string; name: string; campusId: string | null };
  campuses: Array<{ id: string; name: string }>;
  todayPresence: null | { id: string; campusId: string; in: string; out: string | null; administrativelyClosed: boolean };
  periods: KhposPresencePeriod[]; observations: KhposHqlsObservation[];
  teamPresence: Array<{ name: string; campusId: string; in: string; out: string | null; administrativelyClosed: boolean }>;
  openClassSessions: Array<{ id: string; date: string; class: string; subject: string; teacher: string; in: string }>;
  openSchoolAttendance: Array<{ id: string; date: string; teacher: string; campusId: string; in: string }>;
}
export interface KhposPresenceHistory {
  from: string; to: string; page: number; pageSize: number;
  schoolTotal: number; classTotal: number;
  schoolRecords: Array<{ id:string; name:string; campusId:string; date:string; in:string; out:string|null; administrativelyClosed:boolean }>;
  classRecords: Array<{ id:string; date:string; teacher:string; class:string; subject:string; in:string; out:string|null; topic:string|null; outcome:string|null; administrativelyClosed:boolean }>;
}

export async function getPresenceHistory(org:string, actor:string, from:string, to:string, page:number):Promise<KhposPresenceHistory> {
  const {data,error}=await service().rpc("khpos_ops_presence_history_server",{
    p_actor:actor,p_org:org,p_from:from,p_to:to,p_page:page,p_page_size:50
  });
  if(error) fail(error.message);
  if(!data || typeof data!=="object" || Array.isArray(data)) fail("Attendance history could not be loaded.");
  return data as KhposPresenceHistory;
}

export class KhposPresenceError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
function service() {
  if (!url || !key) throw new KhposPresenceError("Teaching attendance is not configured.", 503);
  return client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function fail(message: string) {
  const status = /does not exist|could not find the function|not configured|schema cache/i.test(message)
    ? 503 : /only|membership|authorised|permitted|active staff|another school|independent observer/i.test(message)
      ? 403 : 400;
  throw new KhposPresenceError(message, status);
}
export async function getPresenceWorkspace(org: string, actor: string): Promise<KhposPresenceWorkspace> {
  const { data, error } = await service().rpc("khpos_ops_presence_workspace_server", { p_actor: actor, p_org: org });
  if (error) fail(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("Attendance could not be loaded.");
  return data as KhposPresenceWorkspace;
}
export async function actOnPresence(org: string, actor: string, mode: string, input: Record<string, unknown>) {
  const { error } = await service().rpc("khpos_ops_presence_action_server", {
    p_actor: actor, p_org: org, p_mode: mode, p_input: input
  });
  if (error) fail(error.message);
}
