import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  getPolicyGovernance,
  getProcessGovernance,
  governPolicy,
  governProcess,
  KhposOpsLibraryError,
} from "@/lib/khpos/ops/library";

const STARTER_MODEL =
  process.env.OPENAI_KHPOS_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini-2025-04-14";

let service: SupabaseClient | undefined;

function admin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new KhposStarterDraftError("KHP-OS starter drafting is not configured.", 503);
  }
  return (service ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ));
}

async function markAiDraft(
  table: "khpos_ops_policy_versions" | "khpos_ops_process_versions",
  versionId: string,
) {
  const { error } = await admin()
    .from(table)
    .update({ draft_source: "ai_starter", draft_model: STARTER_MODEL })
    .eq("id", versionId)
    .eq("status", "draft");

  if (error) {
    throw new KhposStarterDraftError(
      "The starter draft was created but its AI provenance could not be recorded. Do not submit it yet; retry after the platform is checked.",
      500,
    );
  }
}

export class KhposStarterDraftError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "KhposStarterDraftError";
  }
}

const PolicyStarterSchema = z.object({
  purpose: z.string().min(40).max(1200),
  scope: z.string().min(20).max(1200),
  principles: z.array(z.string().min(10).max(700)).min(3).max(10),
  policyStatements: z.array(z.string().min(10).max(800)).min(4).max(15),
  rolesResponsibilities: z.array(z.string().min(10).max(800)).min(3).max(15),
  rules: z.array(z.string().min(10).max(800)).min(4).max(20),
  exceptions: z.array(z.string().min(8).max(800)).min(1).max(8),
  escalation: z.array(z.string().min(10).max(800)).min(2).max(10),
  recordsEvidence: z.array(z.string().min(8).max(800)).min(2).max(12),
});

const ProcessStarterSchema = z.object({
  purpose: z.string().min(40).max(1200),
  trigger: z.string().min(15).max(800),
  inputs: z.array(z.string().min(8).max(700)).min(1).max(15),
  steps: z.array(z.string().min(12).max(900)).min(4).max(20),
  sla: z.string().min(5).max(300),
  evidence: z.array(z.string().min(8).max(700)).min(2).max(15),
  expectedOutcome: z.string().min(20).max(1000),
  exceptionConditions: z.array(z.string().min(8).max(700)).min(1).max(10),
  escalation: z.array(z.string().min(10).max(700)).min(2).max(10),
  kpis: z.array(z.string().min(8).max(700)).min(2).max(12),
});

type PolicyStarter = z.infer<typeof PolicyStarterSchema>;
type ProcessStarter = z.infer<typeof ProcessStarterSchema>;

function client() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new KhposStarterDraftError(
      "AI starter drafting is not configured. Draft manually or ask the platform administrator to restore the AI service.",
      503,
    );
  }
  return new OpenAI({ apiKey: key });
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dates() {
  const effective = new Date();
  const review = new Date(effective);
  review.setUTCFullYear(review.getUTCFullYear() + 1);
  return {
    effectiveDate: isoDate(effective),
    reviewDate: isoDate(review),
  };
}

async function generateJson<T>(
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
): Promise<T> {
  const openai = client();
  let lastIssue = "unknown validation failure";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model: STARTER_MODEL,
        temperature: 0.2,
        max_completion_tokens: 4200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content:
              attempt === 1
                ? prompt
                : `${prompt}\n\nThe previous output failed validation: ${lastIssue}. Regenerate the complete JSON and fix the issue.`,
          },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        lastIssue = "response was not valid JSON";
        continue;
      }

      const validated = schema.safeParse(parsed);
      if (validated.success) return validated.data;
      lastIssue = validated.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" | ");
    } catch (error) {
      console.error("[khpos][starter-draft] OpenAI request failed", {
        model: STARTER_MODEL,
        attempt,
        status: (error as { status?: number })?.status,
      });
      throw new KhposStarterDraftError(
        "The AI drafting service could not prepare a starter draft. No policy or process was changed.",
        503,
      );
    }
  }

  throw new KhposStarterDraftError(
    "The AI draft did not meet KHP-OS quality validation. No draft was saved.",
    422,
  );
}

