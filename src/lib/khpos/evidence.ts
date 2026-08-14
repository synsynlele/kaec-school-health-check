import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getKhposImplementationWorkspace,
  type KhposImplementationPlan,
  type KhposImplementationWorkspace,
} from "@/lib/khpos/implementation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVIDENCE_BUCKET = "khpos-evidence";
const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const EVIDENCE_MODEL =
  process.env.KHPOS_EVIDENCE_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const EVIDENCE_PROMPT_VERSION = "1.0";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

let adminClient: SupabaseClient | null = null;

export class KhposEvidenceError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "KhposEvidenceError";
  }
}

function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposEvidenceError("KHP-OS evidence automation is not configured.", 503);
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function safeFilename(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return cleaned || "evidence";
}

function planFor(
  workspace: KhposImplementationWorkspace,
  planId: string,
): KhposImplementationPlan {
  const plan = workspace.plans.find((item) => item.id === planId);
  if (!plan) {
    throw new KhposEvidenceError("Active implementation plan not found.", 404);
  }
  return plan;
}

interface EvidenceSubmissionRow {
  id: string;
  organisation_id: string;
  implementation_plan_id: string;
  submitted_by: string | null;
  title: string;
  note: string | null;
  storage_bucket: string;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | string | null;
  status: string;
  created_at: string;
}

interface EvidenceAssessmentRow {
  evidence_submission_id: string;
  assessment_state: "accepted" | "needs_clarification" | "rejected";
  summary: string;
  provider: string;
  model: string | null;
  prompt_version: string;
  created_at: string;
}

interface EvidenceLinkRow {
  evidence_submission_id: string;
  evidence_requirement_id: string;
  link_role: "primary" | "supporting";
  match_confidence: number | string;
  sufficiency_score: number | string;
  what_it_proves: string;
  gaps: string[];
}

interface ReviewPreparationRow {
  review_schedule_id: string;
  implementation_plan_id: string;
  required_count: number;
  accepted_count: number;
  coverage_percent: number | string;
  readiness: "not_ready" | "partial" | "ready";
  evidence_summary: string;
  evidence_gaps: unknown[];
  prepared_at: string;
}

export interface KhposEvidenceMatch {
  requirementId: string;
  role: "primary" | "supporting";
  confidence: number;
  sufficiencyScore: number;
  whatItProves: string;
  gaps: string[];
}

export interface KhposEvidenceSubmission {
  id: string;
  planId: string;
  title: string;
  note: string | null;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  viewUrl: string | null;
  assessment: {
    state: "accepted" | "needs_clarification" | "rejected";
    summary: string;
    provider: string;
    model: string | null;
    promptVersion: string;
    createdAt: string;
  } | null;
  matches: KhposEvidenceMatch[];
}

export interface KhposReviewPreparation {
  reviewScheduleId: string;
  planId: string;
  requiredCount: number;
  acceptedCount: number;
  coveragePercent: number;
  readiness: "not_ready" | "partial" | "ready";
  evidenceSummary: string;
  evidenceGaps: unknown[];
  preparedAt: string;
}

export interface KhposEvidenceWorkspace {
  implementation: KhposImplementationWorkspace;
  submissions: KhposEvidenceSubmission[];
  reviewPreparations: KhposReviewPreparation[];
}

