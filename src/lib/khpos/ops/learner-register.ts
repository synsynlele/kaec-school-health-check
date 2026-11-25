import { createClient } from "@supabase/supabase-js";
import type { KhposAlert } from "@/lib/khpos/notifications";

export async function learnerRegister(actor: string, school: string, action: string, input: object = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Learner register is unavailable.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (action === "history") return db.rpc("khpos_learner_register_history_server", { actor, school, input });
  return db.rpc("khpos_learner_register_server", { actor, school, action, input });
}

export async function learnerRegisterAlerts(school: string, actor: string, day: string): Promise<KhposAlert[]> {
  const { data, error } = await learnerRegister(actor, school, "alerts");
  if (error) return [];
  const summaries = data as { id: string; name: string; due: string | null; absent: number; unaccounted: number }[];
  return summaries.flatMap(({ id, name, due, absent, unaccounted }) => {
    const href = `/khpos/${school}/learner-register?campus=${id}`;
    const alerts: KhposAlert[] = [];
    if (unaccounted) alerts.push({
      id: `learner-unaccounted:${id}:${day}`,
      title: "Learners unaccounted for at closing",
      detail: `${name} · ${unaccounted} reported`,
      href: href + "&filter=unaccounted",
      dueAt: due,
      urgent: true,
      level: "urgent",
      category: "learner_attendance",
    });
    if (absent) alerts.push({
      id: `learner-absence:${id}:${day}`,
      title: "Review today’s learner absences",
      detail: `${name} · ${absent} marked absent`,
      href: href + "&filter=absent",
      dueAt: due,
      urgent: false,
      level: "action",
      category: "learner_attendance",
    });
    return alerts;
  });
}
