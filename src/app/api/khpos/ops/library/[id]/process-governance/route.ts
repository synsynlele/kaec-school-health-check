import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { getProcessGovernance, governProcess } from "@/lib/khpos/ops/library";

export const runtime = "nodejs";

function failure(error: unknown) {
  const detail = error as { status?: number; message?: string };
  const status =
    detail.status && detail.status >= 400 && detail.status < 500
      ? detail.status
      : 500;
  if (status === 500) {
    console.error("[khpos][process-governance] operation failed:", error);
  }
  return NextResponse.json(
    {
      ok: false,
      error: status === 500 ? "Process operation failed." : detail.message,
    },
    { status },
  );
}

async function identity(request: Request) {
  const token = bearerTokenFromRequest(request);
  if (!token) throw { status: 401, message: "Sign in to continue." };
  return verifyKhposAccessToken(token);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: "School not found." },
      { status: 404 },
    );
  }

  try {
    const user = await identity(request);
    return NextResponse.json(
      { ok: true, ...(await getProcessGovernance(id, user.id)) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: "School not found." },
      { status: 404 },
    );
  }

  try {
    const user = await identity(request);
    const body = await request.json() as {
      processId?: string;
      action?: string;
      input?: Record<string, unknown>;
    };

    if (
      !body.processId ||
      !UUID_RE.test(body.processId) ||
      !["save", "submit", "return", "approve"].includes(body.action ?? "") ||
      !body.input ||
      typeof body.input !== "object" ||
      Array.isArray(body.input)
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid process request." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        ...(await governProcess(
          id,
          user.id,
          body.processId,
          body.action as "save" | "submit" | "return" | "approve",
          body.input,
        )),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
