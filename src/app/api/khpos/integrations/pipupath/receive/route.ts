import { NextResponse } from "next/server";
import {
  ingestPipupathSignal,
  KhposPipupathIntegrationError,
  pairPipupathAndStoreInitialSignal,
  type PipupathSignalPayload,
} from "@/lib/khpos/pipupath-integration";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16_384;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function validSignal(value: unknown): value is PipupathSignalPayload {
  if (!value || typeof value !== "object") return false;
  const signal = value as Record<string, unknown>;
  const integerKeys = [
    "cohortMemberCount",
    "activeProfileCount",
    "pathSelectedCount",
    "questParticipantCount",
    "evidenceBackedQuestParticipantCount",
    "projectParticipantCount",
    "projectCompletionParticipantCount",
    "continuationEligibleCount",
    "continuingCycleParticipantCount",
  ];
  return signal.contractVersion === "1.0" &&
    typeof signal.externalCohortId === "string" && signal.externalCohortId.length >= 8 && signal.externalCohortId.length <= 160 &&
    typeof signal.sourceGeneratedAt === "string" && typeof signal.windowStart === "string" && typeof signal.windowEnd === "string" &&
    typeof signal.reportingEligible === "boolean" &&
    integerKeys.every((key) => Number.isInteger(signal[key]) && Number(signal[key]) >= 0);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return bad("PipuPath integration payload is too large.", 413);
  }

  let payload: {
    action?: "pair" | "sync";
    pairingToken?: string;
    syncToken?: string;
    cohortName?: string;
    invitationUrl?: string;
    signal?: unknown;
  } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return bad("Invalid PipuPath integration payload.");
  }

  if (!validSignal(payload.signal)) return bad("Invalid PipuPath aggregate signal contract.");

  try {
    if (payload.action === "pair") {
      const pairingToken = payload.pairingToken?.trim() ?? "";
      const cohortName = payload.cohortName?.trim() ?? "";
      const invitationUrl = payload.invitationUrl?.trim() ?? "";
      if (pairingToken.length < 32 || cohortName.length < 2 || cohortName.length > 160 || invitationUrl.length < 12 || invitationUrl.length > 500) {
        return bad("Invalid PipuPath pairing request.");
      }
      const result = await pairPipupathAndStoreInitialSignal({ pairingToken, cohortName, invitationUrl, signal: payload.signal });
      return NextResponse.json({ ok: true, organisationId: result.organisationId });
    }

    if (payload.action === "sync") {
      const syncToken = payload.syncToken?.trim() ?? "";
      if (syncToken.length < 32) return bad("Invalid PipuPath sync request.");
      await ingestPipupathSignal(syncToken, payload.signal);
      return NextResponse.json({ ok: true, accepted: true });
    }

    return bad("Choose a valid PipuPath integration operation.");
  } catch (error) {
    if (error instanceof KhposPipupathIntegrationError) {
      return bad(error.message, error.status);
    }
    console.error("[khpos] PipuPath signal receiver failed:", error);
    return bad("PipuPath signal could not be accepted.", 500);
  }
}
