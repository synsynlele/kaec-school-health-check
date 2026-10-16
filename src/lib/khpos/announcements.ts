import {createClient, type SupabaseClient} from "@supabase/supabase-js";
export type Announcement = {
 id: string; school_id: string | null; all_schools: boolean; school_ids: string[]; campus_id: string | null; unit_id: string | null; role_codes: string[];
 title: string; message: string; document_url: string | null; task_url: string | null; priority: "normal" | "important" | "urgent";
 requires_ack: boolean; status: "draft" | "published" | "withdrawn"; revision: number; publish_at: string; expires_at: string; publisher_name: string;
 phase: "draft" | "withdrawn" | "scheduled" | "expired" | "active"; canRespond: boolean; canManage: boolean; readAt: string | null; acknowledgedAt: string | null; available: boolean; audienceLabel: string;
};
export type AnnouncementWorkspace = {scopes: {campusId: string | null; unitId: string | null; label: string}[]; schools: {id: string; name: string}[]; roles: {code: string; title: string}[]; items: Announcement[]};
export type AnnouncementTracking = {revision: number; total: number; read: number; acknowledged: number; recipients: {userId: string; schoolId: string; name: string; school: string; readAt: string | null; acknowledgedAt: string | null}[]; history: {revision: number; note: string; at: string}[]};
let client: SupabaseClient | null = null;
function service() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) throw new Error("Announcements are not configured.");
 return client ??= createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function getAnnouncements(actor: string, school: string | null): Promise<AnnouncementWorkspace> {
 const {data,error}=await service().rpc("khpos_get_announcements_server",{p_actor:actor,p_school:school});
 if(error) throw new Error(error.message);
 return data as AnnouncementWorkspace;
}
export async function announcementAction(actor: string, school: string | null, mode: string, input: Record<string,unknown>) {
 const {data,error}=await service().rpc("khpos_announcement_action_server",{p_actor:actor,p_school:school,p_mode:mode,p_input:input});
 if(error) throw new Error(error.message);
 return data as string;
}
export async function getAnnouncementTracking(actor: string, notice: string, offset: number): Promise<AnnouncementTracking> {
 const {data,error}=await service().rpc("khpos_announcement_tracking_server",{p_actor:actor,p_notice:notice,p_offset:offset});
 if(error) throw new Error(error.message);
 return data as AnnouncementTracking;
}
export async function getAnnouncementAlerts(school: string, actor: string) {
 const workspace=await getAnnouncements(actor,school);
 return workspace.items.filter(n=>n.canRespond && n.available && n.priority!=="normal" && (n.requires_ack ? !n.acknowledgedAt : !n.readAt)).map(n=>({
  id:`announcement:${n.id}:r${n.revision}`, title:n.title,detail:n.requires_ack ? "A staff announcement needs your acknowledgement." : "A new staff announcement is available.",
  href:`/khpos/${school}/announcements?notice=${n.id}`,dueAt:n.expires_at, urgent:n.priority==="urgent",level:n.priority==="urgent" ? "urgent" as const : "action" as const,category:"announcement"
 }));
}
