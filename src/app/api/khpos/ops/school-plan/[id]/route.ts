import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { lagosLocalDay } from "@/lib/khpos/ops/attendance-guidance";
import { planKinds } from "@/lib/khpos/ops/school-plan-types";
import { KhposPresenceError, verifyTeachingPreviewIsolation } from "@/lib/khpos/ops/presence";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id: z.uuid().nullable(), kind: z.enum(Object.keys(planKinds) as [keyof typeof planKinds, ...(keyof typeof planKinds)[]]),
    title: z.string().trim().min(1).max(120), campusId: z.uuid().nullable(), staffId: z.uuid().nullable(),
    assessmentId: z.uuid().nullable(), startDay: z.iso.date().nullable(), endDay: z.iso.date().nullable(), published: z.boolean() }),
  z.object({ action: z.literal("remove"), id: z.uuid() }),
  z.object({ action: z.literal("rule"), id: z.uuid(), dayMode: z.enum(["scheduled", "teaching", "staff"]) }),
]);
const headers = { "Cache-Control": "private, no-store" };

async function handle(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "School not found." }, { status: 404, headers });
  try {
    verifyTeachingPreviewIsolation();
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to open the school plan.", 401);
    const actor = await verifyKhposAccessToken(token);
    const url = new URL(request.url);
    const today = lagosLocalDay(Date.now());
    const todayOnly = url.searchParams.get("today") === "1" && request.method === "GET";
    const from = todayOnly ? today : z.iso.date().parse(url.searchParams.get("from") ?? today.slice(0, 8) + "01");
    const to = todayOnly ? today : new Date(Date.parse(from) + 91 * 86400000).toISOString().slice(0, 10);
    const input = request.method === "POST" ? mutation.parse(await request.json()) : null;
    if (input?.action === "save" && (
      (input.kind === "invigilation") !== Boolean(input.assessmentId) ||
      (input.kind === "invigilation" || input.kind === "weekly_duty") !== Boolean(input.staffId)
    )) return NextResponse.json({ error: "Choose the required staff member and assessment." }, { status: 400, headers });
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await db.rpc("khpos_school_plan_server", { p_actor: actor.id, p_org: id, p_from: from, p_to: to, p_input: input, p_today: todayOnly });
    if (error?.code === "42501" || error?.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400, headers });
    }
    if (error) throw new Error("School plan request failed");
    return NextResponse.json({ plan: data }, { headers });
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposPresenceError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Check the school plan details." }, { status: 400, headers });
    return NextResponse.json({ error: "The school plan could not be loaded or saved." }, { status: 500, headers });
  }
}
export const GET = handle;
export const POST = handle;
