import OpenAI from "openai";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHAPTER_MAP, QUESTION_INDEX, RATING_OPTIONS } from "@/lib/questions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KHPOS_INTELLIGENCE_MODEL =
  process.env.OPENAI_KHPOS_MODEL ||
  process.env.OPENAI_REPORT_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini-2025-04-14";
const GENERATION_VERSION = "2.0";

let adminClient: SupabaseClient | null = null;

function admin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

const InterventionIntelligenceSchema = z.object({
  contextSummary: z.string().min(100).max(1800),
  contextualisedDescription: z.string().min(120).max(2400),
  problemInterpretation: z.string().min(100).max(1800),
  whyNow: z.string().min(80).max(1400),
  planObjective: z.string().min(60).max(900),
  outcomeContract: z.object({
    baselineCondition: z.string().min(60).max(1200),
    desiredCondition: z.string().min(60).max(1200),
    leadingIndicators: z.array(z.string().min(15).max(300)).min(2).max(5),
    outcomeIndicators: z.array(z.string().min(15).max(300)).min(2).max(5),
    successThreshold: z.string().min(40).max(800),
    evidenceStandard: z.array(z.string().min(15).max(300)).min(3).max(6),
  }),
  actions: z
    .array(
      z.object({
        title: z.string().min(8).max(180),
        description: z.string().min(50).max(900),
        evidenceRequired: z.boolean(),
      }),
    )
    .min(4)
    .max(7),
  milestones: z
    .array(
      z.object({
        title: z.string().min(8).max(180),
        successSignal: z.string().min(40).max(700),
      }),
    )
    .min(3)
    .max(5),
  evidenceRequirements: z
    .array(
      z.object({
        title: z.string().min(8).max(180),
        description: z.string().min(40).max(700),
        evidenceType: z.enum([
          "standard_or_policy",
          "ownership_record",
          "implementation_record",
          "observation_record",
          "decision_record",
          "outcome_measurement",
        ]),
      }),
    )
    .min(3)
    .max(6),
  risksAndGuardrails: z.array(z.string().min(20).max(400)).min(2).max(5),
});

type InterventionIntelligence = z.infer<typeof InterventionIntelligenceSchema>;

interface OrganisationInterventionRow {
  id: string;
  organisation_id: string;
  priority_id: string;
  intervention_version_id: string;
  title: string;
  contextualised_description: string;
  status: string;
  start_date: string | null;
  target_date: string | null;
  intelligence_source: string;
  intelligence_attempted_at: string | null;
}

interface PriorityRow {
  id: string;
  source_assessment_id: string;
  source_indicator_id: string;
  title: string;
  problem_statement: string;
  khp_system_id: string;
  indicator_score: number;
  priority_score: number | string;
  status: string;
}

interface OrganisationRow {
  id: string;
  name: string;
  country: string | null;
  state: string | null;
  school_type: string | null;
  school_level: string | null;
}

interface InterventionVersionRow {
  id: string;
  intervention_id: string;
  version: string;
  problem_addressed: string;
  description: string;
  expected_outcome: string;
  implementation_guidance: string;
  complexity: string;
  recommended_duration_days: number;
  review_criteria: unknown;
}

interface InterventionDefinitionRow {
  id: string;
  intervention_code: string;
  title: string;
  primary_system_id: string;
  category: string;
}

interface AnswerRow {
  question_id: string | null;
  score: number | null;
  chapter: string | null;
  created_at: string | null;
}

interface ReportRow {
  full_report: Record<string, unknown> | null;
}

interface PlanRow {
  id: string;
  source: string;
  status: string;
}

function uniqueStrings(values: string[]): boolean {
  const normalised = values.map((value) => value.trim().toLowerCase());
  return new Set(normalised).size === normalised.length;
}

