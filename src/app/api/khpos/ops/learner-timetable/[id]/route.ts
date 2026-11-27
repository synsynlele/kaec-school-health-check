import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";

const input = z.union([
  z.object({ kind: z.enum(["lesson", "assessment"]), sourceId: z.uuid() }),
  z.object({ action: z.enum(["publish", "unpublish"]).optional(), kind: z.literal("lesson"), campus: z.uuid().nullable() }),
  z.object({ action: z.enum(["publish", "unpublish"]).optional(), kind: z.literal("assessment"), from: z.iso.date(), to: z.iso.date() }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const school = z.uuid().parse((await params).id);
    const token = bearerTokenFromRequest(request);
    if (!token) return Response.json({ error: "Sign in to publish the timetable." }, { status: 401 });
    const actor = await verifyKhposAccessToken(token);
    const entry = input.parse(await request.json());
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const scope = { p_actor: actor.id, p_school: school, p_kind: entry.kind };
    const { data: count, error } = "sourceId" in entry
      ? await db.rpc("khpos_publish_learner_timetable", { ...scope, p_id: entry.sourceId })
      : await db.rpc(entry.action === "unpublish" ? "khpos_unpublish_learner_timetable_batch" : "khpos_publish_learner_timetable_batch", {
          ...scope,
          p_campus: entry.kind === "lesson" ? entry.campus : null,
          p_from: entry.kind === "assessment" ? entry.from : null,
          p_to: entry.kind === "assessment" ? entry.to : null,
        });
    if (error?.code === "42501") return Response.json({ error: error.message }, { status: 403 });
    if (error?.code === "22023") return Response.json({ error: error.message }, { status: 400 });
    if (error) throw error;
    return Response.json({ ok: true, count: count ?? 1 });
  } catch (error) {
    if (error instanceof KhposAuthError) return Response.json({ error: error.message }, { status: error.status });
    const invalid = error instanceof z.ZodError || error instanceof SyntaxError;
    return Response.json({ error: invalid ? "Check the timetable entry." : "The learner timetable could not be updated." }, { status: invalid ? 400 : 503 });
  }
}
