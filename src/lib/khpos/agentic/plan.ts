/**
 * KHP-OS four-phase intelligence: deterministic and zero-model-token.
 *
 * Phase 1: Observe authorised operating exceptions.
 * Phase 2: Propose an action, never enact it or bypass school approvals.
 * Phase 3: Connect KSHC observations to validated improvement evidence.
 * Phase 4: Summarise authorised, aggregate network exceptions for platform HQ.
 *
 * The caller is responsible for authorisation BEFORE providing any snapshot.
 * These pure functions neither read the database nor call any AI provider.
 */
import type { KhposAttentionSnapshot, KhposAttentionItem, KhposAttentionSeverity } from "@/lib/khpos/ops/attention";
import type { KhposOpsPerformanceWorkspace } from "@/lib/khpos/ops/performance";
import type { KhposImprovementWorkspace } from "@/lib/khpos/improvement";
import type { KhposKsiWorkspace } from "@/lib/khpos/ksi-integration";
import type { KhposPortfolioIntelligence } from "@/lib/khpos/benchmarking";

export type AgentPriority = "critical" | "high" | "medium" | "info";
export type AgentPhase = 1 | 2 | 3 | 4;

export interface AgentDecisionDraft {
  title: string;
  context: string;
  recommendation: string;
  priority: "P1" | "P2" | "P3";
  category: "operational" | "academic" | "governance";
}

export interface SchoolAgentAction {
  id: string;
  phase: 1 | 2 | 3;
  priority: AgentPriority;
  title: string;
  observation: string;
  recommendation: string;
  evidenceToCheck: string;
  href: string;
  source: "attention" | "performance" | "kshc" | "ksi";
  decisionDraft: AgentDecisionDraft | null;
}

export interface SchoolAgentPlan {
  generatedAt: string;
  modelTokensUsed: 0;
  operatingRule: "review_before_action";
  summary: {
    recommendations: number;
    critical: number;
    approvalCandidates: number;
    kshcAvailable: boolean;
    ksiAvailable: boolean;
  };
  actions: SchoolAgentAction[];
  caveat: string;
}

const priorityOrder: Record<AgentPriority, number> = { critical: 0, high: 1, medium: 2, info: 3 };
function boundedText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
export function khposAgentAdviceForAttention(item: KhposAttentionItem): { next: string; evidence: string } {
  switch (item.kind) {
    case "verification": return {
      next: "Open the submitted evidence and independently accept it or return it with an explanation.",
      evidence: "Submission history and independent verification outcome.",
    };
    case "decision": return {
      next: "Review the pending decision within the existing authority chain; record a reasoned decision.",
      evidence: "Decision authority, decision note and the recorded result.",
    };
    case "implementation": return {
      next: "Check the approved decision's assigned owner, deadline and implementation evidence.",
      evidence: "Actual completion evidence and independent outcome verification.",
    };
    case "issue": return {
      next: "Check the issue record and confirm accountable ownership, a resolution step and review date.",
      evidence: "Issue history, corrective action and independent closure.",
    };
    case "meeting": return {
      next: "Open the scoped meeting and record assigned follow-ups after the discussion.",
      evidence: "Agreed actions, names and due dates in governed records.",
    };
    default: return {
      next: "Open the work item, resolve the current constraint and record the result for the authorised reviewer.",
      evidence: "Work log, completion evidence and verification.",
    };
  }
}
function suitableForDecisionDraft(item: KhposAttentionItem) {
  // A proposed decision is useful for material blockers; a normal verification
  // is not an invitation to create another approval layer.
  return (item.kind === "issue" || item.kind === "work") &&
    (item.severity === "critical" || item.severity === "high");
}
function decisionForAttention(item: KhposAttentionItem): AgentDecisionDraft | null {
  if (!suitableForDecisionDraft(item)) return null;
  return {
    title: boundedText("Resolve operating exception: " + item.title, 150),
    context: boundedText(
      "KHP-OS flagged an existing authorised " + item.kind + " item. " +
      item.detail + " Review the linked record before considering any change. " +
      "This is a proposed decision, not an approval.", 1000),
    recommendation: "Review the source evidence, select a responsible person and decide a proportionate corrective action.",
    priority: item.severity === "critical" ? "P1" : "P2",
    category: "operational",
  };
}

