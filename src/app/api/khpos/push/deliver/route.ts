import { NextResponse } from "next/server";
import {
  deliverKhposPushReminders,
  verifyKhposPushCronAuthorization,
} from "@/lib/khpos/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const authorized = await verifyKhposPushCronAuthorization(
      request.headers.get("authorization"),
    );
    if (!authorized) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const result = await deliverKhposPushReminders();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[khpos][push-cron] failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "Push delivery run failed." },
      { status: 500 },
    );
  }
}
