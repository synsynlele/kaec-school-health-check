import type { ConfigureKhposExecutionInput, KhposExecutionMode } from "@/lib/khpos/ops/execution";

export interface KhposExecutionRecommendation {
  mode: KhposExecutionMode;
  ownerRoleId: string | null;
  ownerRoleTitle: string | null;
  ownerStaffed: boolean;
  eventType: string | null;
  conditionKey: string | null;
  triggerSummary: string;
  escalationMinutes: number | null;
  escalationBasis: "approved_interval" | "proposed_interval" | "requires_review";
  evidenceRequired: boolean;
  verificationRequired: boolean;
  approvedVersion: number;
  approvedSla: string | null;
  approvedEscalation: string[];
  rationale: string;
  cautions: string[];
}

interface RecommendationSource {
  code: string;
  criticality: string;
  version: { version: number; trigger: string; sla: string | null; escalation: unknown; evidence: unknown };
  owners: Array<{ id: string; title: string; staffed: boolean }>;
  recurring: Array<{ ownerRoleId: string; cadence: string }>;
  roles: Array<{ id: string; title: string; staffed: boolean }>;
  current: { evidenceRequired: boolean; verificationRequired: boolean };
}

function approvedInterval(instructions: string[]) {
  const values = new Set<number>();
  for (const instruction of instructions) {
    // Only elapsed, numeric intervals can become minutes. Business/calendar deadlines stay textual.
    if (/business|working|school day/i.test(instruction)) continue;
    for (const match of instruction.matchAll(/\b(?:after|within)\s+(\d+)\s*(minutes?|hours?)\b/gi)) {
      const minutes = Number(match[1]) * (/hour/i.test(match[2]) ? 60 : 1);
      if (minutes >= 1 && minutes <= 525600) values.add(minutes);
    }
  }
  return { value: values.size === 1 ? [...values][0] : null, ambiguous: values.size > 1 };
}

/** Deterministic draft suggestions; no configuration, approvals or work are changed. */
export function recommendKhposExecution(source: RecommendationSource): KhposExecutionRecommendation {
  const { version } = source;
  const approvedEscalation = Array.isArray(version.escalation)
    ? version.escalation.filter((value): value is string => typeof value === "string") : [];
  const interval = approvedInterval(approvedEscalation);
  const cautions: string[] = [];
  let mode: KhposExecutionMode = "manual_on_demand";
  let eventType: string | null = null;
  let conditionKey: string | null = null;
  let rationale = "The approved trigger needs a human to recognise the real operating need. No supported automatic source or unique active schedule is established.";
  let owner = source.owners.length === 1 ? source.owners[0] : null;

  if (source.recurring.length === 1) {
    mode = "recurring";
    owner = source.roles.find((role) => role.id === source.recurring[0].ownerRoleId) ?? null;
    rationale = `An active ${source.recurring[0].cadence} schedule already exists. Its governed owner and timing remain authoritative.`;
  } else if (source.recurring.length > 1) {
    cautions.push("Multiple active schedules exist. Review them before choosing recurring execution.");
  } else if (source.code === "GOV-007" && /review/i.test(version.trigger)) {
    mode = "condition";
    conditionKey = "policy_review_due";
    rationale = "The approved control includes review dates. The existing scheduler detects active policy versions whose review date has arrived.";
    cautions.push("This automates the policy review-date branch. Creation, amendment, conflicts and retirement still require their governed workflows.");
  } else {
    const eventRoutes: Record<string, { event: string; matches: RegExp; reason: string }> = {
      "ACD-007": { event: "academic_recovery_required", matches: /missed|partial|rejected|debt|recovery/i, reason: "Recorded academic debt creates a recovery obligation using the existing source event." },
      "PEO-009": { event: "staff_coverage_required", matches: /absence|leave|coverage|gap/i, reason: "An availability case requiring coverage emits the existing coverage event." },
      "LPI-003": { event: "learner_support_required", matches: /risk|signal/i, reason: "A recorded learner-risk signal emits a support event without copying the learner narrative." },
      "OPS-007": { event: "asset_fault_reported", matches: /maintenance|asset|repair|facility/i, reason: "An asset-linked issue emits the existing maintenance event. Other facility requests retain their domain workflow." },
    };
    const route = eventRoutes[source.code];
    if (route && route.matches.test(version.trigger)) {
      mode = "event";
      eventType = route.event;
      rationale = route.reason;
      cautions.push("The automatic source covers this named branch of the approved trigger; review other branches in the domain workspace.");
    } else if (/\bcontinuous\b/i.test(version.trigger)) {
      mode = "continuous_control";
      rationale = "The approved trigger describes ongoing control. Review it through its operating workspace rather than create repeated generic tasks.";
    }
  }

  if (!owner) cautions.push("The approved controls do not identify one active accountable role. Leadership must choose; no role is guessed from a title.");
  else if (!owner.staffed) cautions.push("The recommended role has no active school member appointed to it. Assign the real owner before relying on this route.");
  if (/immediate/i.test(approvedEscalation.join(" "))) cautions.push("The approved route includes immediate escalation. Act immediately when that condition occurs; a proposed timer does not permit waiting.");
  if (interval.ambiguous) cautions.push("Approved escalation instructions contain different intervals. Choose the applicable interval explicitly.");
  const escalationMinutes = interval.ambiguous ? null : interval.value ?? ({ P0: 30, P1: 1440, P2: 4320 }[source.criticality] ?? null);
  const escalationBasis = interval.ambiguous || escalationMinutes === null ? "requires_review" : interval.value !== null ? "approved_interval" : "proposed_interval";
  if (escalationBasis === "proposed_interval") cautions.push("The suggested escalation minutes are a proposed operating interval, not an approved deadline. Leadership must confirm them against the approved instructions.");

  return {
    mode, ownerRoleId: owner?.id ?? null, ownerRoleTitle: owner?.title ?? null, ownerStaffed: owner?.staffed ?? false,
    eventType, conditionKey, triggerSummary: version.trigger, escalationMinutes, escalationBasis,
    evidenceRequired: source.current.evidenceRequired || (Array.isArray(version.evidence) && version.evidence.length > 0),
    verificationRequired: source.current.verificationRequired,
    approvedVersion: version.version, approvedSla: version.sla, approvedEscalation, rationale, cautions,
  };
}

export function draftKhposExecutionRecommendation(current: ConfigureKhposExecutionInput, recommendation: KhposExecutionRecommendation): ConfigureKhposExecutionInput {
  return {
    ...current,
    mode: recommendation.mode,
    ownerRoleId: recommendation.ownerRoleId ?? current.ownerRoleId,
    eventType: recommendation.eventType,
    conditionKey: recommendation.conditionKey,
    triggerSummary: recommendation.triggerSummary,
    escalationMinutes: recommendation.escalationMinutes ?? current.escalationMinutes,
    evidenceRequired: current.evidenceRequired || recommendation.evidenceRequired,
    verificationRequired: current.verificationRequired || recommendation.verificationRequired,
  };
}