function validateIntelligence(value: InterventionIntelligence): string[] {
  const issues: string[] = [];
  if (!uniqueStrings(value.actions.map((item) => item.title))) issues.push("duplicate action titles");
  if (!uniqueStrings(value.milestones.map((item) => item.title))) issues.push("duplicate milestone titles");
  if (!uniqueStrings(value.evidenceRequirements.map((item) => item.title))) issues.push("duplicate evidence titles");
  if (!uniqueStrings(value.outcomeContract.leadingIndicators)) issues.push("duplicate leading indicators");
  if (!uniqueStrings(value.outcomeContract.outcomeIndicators)) issues.push("duplicate outcome indicators");
  return issues;
}

function parseModelOutput(raw: string): { data?: InterventionIntelligence; issues: string[] } {
  if (!raw.trim()) return { issues: ["empty model response"] };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { issues: ["model response was not valid JSON"] };
  }
  const parsed = InterventionIntelligenceSchema.safeParse(json);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  const issues = validateIntelligence(parsed.data);
  return issues.length ? { issues } : { data: parsed.data, issues: [] };
}

function ratingLabel(score: number): string {
  return RATING_OPTIONS.find((option) => option.value === score)?.label ?? "";
}

function compactReport(report: Record<string, unknown> | null): Record<string, unknown> {
  if (!report) return {};
  return {
    overallScore: report.overallScore,
    healthRating: report.healthRating,
    executiveSummary: report.executiveSummary,
    priorityAreas: report.priorityAreas,
    departmentScores: report.departmentScores,
    weaknesses: report.weaknesses,
    recommendations: report.recommendations,
    generation: report.generation,
  };
}

