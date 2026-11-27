import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const scope = z.object({
  workspace: z.uuid(), campus: z.uuid(), classLabel: z.string().trim().min(1).max(120),
  section: z.string().trim().max(120), subjects: z.array(z.string().trim().min(1).max(160)).max(100),
  session: z.string().regex(/^\d{4}\/\d{4}$/),
});

export async function POST(request: Request) {
  const key = process.env.KSI_TIMETABLE_BRIDGE_KEY?.trim();
  const provided = request.headers.get("authorization") ?? "";
  const expected = Buffer.from("Bearer " + key);
  const actual = Buffer.from(provided);
  if (!key || key.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Timetable connection required." }, { status: 403 });
  }
  const raw = await request.text();
  if (raw.length > 24000) return new Response(null, { status: 413 });
  const result = scope.safeParse(await Promise.resolve().then(() => JSON.parse(raw)).catch(() => null));
  if (!result.success) return Response.json({ error: "Invalid timetable scope." }, { status: 400 });
  const data = result.data;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: entries, error } = await db.rpc("khpos_read_learner_timetable", {
    p_workspace: data.workspace, p_campus: data.campus, p_class: data.classLabel,
    p_section: data.section, p_subjects: data.subjects.map(subject => subject.toLowerCase()), p_session: data.session,
  });
  if (error) return Response.json({ error: "Timetable unavailable." }, { status: 503 });
  return Response.json({ entries }, { headers: { "Cache-Control": "private, no-store" } });
}
