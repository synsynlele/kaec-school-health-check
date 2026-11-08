/**
 * Low-cost professional writing assistance for school reports, HQ updates,
 * and announcements. Pure, offline-capable, zero AI/model tokens.
 *
 * Source-bound: every factual assertion comes from the current user's
 * provided text or structured report responses. No school data is sent to
 * an external service. Never submits or publishes anything automatically.
 */
import type { ReportField } from "@/lib/khpos/reports";

export type WritingTone = "formal" | "warm" | "concise";

function clean(value: unknown, max = 2400): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim().slice(0, max);
}
function prose(value: string): string {
  // Preserve names, dates, figures and specialist terminology as entered.
  return value.replace(/[ \t]+/g, " ").trim();
}
function lines(value: string, limit = 10) {
  return clean(value, 6000).split(/\n+/)
    .map(line => prose(line).replace(/^[\s•*-]+/, "").trim())
    .filter(Boolean).slice(0, limit);
}
function answer(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return prose(clean(value, 1200));
  if (Array.isArray(value)) {
    return value.filter(x => typeof x === "string" || typeof x === "number")
      .map(x => prose(clean(x, 180))).filter(Boolean).slice(0, 12).join(", ");
  }
  return "";
}
function heading(value: string, defaultValue: string) {
  return clean(value, 160) || defaultValue;
}

export interface AnnouncementDraftInput {
  title: string;
  purpose: string;
  keyPoints?: string;
  requiredAction?: string;
  deadline?: string;
  contact?: string;
  closingName?: string;
  tone: WritingTone;
}

/** Format supplied facts, never invent attendance, promises, policies, or dates. */
export function composeAnnouncement(input: AnnouncementDraftInput): string {
  const title = heading(input.title,"");
  const purpose = prose(clean(input.purpose, 1800));
  if (title.length < 3) throw new Error("Add the announcement title.");
  if (purpose.length < 8) throw new Error("Describe the announcement using at least eight characters.");
  const keyPoints = lines(input.keyPoints ?? "", 12);
  const action = prose(clean(input.requiredAction, 900));
  const deadline = prose(clean(input.deadline, 160));
  const contact = prose(clean(input.contact, 200));
  const closingName = prose(clean(input.closingName, 160));
  const blocks: string[] = [];
  if (input.tone === "formal") {
    blocks.push("Dear colleagues,",
      "Please take note of the following regarding " + title + ":",
      purpose);
  } else if (input.tone === "warm") {
    blocks.push("Dear colleagues,",
      "We are sharing this update regarding " + title + ".",
      purpose);
  } else {
    blocks.push(title, purpose);
  }
  if (keyPoints.length) blocks.push("Important information:\n" +
    keyPoints.map((p,i) => `${i+1}. ${p}`).join("\n"));
  if (action) blocks.push("Action required:\n" + action);
  if (deadline) blocks.push("Deadline / schedule:\n" + deadline);
  if (contact) blocks.push("Questions or support:\n" + contact);
  if (input.tone === "formal") blocks.push("Thank you for your attention.");
  if (input.tone === "warm") blocks.push("Thank you for your cooperation and support.");
  if (closingName) blocks.push(closingName);
  return blocks.join("\n\n").slice(0,9700);
}

function groupForField(field: ReportField): "delivery" | "challenges" | "next" | "references" {
  const k = (field.key + " " + field.label).toLowerCase();
  if (/evidence|supporting|reference|document|source|link|attachment/.test(k) && field.type === "url") return "references";
  if (/next|follow.up|action|by when|deadline|what happens next|plan to|recommendation/.test(k)) return "next";
  if (/challenge|constraint|concern|delay|help|support|not done|unfinished|partial|issue|problem|missed/.test(k)) return "challenges";
  return "delivery";
}
function bullets(items: Array<{ label: string; value: string }>): string {
  return items.map(item => "- " + item.label + ": " + item.value).join("\n");
}

export interface SchoolReportDraftInput {
  title: string;
  author: string;
  periodStart: string;
  periodEnd: string;
  fields: ReportField[];
  payload: Record<string, unknown>;
}

/** Narrative view only. Source report answers remain authoritative/editable. */
export function composeSchoolReport(input: SchoolReportDraftInput): string {
  const groups = {
    delivery: [] as Array<{label:string;value:string}>,
    challenges: [] as Array<{label:string;value:string}>,
    next: [] as Array<{label:string;value:string}>,
    references: [] as Array<{label:string;value:string}>,
  };
  for (const field of input.fields.slice(0,30)) {
    if (!Object.hasOwn(input.payload,field.key)) continue;
    const value = answer(input.payload[field.key]);
    if (!value) continue;
    groups[groupForField(field)].push({
      label: heading(field.label,field.key),
      value,
    });
  }
  if (!Object.values(groups).some(items => items.length))
    throw new Error("Complete at least one report answer before preparing a narrative.");
  const blocks = [
    heading(input.title,"School report").toUpperCase(),
    "Reporting period: " + heading(input.periodStart,"Not specified") +
      " to " + heading(input.periodEnd,"Not specified"),
    "Prepared by: " + heading(input.author,"Not specified"),
  ];
  if (groups.delivery.length) blocks.push("REPORTED ACTIVITIES AND RESULTS\n"+bullets(groups.delivery));
  if (groups.challenges.length) blocks.push("CHALLENGES AND SUPPORT NEEDS\n"+bullets(groups.challenges));
  if (groups.next.length) blocks.push("PROPOSED NEXT STEPS\n"+bullets(groups.next));
  if (groups.references.length) blocks.push("SUPPORTING REFERENCES\n"+bullets(groups.references));
  blocks.push("Prepared from the reporter's recorded answers. Verify accuracy, privacy and required evidence before sharing. This draft does not independently verify outcomes.");
  return blocks.join("\n\n").slice(0,18000);
}

