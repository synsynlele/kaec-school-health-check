import { getKhposAttention } from "@/lib/khpos/ops/attention";

export type KhposAlert = {
  id: string;
  title: string;
  detail: string;
  href: string;
  dueAt: string | null;
  urgent: boolean;
  level: "urgent" | "action" | "watch";
  category: string;
};

async function retryClockSkew<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/JWT issued at future/i.test(error.message)
    ) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
    return operation();
  }
}

export async function getKhposAlerts(
  organisationId: string,
  userId: string,
  nowMs = Date.now(),
): Promise<KhposAlert[]> {
  const attention = await retryClockSkew(() =>
    getKhposAttention(organisationId, userId, nowMs),
  );
  const week = nowMs + 7 * 86_400_000;

  return attention.items
    .filter((item) => {
      if (item.severity === "critical" || item.severity === "high") return true;
      if (!item.dueAt) return item.kind === "verification";
      const due = Date.parse(item.dueAt);
      return Number.isFinite(due) && due <= week;
    })
    .map((item) => {
      const due = item.dueAt ? Date.parse(item.dueAt) : Number.NaN;
      const overdue = Number.isFinite(due) && due < nowMs;
      const urgent =
        item.severity === "critical" ||
        (item.severity === "high" && overdue);
      const level: KhposAlert["level"] = urgent
        ? "urgent"
        : item.severity === "high" || item.severity === "medium"
          ? "action"
          : "watch";

      return {
        id: item.id,
        title: item.title,
        detail: item.detail,
        href: item.href,
        dueAt: item.dueAt,
        urgent,
        level,
        category: item.kind,
      };
    })
    .sort(
      (a, b) =>
        Number(b.urgent) - Number(a.urgent) ||
        (a.level === "action" ? -1 : 1) -
          (b.level === "action" ? -1 : 1) ||
        (Date.parse(a.dueAt ?? "") || Number.MAX_SAFE_INTEGER) -
          (Date.parse(b.dueAt ?? "") || Number.MAX_SAFE_INTEGER),
    );
}

export function pushEligibleAlerts(
  alerts: KhposAlert[],
  nowMs = Date.now(),
): KhposAlert[] {
  const tomorrow = nowMs + 24 * 60 * 60 * 1000;

  return alerts.filter((alert) => {
    if (alert.urgent) return true;
    if (alert.level !== "action") return false;
    if (!alert.dueAt) return alert.category === "verification";
    const due = Date.parse(alert.dueAt);
    return Number.isFinite(due) && due <= tomorrow;
  });
}
