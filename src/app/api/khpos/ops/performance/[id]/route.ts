import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  configureKhposOpsKpiTarget,
  createKhposOpsKpi,
  getKhposOpsPerformance,
  KhposOpsPerformanceError,
  recordKhposOpsKpiMeasurement,
  retireKhposOpsKpi,
  type KhposOpsCreateKpiInput,
  type KhposOpsKpiDirection,
} from "@/lib/khpos/ops/performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOpsPerformanceError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] performance operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Performance operation could not be completed." },
    { status: 500 },
  );
}

async function authenticatedUser(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(accessToken);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: "School workspace not found." },
      { status: 404 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const performance = await getKhposOpsPerformance(id, user.id);
    return NextResponse.json(
      { ok: true, performance },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: "School workspace not found." },
      { status: 404 },
    );
  }

  let payload: {
    mode?: "create_kpi" | "record_measurement" | "configure_target" | "retire";
    kpi?: KhposOpsCreateKpiInput;
    kpiId?: string;
    periodStart?: string;
    periodEnd?: string;
    value?: number;
    note?: string | null;
    evidenceReference?: string | null;
    direction?: KhposOpsKpiDirection;
    targetConfig?: Record<string, unknown>;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid performance request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);

    if (payload.mode === "create_kpi" && payload.kpi) {
      const kpi = payload.kpi;
      if (
        !kpi.code?.trim() ||
        !kpi.name?.trim() ||
        !kpi.domain?.trim() ||
        !kpi.definition?.trim() ||
        !kpi.ownerRoleId ||
        !UUID_RE.test(kpi.ownerRoleId)
      ) {
        return NextResponse.json(
          { ok: false, error: "Complete the KPI definition and owner." },
          { status: 400 },
        );
      }

      for (const value of [kpi.scopeRoleId, kpi.campusId, kpi.unitId]) {
        if (value && !UUID_RE.test(value)) {
          return NextResponse.json(
            { ok: false, error: "One of the KPI scope identifiers is invalid." },
            { status: 400 },
          );
        }
      }

      const performance = await createKhposOpsKpi(id, user.id, {
        ...kpi,
        code: kpi.code.trim(),
        name: kpi.name.trim(),
        domain: kpi.domain.trim(),
        definition: kpi.definition.trim(),
      });
      return NextResponse.json({ ok: true, performance });
    }

    if (
      payload.mode === "record_measurement" &&
      payload.kpiId &&
      UUID_RE.test(payload.kpiId) &&
      payload.periodStart &&
      payload.periodEnd &&
      typeof payload.value === "number" &&
      Number.isFinite(payload.value)
    ) {
      const performance = await recordKhposOpsKpiMeasurement(id, user.id, {
        kpiId: payload.kpiId,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        value: payload.value,
        note: payload.note?.trim() || null,
        evidenceReference: payload.evidenceReference?.trim() || null,
      });
      return NextResponse.json({ ok: true, performance });
    }

    if (
      payload.mode === "configure_target" &&
      payload.kpiId &&
      UUID_RE.test(payload.kpiId) &&
      payload.direction &&
      payload.targetConfig
    ) {
      const performance = await configureKhposOpsKpiTarget(id, user.id, {
        kpiId: payload.kpiId,
        direction: payload.direction,
        targetConfig: payload.targetConfig,
        note: payload.note?.trim() || null,
      });
      return NextResponse.json({ ok: true, performance });
    }

    if (
      payload.mode === "retire" &&
      payload.kpiId &&
      UUID_RE.test(payload.kpiId) &&
      payload.note?.trim()
    ) {
      const performance = await retireKhposOpsKpi(
        id,
        user.id,
        payload.kpiId,
        payload.note.trim(),
      );
      return NextResponse.json({ ok: true, performance });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported performance request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
