import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { KhposPresenceError, verifyTeachingPreviewIsolation } from "@/lib/khpos/ops/presence";

const entry = z.object({
  campusId: z.uuid().nullable(),
  label: z.string().trim().min(1).max(120),
  section: z.string().trim().max(120),
}).refine(value => value.campusId !== null || value.section === "");
const mutation = z.union([
  entry,
  z.object({ action: z.literal("edit"), id: z.uuid(), label: z.string().trim().min(1).max(120), section: z.string().trim().max(120) }),
  z.object({ action: z.literal("availability"), id: z.uuid(), available: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.uuid() }),
]);
const headers = { "Cache-Control": "private, no-store" };

async function handle(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "School not found." }, { status: 404, headers });
  try {
    verifyTeachingPreviewIsolation();
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to view classes and subjects.");
    const actor = await verifyKhposAccessToken(token);
    const input = request.method === "POST" ? mutation.parse(await request.json()) : null;
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await db.rpc("khpos_class_subject_catalog_server", { p_actor: actor.id, p_org: id, p_input: input });
    if (error?.code === "42501" || error?.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400, headers });
    }
    if (error?.code === "23505") return NextResponse.json({ error: "That name already exists in this list." }, { status: 409, headers });
    if (error) throw new Error("Classes and subjects request failed");
    return NextResponse.json({ entries: data }, { headers });
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposPresenceError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Check the class or subject details." }, { status: 400, headers });
    return NextResponse.json({ error: "Classes and subjects could not be loaded or saved." }, { status: 500, headers });
  }
}
export const GET = handle;
export const POST = handle;