function policyPrompt(input: {
  organisationName: string;
  code: string;
  name: string;
  priority: string;
  operatingSystem: string;
  ownerLabel: string;
  relatedProcesses: Array<{
    code: string;
    title: string;
    criticality: string;
    ownerLabel: string;
  }>;
  activeVersion: unknown;
}) {
  return `Prepare an editable starter draft for one controlled school policy in KHP-OS.

SCHOOL
${input.organisationName}

POLICY REGISTER
- Code: ${input.code}
- Name: ${input.name}
- Criticality: ${input.priority}
- Operating system: ${input.operatingSystem}
- Registered owner: ${input.ownerLabel}

RELATED REGISTERED PROCESSES
${JSON.stringify(input.relatedProcesses)}

CURRENT ACTIVE VERSION, IF ANY
${JSON.stringify(input.activeVersion)}

RULES
1. This is a starter draft for human editing and independent approval, not an approved policy.
2. Write concrete school-operating rules, not generic management prose.
3. Ground the content only in the register information above and ordinary school operating principles.
4. Do not invent laws, statutory numbers, external certifications, named regulators, monetary thresholds, staff names, campus facts or systems not supplied.
5. Where legal or regulatory compliance matters, say "applicable law, regulation and school requirements" without inventing citations.
6. Make roles and escalation operational. Use the registered owner where relevant and use neutral labels such as School Guardian, School Custodian, authorised leadership, relevant staff, learner or parent only where the policy logically requires them.
7. Each array item must be a complete, actionable statement.
8. Keep exceptions narrow. If exceptions should be rare, state who may authorise them and that they must be recorded.
9. Records/evidence must be auditable and practical.
10. Return JSON only.

Return exactly:
{
  "purpose": "...",
  "scope": "...",
  "principles": ["..."],
  "policyStatements": ["..."],
  "rolesResponsibilities": ["..."],
  "rules": ["..."],
  "exceptions": ["..."],
  "escalation": ["..."],
  "recordsEvidence": ["..."]
}`;
}

function processPrompt(input: {
  organisationName: string;
  code: string;
  title: string;
  criticality: string;
  operatingSystem: string;
  ownerLabel: string;
  governingPolicies: Array<{
    code: string;
    name: string;
    policyStatements: string[];
    rules: string[];
  }>;
  technology: string[];
  activeVersion: unknown;
}) {
  return `Prepare an editable starter draft for one controlled school operating process in KHP-OS.

SCHOOL
${input.organisationName}

PROCESS REGISTER
- Code: ${input.code}
- Title: ${input.title}
- Criticality: ${input.criticality}
- Operating system: ${input.operatingSystem}
- Registered owner: ${input.ownerLabel}
- Registered technology/tools: ${input.technology.join(", ") || "None specified"}

ACTIVE GOVERNING POLICIES
${JSON.stringify(input.governingPolicies)}

CURRENT ACTIVE PROCESS VERSION, IF ANY
${JSON.stringify(input.activeVersion)}

RULES
1. This is a starter draft for human editing and independent approval, not a published process.
2. Convert the title and governing policies into a clear end-to-end operating procedure.
3. Do not invent software, integrations, legal requirements, monetary thresholds, staff names, campus facts or approval authorities not supported above.
4. Use KHP-OS records/evidence where a system record is needed.
5. Steps must be sequential, unambiguous and executable by school staff.
6. Define inputs, evidence, exception conditions, escalation and KPIs that can actually be checked.
7. The expected outcome must describe the observable completion state.
8. SLA must be realistic but must not invent a specific deadline where the process context does not justify one; in that case use wording such as "within the school-defined service window".
9. Return JSON only.

Return exactly:
{
  "purpose": "...",
  "trigger": "...",
  "inputs": ["..."],
  "steps": ["..."],
  "sla": "...",
  "evidence": ["..."],
  "expectedOutcome": "...",
  "exceptionConditions": ["..."],
  "escalation": ["..."],
  "kpis": ["..."]
}`;
}

