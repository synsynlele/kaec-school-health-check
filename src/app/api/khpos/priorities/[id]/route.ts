import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  approveKhposPriority,
  archiveKhposPriority,
  getKhposPriorityWorkspace,
  KhposPriorityError,
} from "@/lib/khpos/priorities";

export const runtime = "nodejs";

function responseForError(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposPriorityError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos] priority workspace operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "The transformation agenda could not be updated." },
    { status: 500 },
  );
}

async function authenticatedUser(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    throw new KhposAuthError("Sign in to continue.", 401);
  }
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
    const workspace = await getKhposPriorityWorkspace(id, user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return responseForError(error);
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
    action?: "approve" | "archive";
    indicatorId?: string;
    priorityId?: string;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid transformation-agenda request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);

    if (payload.action === "approve") {
      const indicatorId = payload.indicatorId?.trim() ?? "";
      if (!/^[a-z_]+_\d+$/.test(indicatorId)) {
        throw new KhposPriorityError("Select a valid KSHC priority.", 400);
      }
      await approveKhposPriority(id, user.id, indicatorId);
    } else if (payload.action === "archive") {
      const priorityId = payload.priorityId?.trim() ?? "";
      if (!UUID_RE.test(priorityId)) {
        throw new KhposPriorityError("Active priority not found.", 404);
      }
      await archiveKhposPriority(id, user.id, priorityId);
    } else {
      throw new KhposPriorityError(
        "Choose whether to approve or archive a priority.",
        400,
      );
    }

    const workspace = await getKhposPriorityWorkspace(id, user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return responseForError(error);
  }
}