export interface HqReportDraftInput {
  title: string;
  reporter?: string;
  periodLabel: string;
  progress?: string;
  areas?: readonly string[];
  achievements?: string;
  challenges?: string;
  nextActions?: string;
  evidence?: string;
  notes?: string;
}

/** Formal HQ narrative; completed/not-completed claims remain attributed. */
export function composeHqReport(input:HqReportDraftInput): string {
  const data = [
    ["Work status",answer(input.progress)],
    ["Work areas",(input.areas ?? []).map(x=>clean(x,100)).filter(Boolean).join(", ")],
    ["Reported achievements",answer(input.achievements)],
    ["Additional observations",answer(input.notes)],
    ["Challenges or support needed",answer(input.challenges)],
    ["Next actions and responsibilities",answer(input.nextActions)],
    ["Evidence references",answer(input.evidence)],
  ].filter((entry):entry is string[]=>Boolean(entry[1]));
  if (!data.length) throw new Error("Record the work completed, progress, issues or next actions first.");
  const out=[
    heading(input.title,"KAEC HQ periodic report").toUpperCase(),
    "Reporting period: "+heading(input.periodLabel,"Not specified"),
  ];
  if(input.reporter) out.push("Prepared by: "+heading(input.reporter,"Not specified"));
  out.push(
    ...data.map(([key,value])=>key.toUpperCase()+"\n"+value),
    "Reporter-supplied information. Reviewer acceptance and supporting evidence remain separate controls.",
  );
  return out.join("\n\n").slice(0,16000);
}

/** Institution-level report assembled only from authorised leadership data.
 * Operating KPI percentages always describe a separate 30-day window. */
export function composeLeadershipSummary(input: {
  organisationName: string;
  generatedAt: string;
  periodDays: 7 | 30;
  progress: {workCompleted:number;issuesResolved:number;decisionsImplemented:number;recordsSubmitted:number};
  attention: { summary: { critical:number;overdue:number;blocked:number;waitingApproval:number } };
  agentPlan: {actions:Array<{title:string;recommendation:string;source:string;priority:string}>};
}): string {
  const lines=[
    heading(input.organisationName,"School").toUpperCase()+" — LEADERSHIP PERFORMANCE REVIEW",
    "Reporting window: previous "+input.periodDays+" days (rolling).",
    "Generated: "+heading(input.generatedAt,"Date unavailable"),
    "",
    "REPORTED SYSTEM ACTIVITY",
    "- Completed work items: "+input.progress.workCompleted,
    "- Issues resolved: "+input.progress.issuesResolved,
    "- Decisions implemented: "+input.progress.decisionsImplemented,
    "- Submitted operating records: "+input.progress.recordsSubmitted,
    "",
    "CURRENT EXCEPTIONS",
    "- Critical matters: "+input.attention.summary.critical,
    "- Overdue responsibilities: "+input.attention.summary.overdue,
    "- Blocked responsibilities: "+input.attention.summary.blocked,
    "- Decisions awaiting approval: "+input.attention.summary.waitingApproval,
    "",
    "PRIORITISED RECOMMENDATIONS",
  ];
  const actions=input.agentPlan.actions.slice(0,10);
  if(!actions.length)lines.push("No exception-triggered action identified in the currently authorised records.");
  else actions.forEach((action,i)=>lines.push(`${i+1}. [${action.priority}] ${clean(action.title,160)} — ${clean(action.recommendation,350)}`));
  lines.push("","ACCOUNTABILITY","This document is an automatically prepared review draft from current records. Leaders must verify the evidence, assign owners, and confirm outcomes before circulation. KSHC improvement is verified only by valid reassessment.");
  return lines.join("\n").slice(0,14000);
}

/** A private HQ digest from already-authorised network triage, not a public
 * leaderboard. The narrative must stay in the governed corporate workspace. */
export function composeNetworkSupportDigest(input:{
  generatedAt:string;
  summary:{schoolsScanned:number;needsHumanReview:number;critical:number};
  actions:readonly {schoolName:string;priority:string;reasons:readonly string[];proposedNextStep:string}[];
}):string {
  const out=[
    "KAEC NETWORK — PATHFINDER SUPPORT DIGEST",
    "Generated: "+heading(input.generatedAt,"Date not recorded"),
    "Schools reviewed: "+input.summary.schoolsScanned,
    "Schools flagged for human follow-up: "+input.summary.needsHumanReview,
    "Critical support cases: "+input.summary.critical,
    "",
    "RECOMMENDED SUPPORT QUEUE",
  ];
  if(!input.actions.length)out.push("No exception-triggered support item is currently flagged by the authorised portfolio measures.");
  input.actions.slice(0,12).forEach((school,index)=>{
    out.push(`${index+1}. ${clean(school.schoolName,130)} [${clean(school.priority,30)}]`,
      "Basis: "+school.reasons.map(x=>clean(x,250)).join("; "),
      "Proposed next step: "+clean(school.proposedNextStep,400),"");
  });
  out.push("Confidential: KAEC platform custodians only. Review school-specific evidence with its appointed leader. Do not distribute raw rankings, or presume that suggestions prove school failure.");
  return out.join("\n").slice(0,14000);
}
