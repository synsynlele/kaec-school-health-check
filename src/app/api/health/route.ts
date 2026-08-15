import { NextResponse } from "next/server";
import {
  openAiConfigurationStatus,
  probeOpenAiConnection,
} from "@/lib/kshc-ai-report";
import { storageBackend } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsProbe = url.searchParams.get("probe") === "1";
  const ai = openAiConfigurationStatus();

  if (wantsProbe && process.env.VERCEL_ENV !== "production") {
    const probe = await probeOpenAiConnection();
    return NextResponse.json(
      {
        ok: probe.ok,
        service: "kaec-school-health-check",
        backend: storageBackend(),
        ai: probe,
        time: new Date().toISOString(),
      },
      {
        status: probe.ok ? 200 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      service: "kaec-school-health-check",
      backend: storageBackend(),
      ai,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
