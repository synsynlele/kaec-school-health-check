import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";

const input = z.object({ kind: z.enum(["lesson", "assessment"]), sourceId: z.uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const school = z.uuid().parse((await params).id);
    const token = bearerTokenFromRequest(request);
    if (!token) return Response.json({ error: "Sign in to publish the timetable." }, { status: 401 });
    const actor = await verifyKhposAccessToken(token);
    const entry = input.parse(await request.json());
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await db.rpc("khpos_publish_learner_timetable", {
      p_actor: actor.id, p_school: school, p_kind: entry.kind, p_id: entry.sourceId,
    });
    if (error?.code === "42501") return Response.json({ error: error.message }, { status: 403 });
    if (error?.code === "22023") return Response.json({ error: error.message }, { status: 400 });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof KhposAuthError) return Response.json({ error: error.message }, { status: error.status });
    const invalid = error instanceof z.ZodError || error instanceof SyntaxError;
    return Response.json({ error: invalid ? "Check the timetable entry." : "The timetable could not be published." }, { status: invalid ? 400 : 503 });
  }
}
