import { NextResponse } from "next/server";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { getKhposAlerts } from "@/lib/khpos/notifications";
import { UUID_RE } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  const token = bearerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  try {
    const user = await verifyKhposAccessToken(token);
    const alerts = await getKhposAlerts(id, user.id);
    return NextResponse.json(
      { alerts: alerts.slice(0, 50), total: alerts.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[khpos][notifications] failed", error);
    return NextResponse.json(
      { error: "Notifications could not be loaded." },
      { status: 403 },
    );
  }
}
