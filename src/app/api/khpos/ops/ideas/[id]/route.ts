import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";

const postSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  anonymous: z.boolean(),
  recipient: z.uuid().nullable(),
  parent: z.uuid().nullable(),
});
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };

async function handle(request: Request, { params }: Context) {
  const { id } = await params;
  if (id !== "hq" && !UUID_RE.test(id)) return NextResponse.json({ error: "Board not found." }, { status: 404, headers });
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to open this board.");
    const actor = await verifyKhposAccessToken(token);
    const isPost = request.method === "POST";
    const raw = isPost ? await request.text() : "";
    if (raw.length > 25000) return NextResponse.json({ error: "Post is too long." }, { status: 413, headers });
    const parsed = isPost ? postSchema.parse(JSON.parse(raw)) : null;
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.rpc("khpos_ideas_server", {
      p_actor: actor.id, p_org: id === "hq" ? null : id,
      p_mode: isPost ? "post" : "list", p_body: parsed?.body ?? null,
      p_anonymous: parsed?.anonymous ?? false, p_recipient: parsed?.recipient ?? null,
      p_parent: parsed?.parent ?? null,
    });
    if (error) {
      if (error.code === "42501") return NextResponse.json({ error: "You do not have access to this discussion." }, { status: 403, headers });
      if (error.code === "22023") return NextResponse.json({ error: error.message }, { status: 400, headers });
      console.error("Ideas board request failed", error.code);
      throw new Error("Board request failed");
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof KhposAuthError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof SyntaxError || error instanceof z.ZodError) return NextResponse.json({ error: "Check your post and try again." }, { status: 400, headers });
    return NextResponse.json({ error: "The board could not be loaded or saved. Try again." }, { status: 500, headers });
  }
}

export const GET = handle;
export const POST = handle;