type Performance = KhposOpsPerformanceWorkspace["derivedPerformance"];
const measures: readonly {
  key: keyof Performance;
  label: string;
  target: number;
  detail: string;
  route: string;
}[] = [
  { key:"executionCoverage", label:"Execution mapping needs attention", target:90,
    detail:"Review unmapped approved processes and assign accountable implementation ownership.",route:"execution-control" },
  { key:"workCompletionReliability", label:"Work completion reliability needs attention", target:80,
    detail:"Identify missed tasks and remove the recurring source of non-completion.",route:"work" },
  { key:"onTimeCompletion", label:"Work is not consistently on time", target:80,
    detail:"Review deadlines and workload distribution before adjusting recurring routines.",route:"performance" },
  { key:"verificationFirstPass", label:"Too much work needs re-verification", target:80,
    detail:"Identify patterns in returned evidence and improve instructions or staff training.",route:"work" },
  { key:"issueClosure", label:"Issue follow-through needs review", target:80,
    detail:"Inspect open issues and verify owners, corrective actions and closure evidence.",route:"issues" },
  { key:"decisionActionClosure", label:"Approved decisions lack completed actions", target:80,
    detail:"Check implemented versus outstanding decision actions and accountable owners.",route:"decisions" },
];

export function buildSchoolAgentPlan(input: {
  organisationId: string;
  attention: KhposAttentionSnapshot;
  performance: Performance;
  health?: KhposImprovementWorkspace | null;
  ksi?: KhposKsiWorkspace | null;
  generatedAt?: string;
}): SchoolAgentPlan {
  const { organisationId, attention, performance, health, ksi } = input;
  const actions: SchoolAgentAction[] = [];
  const seen = new Set<string>();
  function append(action: SchoolAgentAction) {
    if (seen.has(action.id)) return;
    seen.add(action.id);
    actions.push(action);
  }

  // Phase 1 + 2: stay within the signed-in user's already-authorised queue.
  for (const item of attention.items.slice(0, 20)) {
    const instruction = khposAgentAdviceForAttention(item);
    append({
      id: "attention:" + item.id, phase: 2, priority: item.severity,
      title: boundedText(item.title, 160),
      observation: boundedText(item.detail, 280),
      recommendation: instruction.next,
      evidenceToCheck: instruction.evidence,
      href: item.href,
      source: "attention",
      decisionDraft: decisionForAttention(item),
    });
  }

  // Phase 1: ratios are evidence, not invented comparisons. These targets are
  // internal *review prompts*, never official or industry performance standards.
  for (const measure of measures) {
    const metric = performance[measure.key];
    if (typeof metric !== "object" || metric === null || !("percent" in metric)) continue;
    const value = metric.percent;
    if (value === null || typeof value !== "number" || !Number.isFinite(value) ||
        value >= measure.target) continue;
    append({
      id: "performance:" + measure.key, phase: 1,
      priority: value < 50 ? "high" : "medium",
      title: measure.label,
      observation: "Recorded 30-day result: " + value.toFixed(0) +
        "%. Internal review trigger: below " + measure.target + "%; not an industry benchmark.",
      recommendation: measure.detail,
      evidenceToCheck: "Underlying operational records and the scorecard definition.",
      href: `/khpos/${organisationId}/${measure.route}`,
      source: "performance",
      decisionDraft: null,
    });
  }

  // Phase 3: KSHC baseline is authoritative and reassessment is the only basis
  // for a verified improvement claim. No one can "approve" improvement here.
  if (health) {
    if (!health.baseline) {
      append({
        id:"kshc:baseline", phase:3, priority:"medium",
        title:"Establish the School Health Check baseline",
        observation:"No completed KSHC baseline is available in this authorised school workspace.",
        recommendation:"Complete and review the KSHC diagnosis before claiming institutional improvement.",
        evidenceToCheck:"A completed institutional assessment and its approved priority list.",
        href:`/khpos/${organisationId}/priorities`,source:"kshc",decisionDraft:null,
      });
    } else {
      for (const outcome of health.priorityOutcomes.slice(0, 12)) {
        if (!["regressed","unchanged"].includes(outcome.outcome)) continue;
        append({
          id:"kshc:priority:"+outcome.priorityId,
          phase:3,
          priority: outcome.outcome === "regressed" ? "high" : "medium",
          title: outcome.outcome === "regressed" ? "KSHC priority has regressed" : "KSHC priority is not improving",
          observation:"Indicator " + boundedText(outcome.sourceIndicatorId, 64) +
            "; reassessment outcome: " + outcome.outcome +
            "; score change: " + Number(outcome.scoreDelta).toFixed(0) + ".",
          recommendation:"Review the existing intervention and evidence, identify what prevented improvement, and revise the plan through governed school review.",
          evidenceToCheck:"Reassessment evidence, approved intervention, and documented outcome contract.",
          href:`/khpos/${organisationId}/improvement`,
          source:"kshc",decisionDraft:null,
        });
      }
      if (!health.latest) {
        append({
          id:"kshc:reassessment",phase:3,priority:"medium",
          title:"Reassessment evidence is not yet available",
          observation:"The school has a baseline but no completed reassessment in this workspace.",
          recommendation:"Track implementation and arrange a properly timed reassessment before claiming measured improvement.",
          evidenceToCheck:"Approved actions, implementation evidence and next reassessment record.",
          href:`/khpos/${organisationId}/improvement`,source:"kshc",decisionDraft:null,
        });
      }
    }
  }

  // Phase 3 also reuses already-aggregated KSI signals. Never inspect
  // individual student diagnoses, names, reports or other protected content.
  // A missing optional connection is not evidence of poor school performance.
  if (ksi?.integration.status === "active") {
    if (!ksi.latest) {
      append({
        id:"ksi:awaiting-signal",phase:3,priority:"info",
        title:"KSI learning signals have not been received",
        observation:"The school has an active KSI connection but no available aggregated learning snapshot.",
        recommendation:"Ask the authorised KSI administrator to confirm the integration and sync before using its results.",
        evidenceToCheck:"KSI connection status and a recent aggregate signal timestamp.",
        href:`/khpos/${organisationId}/learning-intelligence`,
        source:"ksi",decisionDraft:null,
      });
    } else {
      for (const signal of ksi.signals.slice(0,4)) {
        if (signal.state !== "attention" && signal.state !== "insufficient") continue;
        append({
          id:"ksi:"+signal.key,phase:3,
          priority:signal.state === "attention" ? "medium" : "info",
          title:"KSI: "+boundedText(signal.title,120),
          observation:boundedText(signal.headline+" · "+signal.detail,280),
          recommendation:signal.state === "attention"
            ? "Review the aggregated teaching and assessment evidence with the academic leadership team, and agree a documented corrective action."
            : "Gather enough validated teaching and assessment evidence before drawing conclusions about this indicator.",
          evidenceToCheck:"KSI aggregate signals, validation quality and the approved academic improvement plan.",
          href:`/khpos/${organisationId}/learning-intelligence`,source:"ksi",decisionDraft:null,
        });
      }
    }
  }

  const ranked = actions.sort((a,b) =>
    priorityOrder[a.priority]-priorityOrder[b.priority] ||
    a.phase-b.phase ||
    a.id.localeCompare(b.id)).slice(0,14);
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    modelTokensUsed: 0,
    operatingRule:"review_before_action",
    summary: {
      recommendations: ranked.length,
      critical: ranked.filter(a => a.priority === "critical").length,
      approvalCandidates: ranked.filter(a => a.decisionDraft !== null).length,
      kshcAvailable: Boolean(health?.baseline),
      ksiAvailable: ksi?.integration.status === "active" && Boolean(ksi.latest),
    },
    actions:ranked,
    caveat:"Suggestions only. No school record, policy, personnel outcome or verified KSHC assessment is changed without existing authorised workflows.",
  };
}

