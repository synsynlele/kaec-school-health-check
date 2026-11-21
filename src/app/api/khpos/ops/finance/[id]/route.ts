import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const surfaces = {
  register: ["context", "catalog", "learners", "saveLearner", "previewLearners", "importLearners"],
  ledger: ["controls", "setThreshold", "periods", "accounts", "invoices", "entries", "schedules", "requests", "reconciliations", "audit",
    "invoice", "receipt", "statement", "previewOpening", "importOpening", "openPeriod", "addAccount", "closePeriod", "reopenPeriod", "saveSchedule",
    "billSchedule", "billLearner", "post", "approveRequest", "returnRequest", "reconcile"],
  report: ["attention", "overview", "annual", "aged", "budget", "source", "saveBudget", "prepareStatement", "obligations", "addObligation", "settleObligation"],
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return json({ error: "School not found." }, 404);

  try {
    const token = bearerTokenFromRequest(request);
    if (!token) return json({ error: "Sign in to open School Finance." }, 401);
    const user = await verifyKhposAccessToken(token);
    if (Number(request.headers.get("content-length")) > 128_000) return json({ error: "This finance request is too large." }, 413);
    const raw = await request.text();
    if (raw.length > 128_000) return json({ error: "This finance request is too large." }, 413);
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return json({ error: "Enter a valid finance request." }, 400); }
    if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "Enter a valid finance request." }, 400);
    const { surface, action, campus, input = {} } = data as Record<string, unknown>;
    if (typeof surface !== "string" || !Object.hasOwn(surfaces, surface) || typeof action !== "string" ||
      !(surfaces[surface as keyof typeof surfaces] as readonly string[]).includes(action) ||
      !(campus === null || (typeof campus === "string" && UUID_RE.test(campus))) ||
      !input || typeof input !== "object" || Array.isArray(input)) {
      return json({ error: "Choose a valid finance action and campus." }, 400);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return json({ error: "School Finance is temporarily unavailable." }, 503);
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: result, error } = await db.rpc("khpos_finance_" + surface + "_server", {
      p_actor: user.id, p_school: id, p_campus: campus, p_action: action, p_input: input,
    });
    if (!error) return json({ result });
    if (error.code === "42501") return json({ error: "Your school or campus appointment does not permit this finance action." }, 403);
    if (error.code === "22023") return json({ error: error.message }, 400);
    if (error.code === "23505") return json({ error: "This reference or record is already in use. Check the existing records." }, 409);
    if (error.code === "23P01") return json({ error: "A Financial Health statement already covers part or all of these dates." }, 409);
    if (["22007", "22008", "22003", "22P02", "23514", "23502", "23503"].includes(error.code)) {
      return json({ error: "Check the required fields, dates, amounts and selections." }, 400);
    }
    console.error("[khpos] school finance database action failed", surface, action, error.code);
    return json({ error: "School Finance could not complete this action. You can safely retry." }, 503);
  } catch (error) {
    if (error instanceof KhposAuthError) return json({ error: error.message }, error.status);
    console.error("[khpos] school finance request failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "School Finance could not complete this request." }, 503);
  }
}
