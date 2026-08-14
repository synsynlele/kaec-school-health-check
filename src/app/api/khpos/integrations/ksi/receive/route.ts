import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ingestKsiSignal,
  KHPOS_KSI_CONTRACT_VERSION,
  KhposKsiIntegrationError,
  pairKsiAndStoreInitialSignal,
} from "@/lib/khpos/ksi-integration";

export const runtime = "nodejs";

const count = z.number().int().min(0).max(1_000_000);
const signalSchema = z.object({
  contractVersion: z.literal(KHPOS_KSI_CONTRACT_VERSION),
  externalWorkspaceId: z.string().trim().min(8).max(160),
  sourceGeneratedAt: z.string().datetime({ offset: true }),
  windowStart: z.string().datetime({ offset: true }),
  windowEnd: z.string().datetime({ offset: true }),
  lessonCount: count,
  validatedLessonCount: count,
  fidelityCheckCount: count,
  fidelityPassCount: count,
  fidelityAverageScore: z.number().min(0).max(100).nullable(),
  assessmentCount: count,
  validatedAssessmentCount: count,
  assessmentFromLessonCount: count,
  diagnosisCount: count,
  finalDiagnosisCount: count,
  confirmedInterventionCount: count,
  linkedNextLessonCount: count,
}).superRefine((value, ctx) => {
  const pairs: Array<[number, number, string]> = [
    [value.validatedLessonCount, value.lessonCount, "validatedLessonCount"],
    [value.fidelityPassCount, value.fidelityCheckCount, "fidelityPassCount"],
    [value.validatedAssessmentCount, value.assessmentCount, "validatedAssessmentCount"],
    [value.assessmentFromLessonCount, value.assessmentCount, "assessmentFromLessonCount"],
    [value.finalDiagnosisCount, value.diagnosisCount, "finalDiagnosisCount"],
    [value.linkedNextLessonCount, value.confirmedInterventionCount, "linkedNextLessonCount"],
  ];
  for (const [part, total, path] of pairs) {
    if (part > total) ctx.addIssue({ code: "custom", path: [path], message: "Aggregate count cannot exceed its total." });
  }
});

const pairSchema = z.object({
  action: z.literal("pair"),
  pairingToken: z.string().trim().min(32).max(128),
  workspaceName: z.string().trim().min(1).max(160),
  externalActor: z.string().trim().min(1).max(160),
  signal: signalSchema,
});
const syncSchema = z.object({
  action: z.literal("sync"),
  connectorToken: z.string().trim().min(48).max(160),
  signal: signalSchema,
});
const requestSchema = z.discriminatedUnion("action", [pairSchema, syncSchema]);

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 16_384) {
    return NextResponse.json({ ok: false, error: "KSI signal payload is too large." }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid KSI signal payload." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "KSI signal payload failed validation." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "pair") {
      const paired = await pairKsiAndStoreInitialSignal({
        pairingToken: parsed.data.pairingToken,
        workspaceName: parsed.data.workspaceName,
        externalActor: parsed.data.externalActor,
        signal: parsed.data.signal,
      });
      return NextResponse.json({
        ok: true,
        connectorToken: paired.connectorToken,
        organisationId: paired.organisationId,
        contractVersion: KHPOS_KSI_CONTRACT_VERSION,
      });
    }

    await ingestKsiSignal(parsed.data.connectorToken, parsed.data.signal);
    return NextResponse.json({ ok: true, accepted: true, contractVersion: KHPOS_KSI_CONTRACT_VERSION });
  } catch (error) {
    if (error instanceof KhposKsiIntegrationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[khpos] KSI signal receiver failed");
    return NextResponse.json({ ok: false, error: "KSI signal could not be accepted." }, { status: 500 });
  }
}
