import { NextResponse } from "next/server";
import { storageBackend } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "kaec-school-health-check",
    backend: storageBackend(),
    time: new Date().toISOString(),
  });
}