function buildPrompt(input: {
  organisation: OrganisationRow;
  intervention: OrganisationInterventionRow;
  priority: PriorityRow;
  definition: InterventionDefinitionRow;
  version: InterventionVersionRow;
  answers: AnswerRow[];
  report: Record<string, unknown> | null;
  activePriorities: PriorityRow[];
}): string {
  const latestByIndicator = new Map<string, AnswerRow>();
  for (const answer of input.answers) {
    if (!answer.question_id || latestByIndicator.has(answer.question_id)) continue;
    latestByIndicator.set(answer.question_id, answer);
  }

  const answerLines = [...latestByIndicator.values()]
    .map((answer) => {
      const id = answer.question_id ?? "unknown";
      const score = Number(answer.score);
      const question = QUESTION_INDEX[id];
      const chapterTitle = question ? CHAPTER_MAP[question.chapter]?.title ?? question.chapter : answer.chapter ?? "Unknown";
      return `- ${id} | ${chapterTitle} | ${score}/5 ${ratingLabel(score)} | ${question?.text ?? "Indicator text unavailable"}`;
    })
    .join("\n");

  const otherPriorities = input.activePriorities
    .filter((priority) => priority.id !== input.priority.id)
    .map((priority) => ({
      indicatorId: priority.source_indicator_id,
      title: priority.title,
      score: priority.indicator_score,
      priorityScore: Number(priority.priority_score),
      systemId: priority.khp_system_id,
    }));

  return `You are the KHP-OS institutional transformation intelligence layer for KAEC-NG.
Your task is NOT to choose a new intervention. The deterministic KHP-OS method has already selected the canonical intervention from verified KSHC evidence. Your task is to turn that canonical intervention into a rigorous, institution-specific transformation path.

NON-NEGOTIABLE RULES
1. KSHC scores, the approved priority and the selected canonical intervention are authoritative. Never alter or contradict them.
2. Use only the supplied institutional context and evidence. Never invent meetings, resources, budgets, staff behaviour, compliance status, stakeholder views, statistics, causal effects or outcomes.
3. Interpret patterns across the 55 indicators where they genuinely illuminate this priority. Do not merely restate the weak indicator.
4. Distinguish implementation activity from institutional change. Uploading a document is never, by itself, an outcome.
5. The outcome contract must define observable conditions and evidence without inventing numeric targets that the supplied evidence cannot support.
6. Actions must be materially specific to THIS intervention. Do not use the generic sequence "define standard, assign owner, run cycle, remove blockers, submit evidence, review" as the action list.
7. Prefer realistic systems, routines, capability and decision practices over unnecessary purchases.
8. Do not claim the underlying KSHC weakness has improved until reassessment verifies it.
9. Preserve human authority. KHP-OS recommends and structures; authorised humans approve consequential decisions.
10. Plain professional English. No markdown symbols inside JSON strings.

INSTITUTION
${JSON.stringify({
  name: input.organisation.name,
  country: input.organisation.country,
  state: input.organisation.state,
  schoolType: input.organisation.school_type,
  schoolLevel: input.organisation.school_level,
})}

APPROVED PRIORITY
${JSON.stringify({
  title: input.priority.title,
  problemStatement: input.priority.problem_statement,
  indicatorId: input.priority.source_indicator_id,
  indicatorScore: input.priority.indicator_score,
  priorityScore: Number(input.priority.priority_score),
  systemId: input.priority.khp_system_id,
})}

CANONICAL KHP-OS INTERVENTION — DO NOT REPLACE
${JSON.stringify({
  code: input.definition.intervention_code,
  title: input.definition.title,
  category: input.definition.category,
  primarySystemId: input.definition.primary_system_id,
  version: input.version.version,
  problemAddressed: input.version.problem_addressed,
  description: input.version.description,
  expectedOutcome: input.version.expected_outcome,
  implementationGuidance: input.version.implementation_guidance,
  reviewCriteria: input.version.review_criteria,
  recommendedDurationDays: input.version.recommended_duration_days,
})}

CURRENT KSHC REPORT CONTEXT
${JSON.stringify(compactReport(input.report))}

OTHER ACTIVE TRANSFORMATION PRIORITIES
${JSON.stringify(otherPriorities)}

ALL RECORDED KSHC INDICATORS
${answerLines}

Return STRICT JSON only with this exact shape:
{
  "contextSummary": "A concise institutional context explaining the conditions that materially shape this intervention.",
  "contextualisedDescription": "What this canonical intervention specifically means for this institution and the diagnosed problem.",
  "problemInterpretation": "A deeper evidence-grounded interpretation of the problem, including relevant cross-indicator dependencies without inventing causes.",
  "whyNow": "Why this intervention deserves attention now relative to the recorded baseline and other active priorities.",
  "planObjective": "A precise objective describing the institutional condition the implementation cycle is intended to establish.",
  "outcomeContract": {
    "baselineCondition": "What the supplied evidence currently establishes and what remains unknown.",
    "desiredCondition": "The observable institutional condition that should exist when this intervention is working.",
    "leadingIndicators": ["2-5 early observable signals of adoption or operating change"],
    "outcomeIndicators": ["2-5 later observable signals that the institutional condition is moving"],
    "successThreshold": "A defensible completion threshold stated without invented statistics.",
    "evidenceStandard": ["3-6 concrete forms of evidence required to support the change claim"]
  },
  "actions": [{"title":"specific action","description":"specific execution guidance","evidenceRequired":true}],
  "milestones": [{"title":"specific milestone","successSignal":"observable signal that the milestone is real"}],
  "evidenceRequirements": [{"title":"specific evidence","description":"what the evidence must demonstrate","evidenceType":"standard_or_policy|ownership_record|implementation_record|observation_record|decision_record|outcome_measurement"}],
  "risksAndGuardrails": ["2-5 implementation risks or guardrails grounded in the supplied context"]
}`;
}

async function markFallback(
  client: SupabaseClient,
  intervention: OrganisationInterventionRow,
  reason: string,
): Promise<void> {
  const now = new Date().toISOString();
  await client
    .from("khpos_organisation_interventions")
    .update({
      intelligence_source: "fallback",
      intelligence_model: KHPOS_INTELLIGENCE_MODEL,
      intelligence_version: GENERATION_VERSION,
      intelligence_error: reason.slice(0, 1000),
      intelligence_attempted_at: intervention.intelligence_attempted_at ?? now,
      updated_at: now,
    })
    .eq("id", intervention.id);

  await client.from("khpos_audit_events").insert({
    organisation_id: intervention.organisation_id,
    event_type: "intervention_intelligence_fallback",
    object_type: "organisation_intervention",
    object_id: intervention.id,
    metadata: {
      model: KHPOS_INTELLIGENCE_MODEL,
      generationVersion: GENERATION_VERSION,
      reason: reason.slice(0, 500),
    },
  });
}

