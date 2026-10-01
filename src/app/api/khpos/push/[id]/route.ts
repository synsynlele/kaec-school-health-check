import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  assertKhposPushAccess,
  disablePushEndpoint,
  getKhposVapidPublicKey,
  savePushSubscription,
  type PushSubscriptionInput,
} from "@/lib/khpos/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function identity(request: Request, context: Context) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    throw { status: 404, message: "School not found." };
  }

  const token = bearerTokenFromRequest(request);
  if (!token) throw { status: 401, message: "Sign in to continue." };
  const user = await verifyKhposAccessToken(token);
  return { organisationId: id, userId: user.id };
}

function failure(error: unknown) {
  const detail = error as { status?: number; message?: string };
  const message = detail?.message || "Device alert operation failed.";
  const status =
    detail?.status ??
    (/sign in/i.test(message)
      ? 401
      : /access is required/i.test(message)
        ? 403
        : /not configured/i.test(message)
          ? 503
          : 400);

  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request, context: Context) {
  try {
    const { organisationId, userId } = await identity(request, context);
    await assertKhposPushAccess(organisationId, userId);
    return NextResponse.json(
      { ok: true, publicKey: await getKhposVapidPublicKey() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { organisationId, userId } = await identity(request, context);
    const body = (await request.json()) as PushSubscriptionInput;

    await savePushSubscription(
      organisationId,
      userId,
      body,
      request.headers.get("user-agent"),
    );

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { organisationId, userId } = await identity(request, context);
    await assertKhposPushAccess(organisationId, userId);

    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint || typeof body.endpoint !== "string") {
      return NextResponse.json(
        { ok: false, error: "Push endpoint is required." },
        { status: 400 },
      );
    }

    await disablePushEndpoint(userId, body.endpoint);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