export async function getKhposEvidenceWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposEvidenceWorkspace> {
  const implementation = await getKhposImplementationWorkspace(
    organisationId,
    userId,
  );
  const client = admin();
  const planIds = implementation.plans.map((plan) => plan.id);

  if (!planIds.length) {
    return { implementation, submissions: [], reviewPreparations: [] };
  }

  const { data: submissionRows, error: submissionError } = await client
    .from("khpos_evidence_submissions")
    .select(
      "id,organisation_id,implementation_plan_id,submitted_by,title,note,storage_bucket,storage_path,original_filename,mime_type,size_bytes,status,created_at",
    )
    .eq("organisation_id", organisationId)
    .in("implementation_plan_id", planIds)
    .order("created_at", { ascending: false });
  if (submissionError) {
    throw new KhposEvidenceError("Evidence records could not be loaded.", 500);
  }

  const submissions = (submissionRows ?? []) as EvidenceSubmissionRow[];
  const submissionIds = submissions.map((item) => item.id);

  const [assessmentResult, linkResult, prepResult] = await Promise.all([
    submissionIds.length
      ? client
          .from("khpos_evidence_assessments")
          .select(
            "evidence_submission_id,assessment_state,summary,provider,model,prompt_version,created_at",
          )
          .in("evidence_submission_id", submissionIds)
      : Promise.resolve({ data: [], error: null }),
    submissionIds.length
      ? client
          .from("khpos_evidence_links")
          .select(
            "evidence_submission_id,evidence_requirement_id,link_role,match_confidence,sufficiency_score,what_it_proves,gaps",
          )
          .in("evidence_submission_id", submissionIds)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("khpos_review_preparations")
      .select(
        "review_schedule_id,implementation_plan_id,required_count,accepted_count,coverage_percent,readiness,evidence_summary,evidence_gaps,prepared_at",
      )
      .in("implementation_plan_id", planIds),
  ]);

  if (assessmentResult.error || linkResult.error || prepResult.error) {
    throw new KhposEvidenceError("Evidence intelligence could not be loaded.", 500);
  }

  const assessments = (assessmentResult.data ?? []) as EvidenceAssessmentRow[];
  const links = (linkResult.data ?? []) as EvidenceLinkRow[];
  const preparations = (prepResult.data ?? []) as ReviewPreparationRow[];
  const assessmentBySubmission = new Map(
    assessments.map((item) => [item.evidence_submission_id, item]),
  );

  const viewUrls = new Map<string, string | null>();
  await Promise.all(
    submissions.map(async (submission) => {
      if (!submission.storage_path) {
        viewUrls.set(submission.id, null);
        return;
      }
      const { data } = await client.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(submission.storage_path, 300);
      viewUrls.set(submission.id, data?.signedUrl ?? null);
    }),
  );

  return {
    implementation,
    submissions: submissions.map((submission) => {
      const assessment = assessmentBySubmission.get(submission.id) ?? null;
      return {
        id: submission.id,
        planId: submission.implementation_plan_id,
        title: submission.title,
        note: submission.note,
        filename: submission.original_filename,
        mimeType: submission.mime_type,
        sizeBytes:
          submission.size_bytes === null ? null : Number(submission.size_bytes),
        status: submission.status,
        createdAt: submission.created_at,
        viewUrl: viewUrls.get(submission.id) ?? null,
        assessment: assessment
          ? {
              state: assessment.assessment_state,
              summary: assessment.summary,
              provider: assessment.provider,
              model: assessment.model,
              promptVersion: assessment.prompt_version,
              createdAt: assessment.created_at,
            }
          : null,
        matches: links
          .filter((link) => link.evidence_submission_id === submission.id)
          .map((link) => ({
            requirementId: link.evidence_requirement_id,
            role: link.link_role,
            confidence: Number(link.match_confidence),
            sufficiencyScore: Number(link.sufficiency_score),
            whatItProves: link.what_it_proves,
            gaps: Array.isArray(link.gaps) ? link.gaps : [],
          })),
      };
    }),
    reviewPreparations: preparations.map((item) => ({
      reviewScheduleId: item.review_schedule_id,
      planId: item.implementation_plan_id,
      requiredCount: item.required_count,
      acceptedCount: item.accepted_count,
      coveragePercent: Number(item.coverage_percent),
      readiness: item.readiness,
      evidenceSummary: item.evidence_summary,
      evidenceGaps: Array.isArray(item.evidence_gaps) ? item.evidence_gaps : [],
      preparedAt: item.prepared_at,
    })),
  };
}

export interface PreparedEvidenceUpload {
  submissionId: string;
  bucket: string;
  path: string;
  token: string;
}

export async function prepareKhposEvidenceUpload(
  organisationId: string,
  userId: string,
  planId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): Promise<PreparedEvidenceUpload> {
  const workspace = await getKhposImplementationWorkspace(
    organisationId,
    userId,
  );
  planFor(workspace, planId);

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new KhposEvidenceError(
      "Use a PDF, JPG, PNG, WebP image or plain-text evidence file.",
      415,
    );
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_EVIDENCE_BYTES) {
    throw new KhposEvidenceError("Evidence files must be 8 MB or smaller.", 413);
  }

  const client = admin();
  const submissionId = randomUUID();
  const filename = safeFilename(fileName);
  const path = `${organisationId}/${planId}/${submissionId}/${filename}`;

  const { error: insertError } = await client
    .from("khpos_evidence_submissions")
    .insert({
      id: submissionId,
      organisation_id: organisationId,
      implementation_plan_id: planId,
      submitted_by: userId,
      source_type: "file",
      title: fileName.trim() || "Evidence submission",
      storage_bucket: EVIDENCE_BUCKET,
      storage_path: path,
      original_filename: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      status: "awaiting_upload",
    });
  if (insertError) {
    throw new KhposEvidenceError("Evidence upload could not be prepared.", 500);
  }

  const { data, error } = await client.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data?.token) {
    await client.from("khpos_evidence_submissions").delete().eq("id", submissionId);
    throw new KhposEvidenceError("Secure evidence upload could not be prepared.", 500);
  }

  return {
    submissionId,
    bucket: EVIDENCE_BUCKET,
    path,
    token: data.token,
  };
}

