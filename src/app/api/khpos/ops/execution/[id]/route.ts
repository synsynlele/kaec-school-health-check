import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  applySafeKhposExecutionMappings,
  configureKhposExecution,
  getKhposExecutionSnapshot,
  KhposExecutionError,
  startKhposManualProcess,
  type ConfigureKhposExecutionInput,
} from "@/lib/khpos/ops/execution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposExecutionError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] execution control failed:", error);
  return NextResponse.json(
    { ok: false, error: "Execution control could not be loaded." },
    { status: 500 },
  );
}

async function actor(request: Request) {
  const token = bearerTokenFromRequest(request);
  if (!token) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(token);
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
    const user = await actor(request);
    const execution = await getKhposExecutionSnapshot(id, user.id);
    return NextResponse.json(
      { ok: true, execution },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
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
    const user = await actor(request);
    const input = (await request.json()) as ConfigureKhposExecutionInput;
    if (!input?.processId || !UUID_RE.test(input.processId)) {
      return NextResponse.json(
        { ok: false, error: "A valid controlled process is required." },
        { status: 400 },
      );
    }

    const execution = await configureKhposExecution(id, user.id, input);
    return NextResponse.json({ ok: true, execution });
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

  try {
    const user = await actor(request);
    const body = (await request.json()) as {
      action?: string;
      processId?: string;
      campusId?: string | null;
      unitId?: string | null;
    };

    if (body.action === "apply_safe_mappings") {
      const result = await applySafeKhposExecutionMappings(id, user.id);
      return NextResponse.json({
        ok: true,
        execution: result.execution,
        mapping: result.result,
      });
    }

    if (body.action === "start_manual") {
      if (!body.processId || !UUID_RE.test(body.processId)) {
        return NextResponse.json(
          { ok: false, error: "A valid controlled process is required." },
          { status: 400 },
        );
      }

      if (body.campusId && !UUID_RE.test(body.campusId)) {
        return NextResponse.json(
          { ok: false, error: "A valid campus is required." },
          { status: 400 },
        );
      }

      if (body.unitId && !UUID_RE.test(body.unitId)) {
        return NextResponse.json(
          { ok: false, error: "A valid unit is required." },
          { status: 400 },
        );
      }

      const started = await startKhposManualProcess(id, user.id, {
        processId: body.processId,
        campusId: body.campusId ?? null,
        unitId: body.unitId ?? null,
      });

      return NextResponse.json({ ok: true, started });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported execution action." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
