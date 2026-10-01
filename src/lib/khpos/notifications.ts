import { getKhposOpsMyWork } from "@/lib/khpos/ops/work";
import { getKhposOpsDecisions } from "@/lib/khpos/ops/decisions";

export type KhposAlert = {
  id: string;
  title: string;
  detail: string;
  href: string;
  dueAt: string | null;
  urgent: boolean;
};

export async function getKhposAlerts(
  organisationId: string,
  userId: string,
  nowMs = Date.now(),
): Promise<KhposAlert[]> {
  const [work, decisions] = await Promise.all([
    getKhposOpsMyWork(organisationId, userId),
    getKhposOpsDecisions(organisationId, userId),
  ]);

  const week = nowMs + 7 * 86_400_000;
  const alerts: KhposAlert[] = [];

  for (const item of work.items) {
    if (item.status === "completed") continue;

    const due = item.dueAt ? Date.parse(item.dueAt) : Number.NaN;
    if (item.status !== "blocked" && !(due <= week)) continue;

    alerts.push({
      id: `work:${item.id}`,
      title: item.title,
      detail:
        item.status === "blocked"
          ? "Blocked work needs attention"
          : due < nowMs
            ? "Overdue work"
            : "Work due soon",
      href: `/khpos/${organisationId}/work`,
      dueAt: item.dueAt,
      urgent: item.status === "blocked" || due < nowMs,
    });
  }

  for (const item of decisions.items) {
    const pending =
      item.isAuthority && ["submitted", "under_review"].includes(item.status);
    const implementation =
      item.isImplementationOwner &&
      item.actionRequired &&
      item.status === "approved";

    if (!pending && !implementation) continue;

    const dueAt = implementation ? item.implementationDueAt : item.decisionDueAt;
    const due = dueAt ? Date.parse(dueAt) : Number.NaN;
    if (!(due <= week)) continue;

    alerts.push({
      id: `decision:${item.id}`,
      title: item.title,
      detail: pending
        ? due < nowMs
          ? "Decision overdue"
          : "Decision due soon"
        : due < nowMs
          ? "Action overdue"
          : "Action due soon",
      href: `/khpos/${organisationId}/decisions`,
      dueAt,
      urgent: due < nowMs,
    });
  }

  return alerts.sort(
    (a, b) =>
      Number(b.urgent) - Number(a.urgent) ||
      Date.parse(a.dueAt ?? "") - Date.parse(b.dueAt ?? ""),
  );
}

export function pushEligibleAlerts(
  alerts: KhposAlert[],
  nowMs = Date.now(),
): KhposAlert[] {
  const tomorrow = nowMs + 24 * 60 * 60 * 1000;
  return alerts.filter((alert) => {
    if (alert.urgent) return true;
    if (!alert.dueAt) return false;
    const due = Date.parse(alert.dueAt);
    return Number.isFinite(due) && due <= tomorrow;
  });
}
