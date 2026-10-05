import { khposRecordHref } from "@/lib/khpos/ops/record-links";
import { getKhposOpsMyWork } from "@/lib/khpos/ops/work";
import { getKhposOpsIssues } from "@/lib/khpos/ops/issues";
import { getKhposOpsDecisions } from "@/lib/khpos/ops/decisions";

export type KhposAttentionSeverity = "critical" | "high" | "medium" | "info";
export type KhposAttentionKind =
  | "work"
  | "verification"
  | "issue"
  | "decision"
  | "implementation";

export interface KhposAttentionItem {
  id: string;
  kind: KhposAttentionKind;
  severity: KhposAttentionSeverity;
  title: string;
  detail: string;
  href: string;
  dueAt: string | null;
  actionLabel: string;
}

export interface KhposAttentionSnapshot {
  generatedAt: string;
  summary: {
    actionRequired: number;
    critical: number;
    overdue: number;
    blocked: number;
    awaitingVerification: number;
    waitingApproval: number;
    issues: number;
  };
  items: KhposAttentionItem[];
}

function dueState(value: string | null, nowMs: number) {
  if (!value) return { overdue: false, today: false, soon: false };
  const due = Date.parse(value);
  if (!Number.isFinite(due)) return { overdue: false, today: false, soon: false };
  const endToday = new Date(nowMs);
  endToday.setHours(23, 59, 59, 999);
  return {
    overdue: due < nowMs,
    today: due >= nowMs && due <= endToday.getTime(),
    soon: due > endToday.getTime() && due <= nowMs + 48 * 60 * 60 * 1000,
  };
}

function rank(severity: KhposAttentionSeverity) {
  return { critical: 0, high: 1, medium: 2, info: 3 }[severity];
}

export async function getKhposAttention(
  organisationId: string,
  userId: string,
  nowMs = Date.now(),
): Promise<KhposAttentionSnapshot> {
  const [work, issues, decisions] = await Promise.all([
    getKhposOpsMyWork(organisationId, userId),
    getKhposOpsIssues(organisationId, userId),
    getKhposOpsDecisions(organisationId, userId),
  ]);

  const items: KhposAttentionItem[] = [];
  let overdue = 0;
  let blocked = 0;
  let waitingApproval = 0;

  for (const item of work.items) {
    if (item.status === "completed") continue;
    const due = dueState(item.dueAt, nowMs);
    const important =
      item.status === "blocked" ||
      due.overdue ||
      due.today ||
      item.priority === "critical" ||
      item.priority === "high";

    if (!important) continue;
    if (item.status === "blocked") blocked += 1;
    if (due.overdue) overdue += 1;

    const severity: KhposAttentionSeverity =
      item.status === "blocked" || (due.overdue && item.priority === "critical")
        ? "critical"
        : due.overdue || item.priority === "critical"
          ? "high"
          : item.priority === "high" || due.today
            ? "medium"
            : "info";

    items.push({
      id: "work:" + item.id,
      kind: "work",
      severity,
      title: item.title,
      detail:
        item.status === "blocked"
          ? "Blocked: " + (item.blockedReason ?? "reason not recorded")
          : due.overdue
            ? "Overdue work"
            : due.today
              ? "Due today"
              : "Priority work needs attention",
      href: khposRecordHref(organisationId, "work", item.id),
      dueAt: item.dueAt,
      actionLabel: item.status === "blocked" ? "Resolve blocker" : "Open work",
    });
  }

  for (const item of work.verificationQueue) {
    items.push({
      id: "verification:" + item.id,
      kind: "verification",
      severity: item.priority === "critical" ? "high" : "medium",
      title: item.title,
      detail: "Independent verification is waiting for you.",
      href: khposRecordHref(organisationId, "verification", item.id),
      dueAt: item.submittedForVerificationAt,
      actionLabel: "Verify work",
    });
  }

  for (const issue of issues.items) {
    if (["verified", "closed"].includes(issue.status)) continue;
    const due = dueState(issue.dueAt, nowMs);
    const needsUser =
      issue.isOwner ||
      issue.isDirectManager ||
      issue.isEscalationRecipient ||
      (issue.isReporter && issue.status === "resolved");
    if (!needsUser && issue.severity !== "P1") continue;

    if (due.overdue) overdue += 1;
    items.push({
      id: "issue:" + issue.id,
      kind: "issue",
      severity:
        issue.severity === "P1"
          ? "critical"
          : issue.severity === "P2" || due.overdue
            ? "high"
            : "medium",
      title: issue.title,
      detail:
        due.overdue
          ? "Issue is overdue."
          : issue.isEscalationRecipient
            ? "Issue has been escalated to your authority."
            : issue.status === "resolved"
              ? "Resolution needs verification or closure."
              : "Issue requires action.",
      href: khposRecordHref(organisationId, "issue", issue.id),
      dueAt: issue.dueAt,
      actionLabel: "Open issue",
    });
  }

  for (const decision of decisions.items) {
    const approval =
      decision.isAuthority &&
      ["submitted", "under_review"].includes(decision.status);
    const implementation =
      decision.isImplementationOwner &&
      decision.actionRequired &&
      decision.status === "approved";

    if (!approval && !implementation) continue;

    if (approval) waitingApproval += 1;
    const dueAt = implementation
      ? decision.implementationDueAt
      : decision.decisionDueAt;
    const due = dueState(dueAt, nowMs);
    if (due.overdue) overdue += 1;

    items.push({
      id: (implementation ? "implementation:" : "decision:") + decision.id,
      kind: implementation ? "implementation" : "decision",
      severity:
        decision.priority === "P1" || due.overdue
          ? "critical"
          : decision.priority === "P2"
            ? "high"
            : "medium",
      title: decision.title,
      detail: implementation
        ? due.overdue
          ? "Approved action is overdue."
          : "Approved decision requires implementation."
        : due.overdue
          ? "Decision is overdue."
          : "Decision is waiting for your authority.",
      href: khposRecordHref(organisationId, "decision", decision.id),
      dueAt,
      actionLabel: implementation ? "Execute action" : "Review decision",
    });
  }

  const sorted = items.sort(
    (a, b) =>
      rank(a.severity) - rank(b.severity) ||
      (Date.parse(a.dueAt ?? "") || Number.MAX_SAFE_INTEGER) -
        (Date.parse(b.dueAt ?? "") || Number.MAX_SAFE_INTEGER),
  );

  return {
    generatedAt: new Date(nowMs).toISOString(),
    summary: {
      actionRequired: sorted.length,
      critical: sorted.filter((item) => item.severity === "critical").length,
      overdue,
      blocked,
      awaitingVerification: work.verificationQueue.length,
      waitingApproval,
      issues: sorted.filter((item) => item.kind === "issue").length,
    },
    items: sorted,
  };
}
