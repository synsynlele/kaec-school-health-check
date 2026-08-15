import { NextResponse } from "next/server";
import {
  openAiConfigurationStatus,
  probeOpenAiConnection,
} from "@/lib/kshc-ai-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsProbe = url.searchParams.get("probe") === "1";
  const config = openAiConfigurationStatus();

  if (!wantsProbe) {
    return NextResponse.json(
      { ok: true, ai: config },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        ai: config,
        error: "Live AI probing is disabled on the public production health endpoint.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const probe = await probeOpenAiConnection();
  return NextResponse.json(
    { ok: probe.ok, ai: probe },
    {
      status: probe.ok ? 200 : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
