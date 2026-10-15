import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bearerTokenFromRequest, verifyKhposAccessToken, KhposAuthError } from "@/lib/khpos/auth";
import { UUID_RE } from "@/lib/http";
export const dynamic = "force-dynamic";
function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Schools & Campuses is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } }); }
async function handle(request: Request, mutate: boolean) {
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(token);
    const org = new URL(request.url).searchParams.get("organisationId");
    if (org !== null && !UUID_RE.test(org)) return response({ error: "Invalid school." }, 400);
    const db = service();
    if (mutate) {
      const input = await request.json();
      if (!input || typeof input !== "object" || Array.isArray(input) || !["submit", "withdraw", "approve", "reject", "activate"].includes(input.mode)) return response({ error: "Invalid campus request action." }, 400);
      const review = ["approve", "reject", "activate"].includes(input.mode);
      if ((review && org !== null) || (!review && org === null)) return response({ error: "Use the appropriate school or KAEC workspace." }, 403);
      if (review && user.aal !== "aal2") throw new KhposAuthError("Verify administrator MFA before reviewing or activating campuses.", 403);
      const target = org ?? input.organisationId;
      if (typeof target !== "string" || !UUID_RE.test(target)) return response({ error: "Invalid school." }, 400);
      const { error } = await db.rpc("khpos_ops_campus_request_action_server", { p_actor: user.id, p_org: target, p_mode: input.mode, p_input: input });
      if (error) return response({ error: error.message }, 400);
    }
    const { data, error } = await db.rpc("khpos_ops_schools_campuses_server", { p_actor: user.id, p_org: org });
    if (error) return response({ error: error.message }, 403);
    return response({ directory: data });
  } catch (cause) { return response({ error: cause instanceof Error ? cause.message : "Schools & Campuses could not load." }, cause instanceof KhposAuthError ? cause.status : 500); }
}
export async function GET(request: Request) { return handle(request, false); }
export async function POST(request: Request) { return handle(request, true); }