export interface NetworkAgentAction {
  organisationId: string;
  schoolName: string;
  priority: AgentPriority;
  issueScore: number;
  reasons: string[];
  proposedNextStep: string;
  evidenceToCheck: string;
  href: string;
}
export interface NetworkAgentPlan {
  generatedAt: string;
  modelTokensUsed: 0;
  summary: { schoolsScanned: number; needsHumanReview: number; critical: number };
  actions: NetworkAgentAction[];
  caveat: string;
}

/**
 * Phase 4. Only call after getKhposPortfolioIntelligence(userId), whose
 * platform-administrator access check is the sole authority for cross-school
 * named data. This layer never exposes itself through school-scoped APIs.
 */
export function buildNetworkAgentPlan(portfolio: KhposPortfolioIntelligence): NetworkAgentPlan {
  const operating = new Map(portfolio.observability.institutions.map(item =>
    [item.organisationId,item]));
  const scored = portfolio.institutions.map(institution => {
    const ops = operating.get(institution.organisationId);
    const reasons: string[] = [];
    let score = 0;
    if (institution.attention === "regression") {
      reasons.push("KSHC reassessment indicates regression");score += 6;
    } else if (institution.attention === "critical_priorities") {
      reasons.push("Critical KSHC priorities remain open");score += 4;
    } else if (institution.attention === "baseline_required") {
      reasons.push("KSHC baseline still needed");score += 2;
    } else if (institution.attention === "reassessment_required") {
      reasons.push("Reassessment is due for review");score += 2;
    }
    if (ops && ops.failedTriggers7d > 0) {
      reasons.push(ops.failedTriggers7d + " failed operating triggers (7 days)");
      score += 6 + Math.min(ops.failedTriggers7d,3);
    }
    if (ops && ops.p0Unmapped > 0) {
      reasons.push(ops.p0Unmapped + " critical processes lack execution mappings");
      score += 6 + Math.min(ops.p0Unmapped,3);
    }
    if (ops && ops.overdueWork > 0) {
      reasons.push(ops.overdueWork + " overdue work items");
      score += Math.min(ops.overdueWork,5);
    }
    if (ops && ops.staleVerification > 0) {
      reasons.push(ops.staleVerification + " items await timely verification");
      score += Math.min(ops.staleVerification,3);
    }
    if (ops && ops.standardStatus === "missing") {
      reasons.push("Current KAEC operating standard has not been installed");score+=4;
    } else if (ops && ops.standardStatus === "pending_adoption") {
      reasons.push("Current KAEC operating standard is pending adoption");score+=2;
    }
    const priority: AgentPriority = score >= 10 ? "critical"
      : score >= 6 ? "high" : score >= 2 ? "medium" : "info";
    const proposedNextStep = ops?.failedTriggers7d || ops?.p0Unmapped
      ? "Assign a Pathfinder to inspect failed routines or unmapped critical processes with the school's appointed leader."
      : institution.attention === "regression"
        ? "Schedule a school improvement review and verify the intervention plan against the latest reassessment."
        : institution.attention === "baseline_required"
          ? "Ask the school's authorised leader to complete its first KSHC baseline."
          : "Review the school's evidence and agree the next operating follow-up with its appointed leadership.";
    return {
      organisationId:institution.organisationId,
      schoolName:institution.name,
      priority, issueScore:score, reasons,
      proposedNextStep,
      evidenceToCheck:"Existing school-level records; verify through the authorised Pathfinder/school channel.",
      href:"/khpos/portfolio#portfolio-institutions",
    } satisfies NetworkAgentAction;
  });
  const ranked = scored.sort((a,b) =>
    priorityOrder[a.priority]-priorityOrder[b.priority] ||
    b.issueScore-a.issueScore ||
    a.schoolName.localeCompare(b.schoolName));
  return {
    generatedAt:portfolio.generatedAt,
    modelTokensUsed:0,
    summary:{
      schoolsScanned:scored.length,
      needsHumanReview:scored.filter(x => x.priority !== "info").length,
      critical:scored.filter(x => x.priority === "critical").length,
    },
    actions:ranked.filter(x => x.priority !== "info").slice(0,12),
    caveat:"Only authorised KAEC platform custodians may view named network findings. No learner details or private school evidence is included; HQ must obtain and verify school facts through existing governed workflows.",
  };
}