export function khposInterventionIntelligenceStatus() {
  return {
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    model: KHPOS_INTELLIGENCE_MODEL,
    generationVersion: GENERATION_VERSION,
  };
}

export async function ensureKhposInterventionIntelligence(
  organisationInterventionId: string,
): Promise<boolean> {
  const client = admin();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!client || !apiKey) return false;

  const { data: interventionData, error: interventionError } = await client
    .from("khpos_organisation_interventions")
    .select(
      "id,organisation_id,priority_id,intervention_version_id,title,contextualised_description,status,start_date,target_date,intelligence_source,intelligence_attempted_at",
    )
    .eq("id", organisationInterventionId)
    .maybeSingle();
  if (interventionError || !interventionData) return false;

  const intervention = interventionData as OrganisationInterventionRow;
  if (intervention.intelligence_source === "openai" || intervention.intelligence_attempted_at) return false;
  if (!['planned','active'].includes(intervention.status)) return false;

  const attemptAt = new Date().toISOString();
  const { data: claimed } = await client
    .from("khpos_organisation_interventions")
    .update({ intelligence_attempted_at: attemptAt, intelligence_error: null })
    .eq("id", intervention.id)
    .is("intelligence_attempted_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return false;
  intervention.intelligence_attempted_at = attemptAt;

  try {
    const [priorityResult, versionResult, organisationResult, planResult] = await Promise.all([
      client
        .from("khpos_priorities")
        .select("id,source_assessment_id,source_indicator_id,title,problem_statement,khp_system_id,indicator_score,priority_score,status")
        .eq("id", intervention.priority_id)
        .single(),
      client
        .from("khpos_intervention_versions")
        .select("id,intervention_id,version,problem_addressed,description,expected_outcome,implementation_guidance,complexity,recommended_duration_days,review_criteria")
        .eq("id", intervention.intervention_version_id)
        .single(),
      client
        .from("organisations")
        .select("id,name,country,state,school_type,school_level")
        .eq("id", intervention.organisation_id)
        .single(),
      client
        .from("khpos_implementation_plans")
        .select("id,source,status")
        .eq("organisation_intervention_id", intervention.id)
        .in("status", ["generated", "active", "under_review"])
        .order("plan_version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (priorityResult.error || versionResult.error || organisationResult.error || planResult.error) {
      throw new Error("Required intervention context could not be loaded.");
    }
    const priority = priorityResult.data as PriorityRow;
    const version = versionResult.data as InterventionVersionRow;
    const organisation = organisationResult.data as OrganisationRow;
    const currentPlan = planResult.data as PlanRow | null;
    if (!currentPlan || currentPlan.source !== "system") return false;

    const [definitionResult, answersResult, reportResult, activePrioritiesResult] = await Promise.all([
      client
        .from("khpos_interventions")
        .select("id,intervention_code,title,primary_system_id,category")
        .eq("id", version.intervention_id)
        .single(),
      client
        .from("answers")
        .select("question_id,score,chapter,created_at")
        .eq("assessment_id", priority.source_assessment_id)
        .order("created_at", { ascending: false }),
      client
        .from("reports")
        .select("full_report")
        .eq("assessment_id", priority.source_assessment_id)
        .limit(1)
        .maybeSingle(),
      client
        .from("khpos_priorities")
        .select("id,source_assessment_id,source_indicator_id,title,problem_statement,khp_system_id,indicator_score,priority_score,status")
        .eq("organisation_id", intervention.organisation_id)
        .in("status", ["approved", "active"]),
    ]);

    if (definitionResult.error || answersResult.error || reportResult.error || activePrioritiesResult.error) {
      throw new Error("Diagnostic evidence for intervention intelligence could not be loaded.");
    }

    const definition = definitionResult.data as InterventionDefinitionRow;
    const answers = (answersResult.data ?? []) as AnswerRow[];
    const reportRow = reportResult.data as ReportRow | null;
    const activePriorities = (activePrioritiesResult.data ?? []) as PriorityRow[];
    if (!answers.length) throw new Error("The KSHC baseline has no indicator evidence.");

    const prompt = buildPrompt({
      organisation,
      intervention,
      priority,
      definition,
      version,
      answers,
      report: reportRow?.full_report ?? null,
      activePriorities,
    });

    const openai = new OpenAI({ apiKey });
    let lastIssues: string[] = [];
    let intelligence: InterventionIntelligence | undefined;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const retryInstruction =
        attempt === 1
          ? ""
          : `\n\nVALIDATION FAILURE ON THE PREVIOUS ATTEMPT\n${lastIssues.join("\n")}\nRegenerate the complete JSON from scratch and correct every issue.`;
      const completion = await openai.chat.completions.create({
        model: KHPOS_INTELLIGENCE_MODEL,
        temperature: 0.25,
        max_completion_tokens: 6000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are KAEC-NG's KHP-OS institutional transformation analyst. You contextualise an already-approved canonical intervention from supplied evidence and output valid JSON only.",
          },
          { role: "user", content: `${prompt}${retryInstruction}` },
        ],
      });

      const parsed = parseModelOutput(completion.choices[0]?.message?.content ?? "");
      if (parsed.data) {
        intelligence = parsed.data;
        break;
      }
      lastIssues = parsed.issues;
    }

    if (!intelligence) {
      throw new Error(`AI output failed validation: ${lastIssues.slice(0, 4).join(" | ")}`);
    }

    const contextSnapshot = {
      organisation: {
        name: organisation.name,
        country: organisation.country,
        state: organisation.state,
        schoolType: organisation.school_type,
        schoolLevel: organisation.school_level,
      },
      sourceAssessmentId: priority.source_assessment_id,
      priority: {
        id: priority.id,
        indicatorId: priority.source_indicator_id,
        indicatorScore: priority.indicator_score,
        priorityScore: Number(priority.priority_score),
        systemId: priority.khp_system_id,
      },
      canonicalIntervention: {
        id: definition.id,
        code: definition.intervention_code,
        version: version.version,
      },
      evidenceQuestionIds: answers.map((answer) => answer.question_id).filter(Boolean),
      reportGeneration: reportRow?.full_report?.generation ?? null,
    };

    const { data: result, error: applyError } = await client.rpc(
      "khpos_apply_intervention_intelligence_v2_server",
      {
        p_organisation_intervention_id: intervention.id,
        p_payload: {
          ...intelligence,
          contextSnapshot,
          model: KHPOS_INTELLIGENCE_MODEL,
          generationVersion: GENERATION_VERSION,
        },
      },
    );

    if (applyError) throw new Error(applyError.message);
    const outcome = result as { upgraded?: boolean; reason?: string } | null;
    if (!outcome?.upgraded) {
      await client
        .from("khpos_organisation_interventions")
        .update({
          intelligence_source: "system",
          intelligence_error: outcome?.reason ?? "upgrade_not_applied",
          updated_at: new Date().toISOString(),
        })
        .eq("id", intervention.id);
      return false;
    }

    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "intervention_intelligence_failed";
    console.error("[khpos] intervention intelligence failed; preserving deterministic plan:", reason);
    await markFallback(client, intervention, reason);
    return false;
  }
}

export async function ensureKhposWorkspaceInterventionIntelligence(
  organisationId: string,
): Promise<number> {
  const client = admin();
  if (!client || !process.env.OPENAI_API_KEY?.trim()) return 0;

  const { data: plans, error } = await client
    .from("khpos_implementation_plans")
    .select("organisation_intervention_id")
    .eq("organisation_id", organisationId)
    .eq("source", "system")
    .in("status", ["generated", "active", "under_review"])
    .order("generated_at", { ascending: true })
    .limit(3);
  if (error || !plans?.length) return 0;

  let upgraded = 0;
  for (const plan of plans as Array<{ organisation_intervention_id: string }>) {
    if (await ensureKhposInterventionIntelligence(plan.organisation_intervention_id)) upgraded += 1;
  }
  return upgraded;
}