const EvidenceAiSchema = z.object({
  summary: z.string().min(20),
  matches: z
    .array(
      z.object({
        requirementId: z.string().uuid(),
        confidence: z.number().min(0).max(100),
        sufficiencyScore: z.number().min(0).max(100),
        whatItProves: z.string().min(8),
        gaps: z.array(z.string()).max(6),
      }),
    )
    .max(3),
});

type EvidenceAiResult = z.infer<typeof EvidenceAiSchema>;

function evidencePrompt(plan: KhposImplementationPlan, note: string): string {
  return `You are the KHP-OS evidence assessor for school transformation.
Your job is to inspect ONE submitted evidence file and decide which generated evidence requirements it apparently supports.

IMPORTANT EPISTEMIC RULES
- Assess relevance and sufficiency only. Never claim the file is unquestionably authentic.
- Do not reward a document merely because its filename sounds relevant.
- Strong evidence should demonstrate implementation or an outcome, not only intention.
- If the evidence is ambiguous, incomplete, generic, unreadable or merely activity without proof of the requirement, score it conservatively.
- Use only requirement IDs supplied below. Return no matches if the file is irrelevant.
- A confidence >=70 and sufficiencyScore >=80 is the threshold KHP-OS uses for progress acceptance.
- Up to 3 requirements may be supported by one file.

INTERVENTION
${plan.intervention.title}
Objective: ${plan.objective}
Linked priority: ${plan.priority.title}
Linked KSHC indicator: ${plan.priority.indicatorId} (${plan.priority.indicatorScore}/5)

GENERATED ACTIONS
${plan.actions.map((a) => `${a.sequence}. ${a.title}: ${a.description}`).join("\n")}

GENERATED MILESTONES
${plan.milestones.map((m) => `${m.sequence}. ${m.title}: ${m.successSignal}`).join("\n")}

EVIDENCE REQUIREMENTS
${JSON.stringify(
  plan.evidenceRequirements.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    evidenceType: r.evidenceType,
    status: r.status,
  })),
  null,
  2,
)}

OPTIONAL SUBMITTER NOTE
${note.trim() || "No note supplied."}

Return STRICT JSON only:
{
  "summary": "A concise professional assessment of what this file apparently demonstrates and any important limitation.",
  "matches": [
    {
      "requirementId": "exact UUID from the list",
      "confidence": 0,
      "sufficiencyScore": 0,
      "whatItProves": "What the evidence apparently demonstrates for this requirement.",
      "gaps": ["Anything still missing or unclear"]
    }
  ]
}`;
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function assessWithOpenAI(
  plan: KhposImplementationPlan,
  filename: string,
  mimeType: string,
  buffer: Buffer,
  note: string,
): Promise<{ result: EvidenceAiResult; provider: string; model: string | null }> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      result: conservativeFallback(plan, filename, note),
      provider: "system_fallback",
      model: null,
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = evidencePrompt(plan, note);

  try {
    const response = mimeType.startsWith("image/")
      ? await openai.responses.create({
          model: EVIDENCE_MODEL,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: prompt },
                {
                  type: "input_image",
                  image_url: `data:${mimeType};base64,${buffer.toString("base64")}`,
                  detail: "auto",
                },
              ],
            },
          ],
        })
      : await openai.responses.create({
          model: EVIDENCE_MODEL,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: prompt },
                {
                  type: "input_file",
                  filename,
                  file_data: buffer.toString("base64"),
                },
              ],
            },
          ],
        });

    const parsed = EvidenceAiSchema.safeParse(
      JSON.parse(stripJsonFence(response.output_text || "{}")),
    );
    if (!parsed.success) throw new Error("Evidence AI returned an invalid contract.");

    const validRequirementIds = new Set(plan.evidenceRequirements.map((r) => r.id));
    const filtered = {
      ...parsed.data,
      matches: parsed.data.matches.filter((m) => validRequirementIds.has(m.requirementId)),
    };
    return { result: filtered, provider: "openai", model: EVIDENCE_MODEL };
  } catch (error) {
    console.error("[khpos] evidence AI assessment failed; using conservative fallback:", error);
    return {
      result: conservativeFallback(plan, filename, note),
      provider: "system_fallback",
      model: null,
    };
  }
}

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4),
  );
}

