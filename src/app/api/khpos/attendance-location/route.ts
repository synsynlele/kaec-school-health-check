import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken, KhposAuthError } from "@/lib/khpos/auth";
import { KhposPresenceError } from "@/lib/khpos/ops/presence";
import { SchoolDeskError } from "@/lib/khpos/hq-schools";
import { campusLocations } from "@/lib/khpos/attendance-location-server";
export const dynamic = "force-dynamic";
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } }); }
async function handle(request: Request, save: boolean) {
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(token);
    const params = new URL(request.url).searchParams, school = params.get("school") ?? "";
    if (!UUID_RE.test(school)) throw new KhposPresenceError("Select a valid school.");
    // Match the existing teaching preview isolation boundary.
    if (process.env.VERCEL_ENV === "preview") {
      const ref = process.env.KHPOS_TEACHING_PREVIEW_DB_REF;
      if (!ref || ref === "rlpciatblisxnuuiekkf" || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`)
        throw new KhposPresenceError("Attendance location preview requires an isolated database.", 503);
    }
    let input: Record<string, unknown> | undefined;
    if (save) {
      const text = await request.text();
      if (text.length > 2500) throw new KhposPresenceError("Campus location request is too long.");
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== "object" || Array.isArray(raw) || !UUID_RE.test(raw.campusId ?? "")) throw new KhposPresenceError("Provide a valid campus location.");
      input = raw;
    }
    return json({ ok: true, campuses: await campusLocations(user, school, params.get("context") === "hq", input) });
  } catch (e) {
    if (e instanceof KhposAuthError || e instanceof KhposPresenceError || e instanceof SchoolDeskError) return json({ ok: false, error: e.message }, e.status);
    if (e instanceof SyntaxError) return json({ ok: false, error: "Invalid location request." }, 400);
    return json({ ok: false, error: "Attendance location could not be processed." }, 500);
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
