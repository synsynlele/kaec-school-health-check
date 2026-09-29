import { NextResponse } from "next/server";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { getKhposOpsMyWork } from "@/lib/khpos/ops/work";
import { getKhposOpsDecisions } from "@/lib/khpos/ops/decisions";
import { UUID_RE } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "School not found." }, { status: 404 });
  const token = bearerTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    const user = await verifyKhposAccessToken(token);
    const [work, decisions] = await Promise.all([
      getKhposOpsMyWork(id, user.id), getKhposOpsDecisions(id, user.id),
    ]);
    const now = Date.now();
    const week = now + 7 * 86400000;
    const alerts: Array<{ id: string; title: string; detail: string; href: string; dueAt: string | null; urgent: boolean }> = [];
    for (const item of work.items) {
      if (item.status === "completed") continue;
      const due = item.dueAt ? Date.parse(item.dueAt) : NaN;
      if (item.status !== "blocked" && !(due <= week)) continue;
      alerts.push({ id: `work:${item.id}`, title: item.title,
        detail: item.status === "blocked" ? "Blocked work needs attention" : due < now ? "Overdue work" : "Work due soon",
        href: `/khpos/${id}/work`, dueAt: item.dueAt, urgent: item.status === "blocked" || due < now });
    }
    for (const item of decisions.items) {
      const pending = item.isAuthority && ["submitted", "under_review"].includes(item.status);
      const implementation = item.isImplementationOwner && item.actionRequired && item.status === "approved";
      if (!pending && !implementation) continue;
      const dueAt = implementation ? item.implementationDueAt : item.decisionDueAt;
      const due = dueAt ? Date.parse(dueAt) : NaN;
      if (!(due <= week)) continue;
      alerts.push({ id: `decision:${item.id}`, title: item.title,
        detail: pending ? (due < now ? "Decision overdue" : "Decision due soon") : (due < now ? "Action overdue" : "Action due soon"),
        href: `/khpos/${id}/decisions`, dueAt, urgent: due < now });
    }
    alerts.sort((a, b) => Number(b.urgent) - Number(a.urgent) || Date.parse(a.dueAt ?? "") - Date.parse(b.dueAt ?? ""));
    return NextResponse.json({ alerts: alerts.slice(0, 50), total: alerts.length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[khpos][notifications] failed", error);
    return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 403 });
  }
}
