import { NextResponse } from "next/server";
import { openAiConfigurationStatus } from "@/lib/kshc-ai-report";
import { storageBackend } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "kaec-school-health-check",
    backend: storageBackend(),
    ai: openAiConfigurationStatus(),
    time: new Date().toISOString(),
  });
}
