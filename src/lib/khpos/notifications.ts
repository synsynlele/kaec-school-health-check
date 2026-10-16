import { getReportAlerts } from "@/lib/khpos/reports";
import { getAnnouncementAlerts } from "@/lib/khpos/announcements";
import { getKhposAttention } from "@/lib/khpos/ops/attention";
import { getPresenceWorkspace } from "@/lib/khpos/ops/presence";
import { attendanceSteps, dueAttendanceSteps } from "@/lib/khpos/ops/attendance-guidance";

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

  // Attendance uses the existing authenticated, school-scoped presence service.
  // A disabled pilot, missing staff identity, or a completed check-in/out
  // produces no attendance reminder. Other operational alerts are unaffected.
  const attendanceAlerts: KhposAlert[] = await retryClockSkew(() =>
    getPresenceWorkspace(organisationId, userId)
  ).then((presence) =>
    dueAttendanceSteps(attendanceSteps(presence, nowMs)).map((step) => ({
      id: step.id,
      title: step.title,
      detail: step.instruction,
      href: `/khpos/${organisationId}/teaching-presence?tab=${step.periodId ? "lessons&period=" + step.periodId : "day"}`,
      dueAt: step.dueAt,
      urgent: step.urgent,
      level: step.urgent ? "urgent" as const : "action" as const,
      category: "attendance",
    }))
  ).catch(() => [] as KhposAlert[]);
  const workAlerts: KhposAlert[] = attention.items
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
  const announcementAlerts = await getAnnouncementAlerts(organisationId, userId).catch(() => []);
  const reportAlerts = await getReportAlerts(organisationId, userId).catch(() => []);
  return [...reportAlerts, ...announcementAlerts, ...attendanceAlerts, ...workAlerts].sort((a, b) =>
    Number(b.urgent) - Number(a.urgent) ||
    (Date.parse(a.dueAt ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(b.dueAt ?? "") || Number.MAX_SAFE_INTEGER));
}

export function pushEligibleAlerts(
  alerts: KhposAlert[],
  nowMs = Date.now(),
): KhposAlert[] {
  const tomorrow = nowMs + 24 * 60 * 60 * 1000;

  return alerts.filter((alert) => {
    if (alert.category === "announcement") return alert.urgent;
    if (alert.urgent) return true;
    if (alert.level !== "action") return false;
    if (!alert.dueAt) return alert.category === "verification";
    const due = Date.parse(alert.dueAt);
    return Number.isFinite(due) && due <= tomorrow;
  });
}