export async function createPolicyStarterDraft(
  organisationId: string,
  userId: string,
  policyId: string,
) {
  const governance = await getPolicyGovernance(organisationId, userId);
  const policy = governance.library.policies.find((item) => item.id === policyId);
  if (!policy) throw new KhposStarterDraftError("Policy not found.", 404);

  const open = governance.versions.find(
    (version) =>
      version.policy_id === policyId &&
      ["draft", "in_review"].includes(version.status),
  );
  if (open) {
    throw new KhposStarterDraftError(
      "Finish the open policy revision before creating another starter draft.",
      409,
    );
  }

  const relatedProcesses = governance.library.processes
    .filter((process) => process.governingPolicyCodes.includes(policy.code))
    .map((process) => ({
      code: process.code,
      title: process.title,
      criticality: process.criticality,
      ownerLabel: process.ownerLabel,
    }))
    .slice(0, 30);

  const draft = await generateJson(
    PolicyStarterSchema,
    "You are the KHP-OS institutional governance drafting assistant. You prepare practical school policy drafts. You never approve policy and you never invent legal authority.",
    policyPrompt({
      organisationName: governance.library.organisation.name,
      code: policy.code,
      name: policy.name,
      priority: policy.priority,
      operatingSystem: policy.operatingSystem,
      ownerLabel: policy.ownerLabel,
      relatedProcesses,
      activeVersion: policy.activeVersion,
    }),
  );

  const { effectiveDate, reviewDate } = dates();
  try {
    const result = await governPolicy(
      organisationId,
      userId,
      policyId,
      "save",
      { ...draft, effectiveDate, reviewDate },
    );
    const version = result.versions.find(
      (item) =>
        item.policy_id === policyId &&
        item.status === "draft" &&
        item.author_id === userId,
    );
    if (!version) {
      throw new KhposStarterDraftError(
        "Starter draft was saved but could not be reloaded safely.",
        500,
      );
    }
    await markAiDraft("khpos_ops_policy_versions", version.id);
    return getPolicyGovernance(organisationId, userId);
  } catch (error) {
    if (error instanceof KhposOpsLibraryError) {
      throw new KhposStarterDraftError(error.message, error.status);
    }
    throw error;
  }
}

export async function createProcessStarterDraft(
  organisationId: string,
  userId: string,
  processId: string,
) {
  const governance = await getProcessGovernance(organisationId, userId);
  const process = governance.library.processes.find(
    (item) => item.id === processId,
  );
  if (!process) throw new KhposStarterDraftError("Process not found.", 404);

  const open = governance.versions.find(
    (version) =>
      version.process_id === processId &&
      ["draft", "in_review"].includes(version.status),
  );
  if (open) {
    throw new KhposStarterDraftError(
      "Finish the open process revision before creating another starter draft.",
      409,
    );
  }

  const policyByCode = new Map(
    governance.library.policies.map((policy) => [policy.code, policy]),
  );
  const governingPolicies = process.governingPolicyCodes
    .map((code) => policyByCode.get(code))
    .filter((policy): policy is NonNullable<typeof policy> => !!policy)
    .filter((policy) => !!policy.activeVersion)
    .map((policy) => ({
      code: policy.code,
      name: policy.name,
      policyStatements: policy.activeVersion?.policyStatements.slice(0, 15) ?? [],
      rules: policy.activeVersion?.rules.slice(0, 20) ?? [],
    }));

  const missingPolicyCodes = process.governingPolicyCodes.filter(
    (code) => !policyByCode.get(code)?.activeVersion,
  );
  if (missingPolicyCodes.length) {
    throw new KhposStarterDraftError(
      `Publish governing policies first: ${missingPolicyCodes.join(", ")}.`,
      409,
    );
  }

  const draft = await generateJson(
    ProcessStarterSchema,
    "You are the KHP-OS institutional process drafting assistant. You prepare executable school operating-process drafts. You never approve or publish processes.",
    processPrompt({
      organisationName: governance.library.organisation.name,
      code: process.code,
      title: process.title,
      criticality: process.criticality,
      operatingSystem: process.operatingSystem,
      ownerLabel: process.ownerLabel,
      governingPolicies,
      technology: process.technology,
      activeVersion: process.activeVersion,
    }),
  );

  const { effectiveDate } = dates();
  try {
    const result = await governProcess(
      organisationId,
      userId,
      processId,
      "save",
      { ...draft, effectiveDate },
    );
    const version = result.versions.find(
      (item) =>
        item.process_id === processId &&
        item.status === "draft" &&
        item.author_id === userId,
    );
    if (!version) {
      throw new KhposStarterDraftError(
        "Starter draft was saved but could not be reloaded safely.",
        500,
      );
    }
    await markAiDraft("khpos_ops_process_versions", version.id);
    return getProcessGovernance(organisationId, userId);
  } catch (error) {
    if (error instanceof KhposOpsLibraryError) {
      throw new KhposStarterDraftError(error.message, error.status);
    }
    throw error;
  }
}

export function starterDraftModel() {
  return STARTER_MODEL;
}
