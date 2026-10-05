import type { KhposAttentionItem } from "@/lib/khpos/ops/attention";

export interface KhposMeetingAgendaItem {
  sourceId: string;
  purpose: "Decide" | "Unblock" | "Verify" | "Follow through";
  title: string;
  evidence: string;
  href: string;
  dueAt: string | null;
  severity: KhposAttentionItem["severity"];
  requestedOutcome: string;
}

/** Derive a bounded agenda only from the caller's already-authorised queue. */
export function prepareKhposMeetingAgenda(items: KhposAttentionItem[]) {
  const severityRank = { critical: 0, high: 1, medium: 2, info: 3 };
  const seen = new Set<string>();
  const ranked = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort((a, b) => {
    const urgency = severityRank[a.severity] - severityRank[b.severity];
    if (urgency) return urgency;
    const date = (value: string | null) => {
      const parsed = value ? Date.parse(value) : NaN;
      return Number.isFinite(parsed) ? parsed : Infinity;
    };
    const aDate = date(a.dueAt);
    const bDate = date(b.dueAt);
    return aDate === bDate ? a.id.localeCompare(b.id) : aDate < bDate ? -1 : 1;
  });
  const agenda: KhposMeetingAgendaItem[] = ranked.slice(0, 12).map((item) => {
    const purpose = item.kind === "decision" ? "Decide"
      : item.kind === "verification" ? "Verify"
      : item.kind === "implementation" ? "Follow through" : "Unblock";
    const requestedOutcome = {
      Decide: "Record the authorised decision and, where action is required, its accountable owner and deadline.",
      Verify: "Review submitted evidence and record acceptance or a specific reason for return.",
      "Follow through": "Confirm implementation evidence and the next step toward a verified outcome.",
      Unblock: "Confirm the constraint, accountable owner and next action with a deadline.",
    }[purpose];
    return { sourceId: item.id, purpose, title: item.title, evidence: item.detail,
      href: item.href, dueAt: item.dueAt, severity: item.severity, requestedOutcome };
  });
  return { items: agenda, remainingCount: Math.max(0, ranked.length - agenda.length) };
}
