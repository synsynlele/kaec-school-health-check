import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getKhposOpsLibrary } from "@/lib/khpos/ops/library";
import { getKhposOpsMyWork } from "@/lib/khpos/ops/work";
import { getKhposOpsIssues } from "@/lib/khpos/ops/issues";
import { getKhposOpsDecisions } from "@/lib/khpos/ops/decisions";
import { getKhposAttention } from "@/lib/khpos/ops/attention";
import { getKhposOpsPerformance } from "@/lib/khpos/ops/performance";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ASK_MODEL = process.env.KHPOS_AI_MODEL || "gpt-6-luna";
const DAILY_LIMIT = 30;
const MAX_SOURCES = 10;
const MAX_SOURCE_CHARS = 2_000;

let adminClient: SupabaseClient | null = null;
let aiClient: OpenAI | null = null;

export type KhposAskSourceType =
  | "policy"
  | "process"
  | "work"
  | "issue"
  | "decision"
  | "attention"
  | "performance";

export interface KhposAskSource {
  id: string;
  type: KhposAskSourceType;
  label: string;
  excerpt: string;
  href: string;
  current: boolean;
}

export interface KhposAskAnswer {
  answer: string;
  sources: KhposAskSource[];
  generatedAt: string;
  usedAi: boolean;
  remainingToday: number;
}

export class KhposAskError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposAskError";
  }
}

function admin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposAskError("Ask KHP-OS is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function ai() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!aiClient) aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return aiClient;
}

function words(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/s+/)
        .filter((word) => word.length >= 3),
    ),
  );
}

function score(queryWords: string[], source: KhposAskSource) {
  const haystack = (source.label + " " + source.excerpt).toLowerCase();
  let value = 0;
  for (const word of queryWords) {
    if (haystack.includes(word)) value += source.label.toLowerCase().includes(word) ? 4 : 1;
  }
  if (source.current) value += 0.25;
  return value;
}

function clip(value: string) {
  return value.replace(/s+/g, " ").trim().slice(0, MAX_SOURCE_CHARS);
}

function source(
  id: string,
  type: KhposAskSourceType,
  label: string,
  excerpt: string,
  href: string,
  current: boolean,
): KhposAskSource {
  return { id, type, label, excerpt: clip(excerpt), href, current };
}

async function ensureMember(organisationId: string, userId: string) {
  const { data, error } = await admin()
    .from("organisation_memberships")
    .select("organisations!inner(id,name,status,partner_status,partner_entitlements)")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const organisation = data
    ? Array.isArray(data.organisations)
      ? data.organisations[0]
      : data.organisations
    : null;

  if (
    error ||
    !organisation ||
    organisation.status !== "active" ||
    organisation.partner_status !== "active" ||
    !Array.isArray(organisation.partner_entitlements) ||
    !organisation.partner_entitlements.includes("khpos_core")
  ) {
    throw new KhposAskError("Active KHP-OS school membership is required.", 403);
  }

  return { id: organisation.id, name: organisation.name };
}

async function usageToday(organisationId: string, userId: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await admin()
    .from("khpos_ops_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", organisationId)
    .eq("actor_user_id", userId)
    .eq("event_type", "ops_ask_khpos")
    .gte("created_at", start.toISOString());

  if (error) throw new KhposAskError(error.message, 500);
  return count ?? 0;
}

