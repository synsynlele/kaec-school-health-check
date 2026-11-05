import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";

import { KhposPresenceError, verifyTeachingPreviewIsolation } from "@/lib/khpos/ops/presence";

const date = z.iso.date();
const payload = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("add"), from: date, streamId: z.uuid(), kind: z.enum(["test", "assessment", "exam"]),
    title: z.string().trim().min(1).max(120), startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }) }),
  z.object({ mode: z.enum(["start", "finish", "mark"]), from: date, id: z.uuid() }),
  z.object({ mode: z.literal("submit"), from: date, id: z.uuid(), recipient: z.string().trim().min(1).max(120) }),
]);
const headers = { "Cache-Control": "private, no-store" };

async function handle(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "School not found." }, { status: 404, headers });
  try {
    verifyTeachingPreviewIsolation();
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to view the assessment timetable.");
    const actor = await verifyKhposAccessToken(token);
    const input = request.method === "POST" ? payload.parse(await request.json())
      : { mode: "list", from: date.parse(new URL(request.url).searchParams.get("from")) };
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await db.rpc("khpos_assessment_timetable_server", { p_actor: actor.id, p_org: id, p_mode: input.mode, p_input: input });
    if (error) {
      if (error.code === "42501") return NextResponse.json({ error: error.message }, { status: 403, headers });
      if (error.code === "22023") return NextResponse.json({ error: error.message }, { status: 400, headers });
      if (error.code === "23505") return NextResponse.json({ error: "That assignment already has an assessment at this time." }, { status: 409, headers });
      throw new Error("Assessment timetable request failed");
    }
    return NextResponse.json({ entries: data }, { headers });
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposPresenceError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Check the timetable details." }, { status: 400, headers });
    return NextResponse.json({ error: "The timetable could not be loaded or saved." }, { status: 500, headers });
  }
}
export const GET = handle;
export const POST = handle;
