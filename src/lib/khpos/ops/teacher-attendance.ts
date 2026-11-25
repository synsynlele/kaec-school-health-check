import { createClient } from "@supabase/supabase-js";
import type { KhposAlert } from "@/lib/khpos/notifications";

export async function teacherAttendance(actor: string, school: string, action: string, input: object = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Teacher attendance is unavailable.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return db.rpc("khpos_teacher_attendance_server", { actor, school, action, input });
}

export async function teacherAttendanceAlerts(school: string, actor: string, day: string): Promise<KhposAlert[]> {
  const { data, error } = await teacherAttendance(actor, school, "alerts");
  if (error) throw new Error("Teacher attendance alerts could not be loaded.");
  const campuses = data as { id: string; name: string; teachers: { id: string; due: string; status: string }[] }[];
  return campuses.flatMap(campus => campus.teachers.map(teacher => ({
    id: `teacher-attendance:${campus.id}:${teacher.id}:${day}:${teacher.status}`,
    title: teacher.status === "absent" ? "Teacher absence confirmed" : "Expected teacher has not signed in",
    detail: campus.name + " · Open attendance to review",
    href: `/khpos/${school}/teaching-presence?tab=leaders#teacher-attendance`,
    dueAt: teacher.due,
    urgent: false,
    level: "action" as const,
    category: "teacher_attendance",
  })));
}