function conservativeFallback(
  plan: KhposImplementationPlan,
  filename: string,
  note: string,
): EvidenceAiResult {
  const sourceWords = words(`${filename} ${note}`);
  const ranked = plan.evidenceRequirements
    .map((requirement) => {
      const targetWords = words(
        `${requirement.title} ${requirement.description} ${requirement.evidenceType}`,
      );
      let overlap = 0;
      for (const word of sourceWords) if (targetWords.has(word)) overlap += 1;
      return { requirement, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap);

  const best = ranked[0];
  if (!best || best.overlap === 0) {
    return {
      summary:
        "KHP-OS could not confidently determine what this evidence proves without the evidence-analysis model. The file remains preserved and requires clarification rather than being falsely accepted.",
      matches: [],
    };
  }

  return {
    summary:
      "KHP-OS found a possible requirement match from the filename or submitter note, but did not have sufficient machine understanding of the file contents to accept it for progress.",
    matches: [
      {
        requirementId: best.requirement.id,
        confidence: Math.min(60, 30 + best.overlap * 8),
        sufficiencyScore: Math.min(65, 35 + best.overlap * 7),
        whatItProves: `This submission may support ${best.requirement.title}, but its contents still need stronger machine assessment or clearer evidence.`,
        gaps: ["Evidence contents were not confidently assessed; clarification is required."],
      },
    ],
  };
}

export async function assessKhposEvidenceSubmission(
  organisationId: string,
  userId: string,
  submissionId: string,
  note: string,
): Promise<KhposEvidenceWorkspace> {
  const implementation = await getKhposImplementationWorkspace(
    organisationId,
    userId,
  );
  const client = admin();
  const { data, error } = await client
    .from("khpos_evidence_submissions")
    .select(
      "id,organisation_id,implementation_plan_id,storage_bucket,storage_path,original_filename,mime_type,status",
    )
    .eq("id", submissionId)
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (error || !data) {
    throw new KhposEvidenceError("Evidence submission not found.", 404);
  }

  const plan = planFor(implementation, data.implementation_plan_id as string);
  const storagePath = data.storage_path as string | null;
  const filename = (data.original_filename as string | null) ?? "evidence";
  const mimeType = (data.mime_type as string | null) ?? "application/octet-stream";
  if (!storagePath) {
    throw new KhposEvidenceError("Evidence file is missing.", 400);
  }

  const { data: fileBlob, error: downloadError } = await client.storage
    .from(EVIDENCE_BUCKET)
    .download(storagePath);
  if (downloadError || !fileBlob) {
    throw new KhposEvidenceError(
      "The evidence file has not finished uploading. Try again after the upload completes.",
      409,
    );
  }

  await client
    .from("khpos_evidence_submissions")
    .update({ note: note.trim() || null, status: "analyzing", updated_at: new Date().toISOString() })
    .eq("id", submissionId);

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const assessment = await assessWithOpenAI(
    plan,
    filename,
    mimeType,
    buffer,
    note,
  );

  const { error: rpcError } = await client.rpc(
    "khpos_record_evidence_assessment_server",
    {
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_submission_id: submissionId,
      p_summary: assessment.result.summary,
      p_matches: assessment.result.matches,
      p_provider: assessment.provider,
      p_model: assessment.model,
      p_prompt_version: EVIDENCE_PROMPT_VERSION,
    },
  );
  if (rpcError) {
    await client
      .from("khpos_evidence_submissions")
      .update({ status: "needs_clarification", updated_at: new Date().toISOString() })
      .eq("id", submissionId);
    throw new KhposEvidenceError("Evidence assessment could not be recorded.", 500);
  }

  return getKhposEvidenceWorkspace(organisationId, userId);
}

export const KHPOS_EVIDENCE_BUCKET = EVIDENCE_BUCKET;
export const KHPOS_EVIDENCE_MAX_BYTES = MAX_EVIDENCE_BYTES;