async function governedSources(
  organisationId: string,
  userId: string,
): Promise<KhposAskSource[]> {
  const [library, work, issues, decisions, attention] = await Promise.all([
    getKhposOpsLibrary(organisationId, userId),
    getKhposOpsMyWork(organisationId, userId),
    getKhposOpsIssues(organisationId, userId),
    getKhposOpsDecisions(organisationId, userId),
    getKhposAttention(organisationId, userId),
  ]);

  const sources: KhposAskSource[] = [];

  for (const policy of library.policies) {
    if (!policy.activeVersion) continue;
    const version = policy.activeVersion;
    sources.push(
      source(
        "policy:" + policy.id,
        "policy",
        policy.code + " · " + policy.name,
        [
          "Purpose: " + version.purpose,
          "Scope: " + version.scope,
          "Policy statements: " + version.policyStatements.join(" | "),
          "Rules: " + version.rules.join(" | "),
          "Roles: " + version.rolesResponsibilities.join(" | "),
          "Escalation: " + version.escalation.join(" | "),
          "Records: " + version.recordsEvidence.join(" | "),
        ].join("\n"),
        "/khpos/" + organisationId + "/library?tab=policies&q=" + encodeURIComponent(policy.code),
        false,
      ),
    );
  }

  for (const process of library.processes) {
    if (!process.activeVersion) continue;
    const version = process.activeVersion;
    sources.push(
      source(
        "process:" + process.id,
        "process",
        process.code + " · " + process.title,
        [
          "Owner: " + process.ownerLabel,
          "Purpose: " + version.purpose,
          "Trigger: " + version.trigger,
          "Procedure: " + version.steps.join(" | "),
          "SLA: " + (version.sla ?? "No fixed SLA"),
          "Evidence: " + version.evidence.join(" | "),
          "Expected outcome: " + version.expectedOutcome,
          "Exceptions: " + version.exceptionConditions.join(" | "),
          "Escalation: " + version.escalation.join(" | "),
          "KPIs: " + version.kpis.join(" | "),
        ].join("\n"),
        "/khpos/" + organisationId + "/library?tab=processes&q=" + encodeURIComponent(process.code),
        false,
      ),
    );
  }

  for (const item of work.items) {
    sources.push(
      source(
        "work:" + item.id,
        "work",
        item.title,
        [
          "Status: " + item.status,
          "Priority: " + item.priority,
          "Due: " + (item.dueAt ?? "No fixed deadline"),
          "Process: " + (item.processCode ?? "Unlinked"),
          "Role: " + item.roleTitle,
          "Blocked: " + (item.blockedReason ?? "No"),
          "Evidence count: " + item.evidenceCount,
        ].join("\n"),
        "/khpos/" + organisationId + "/work",
        true,
      ),
    );
  }

  for (const item of work.verificationQueue) {
    sources.push(
      source(
        "verification:" + item.id,
        "work",
        "Verification · " + item.title,
        [
          "Status: awaiting verification",
          "Priority: " + item.priority,
          "Process: " + (item.processCode ?? "Unlinked"),
          "Submitted: " + (item.submittedForVerificationAt ?? "Unknown"),
          "Evidence count: " + item.evidenceCount,
        ].join("\n"),
        "/khpos/" + organisationId + "/work",
        true,
      ),
    );
  }

  for (const issue of issues.items) {
    sources.push(
      source(
        "issue:" + issue.id,
        "issue",
        issue.title,
        [
          "Status: " + issue.status,
          "Severity: " + issue.severity,
          "Due: " + (issue.dueAt ?? "No fixed deadline"),
          "Owner: " + (issue.ownerRoleTitle ?? "Unassigned"),
          "Escalated: " + String(Boolean(issue.isEscalationRecipient)),
          "Description: " + (issue.description ?? ""),
        ].join("\n"),
        "/khpos/" + organisationId + "/issues",
        true,
      ),
    );
  }

  for (const decision of decisions.items) {
    sources.push(
      source(
        "decision:" + decision.id,
        "decision",
        decision.reference + " · " + decision.title,
        [
          "Status: " + decision.status,
          "Priority: " + decision.priority,
          "Context: " + decision.context,
          "Decision: " + (decision.decisionText ?? "Not decided"),
          "Action required: " + String(decision.actionRequired),
          "Expected outcome: " + (decision.implementationExpectedOutcome ?? "None"),
          "Implementation due: " + (decision.implementationDueAt ?? "None"),
          "Outcome status: " + (decision.outcomeStatus ?? "Not yet verified"),
        ].join("\n"),
        "/khpos/" + organisationId + "/decisions",
        true,
      ),
    );
  }

  if (attention.items.length) {
    sources.push(
      source(
        "attention:current",
        "attention",
        "Current action-required view",
        attention.items
          .slice(0, 12)
          .map((item) => item.severity + " · " + item.kind + " · " + item.title + " · " + item.detail)
          .join("\n"),
        "/khpos/" + organisationId + "/work",
        true,
      ),
    );
  }

  try {
    const performance = await getKhposOpsPerformance(organisationId, userId);
    const d = performance.derivedPerformance;
    sources.push(
      source(
        "performance:30d",
        "performance",
        "Evidence-derived operating performance · last 30 days",
        [
          "Execution coverage: " + String(d.executionCoverage.percent ?? "insufficient data") + "%",
          "Work completion: " + String(d.workCompletionReliability.percent ?? "insufficient data") + "%",
          "On-time completion: " + String(d.onTimeCompletion.percent ?? "insufficient data") + "%",
          "First-pass verification: " + String(d.verificationFirstPass.percent ?? "insufficient data") + "%",
          "Issue closure: " + String(d.issueClosure.percent ?? "insufficient data") + "%",
          "Decision action closure: " + String(d.decisionActionClosure.percent ?? "insufficient data") + "%",
          "Controlled records submitted: " + d.recordsSubmitted,
        ].join("\n"),
        "/khpos/" + organisationId + "/performance",
        true,
      ),
    );
  } catch {
    // Performance governance is role-aware. Ask KHP-OS simply omits data the actor cannot access.
  }

  return sources;
}

function fallbackAnswer(question: string, sources: KhposAskSource[]) {
  if (!sources.length) {
    return "I could not find governed KHP-OS information that answers this question. Check that the relevant policy, process or operating record has been published or recorded.";
  }

  return (
    "I found governed KHP-OS sources relevant to “" +
    question +
    "”, but the AI explanation service is currently unavailable. Open the sources below; KHP-OS has not invented an answer."
  );
}

export async function askKhpos(
  organisationId: string,
  userId: string,
  question: string,
): Promise<KhposAskAnswer> {
  const trimmed = question.trim();
  if (trimmed.length < 4) throw new KhposAskError("Ask a complete question.", 400);
  if (trimmed.length > 700) throw new KhposAskError("Keep each question under 700 characters.", 400);

  const organisation = await ensureMember(organisationId, userId);
  const usedToday = await usageToday(organisationId, userId);
  if (usedToday >= DAILY_LIMIT) {
    throw new KhposAskError(
      "Your Ask KHP-OS daily limit has been reached. This guard protects the school from unnecessary AI cost; try again tomorrow.",
      429,
    );
  }

  const allSources = await governedSources(organisationId, userId);
  const queryWords = words(trimmed);
  const ranked = allSources
    .map((item) => ({ item, score: score(queryWords, item) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SOURCES)
    .map((row) => row.item);

  const selected = ranked.length
    ? ranked
    : allSources
        .filter((item) => item.current)
        .slice(0, Math.min(5, MAX_SOURCES));

  const openai = ai();
  let answer = fallbackAnswer(trimmed, selected);
  let usedAi = false;
  let usage: Record<string, unknown> = {};

  if (openai && selected.length) {
    const context = selected
      .map(
        (item, index) =>
          `[${index + 1}] ${item.type.toUpperCase()} — ${item.label}\n${item.excerpt}`,
      )
      .join("\n\n");

    const response = await openai.responses.create({
      model: ASK_MODEL,
      max_output_tokens: 700,
      instructions:
        "You are Ask KHP-OS, a grounded institutional operating assistant. Answer only from the supplied KHP-OS governed context. Never invent a policy, process, deadline, status, person, score or authority. Distinguish institutional standards (policy/process) from current operational facts (work/issues/decisions/performance). If the evidence is insufficient, say exactly what is missing. Do not make or approve decisions on behalf of humans. Be concise, practical and use source markers like [1] or [2] after claims.",
      input:
        "School: " +
        organisation.name +
        "\nQuestion: " +
        trimmed +
        "\n\nGoverned context:\n" +
        context,
    });

    answer = response.output_text?.trim() || fallbackAnswer(trimmed, selected);
    usedAi = Boolean(response.output_text?.trim());
    usage = response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.total_tokens,
          model: ASK_MODEL,
        }
      : { model: ASK_MODEL };
  }

  const { error: auditError } = await admin().from("khpos_ops_audit_events").insert({
    organisation_id: organisationId,
    actor_user_id: userId,
    event_type: "ops_ask_khpos",
    object_type: "institutional_query",
    object_id: organisationId,
    metadata: {
      question: trimmed.slice(0, 250),
      sourceCount: selected.length,
      usedAi,
      ...usage,
    },
  });

  if (auditError) {
    throw new KhposAskError(
      "The answer was prepared but its accountability record could not be saved, so KHP-OS did not release it.",
      500,
    );
  }

  return {
    answer,
    sources: selected,
    generatedAt: new Date().toISOString(),
    usedAi,
    remainingToday: Math.max(0, DAILY_LIMIT - usedToday - 1),
  };
}
