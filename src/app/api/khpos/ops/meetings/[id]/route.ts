import { NextResponse } from "next/server";
import { z } from "zod";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { meetingOperation } from "@/lib/khpos/ops/meetings";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const text = z.string().trim().min(1).max(4000);
const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("delete"), meetingId: z.uuid(), confirmed: z.literal(true) }),
  z.object({ mode: z.literal("start_call"), meetingId: z.uuid(), part: z.number().int().min(1).max(6) }),
  z.object({ mode: z.literal("create"), title: text.max(160), agenda: text, startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), callUrl: z.string().max(300).refine(v => !v || /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(v), "Use a Google Meet joining link."), callParts: z.array(z.string().regex(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/)).max(6).optional(), participants: z.array(z.uuid()).min(1).max(50) }),
  z.object({ mode: z.literal("message"), meetingId: z.uuid(), id: z.uuid(), body: text }),
  z.object({ mode: z.literal("decision"), meetingId: z.uuid(), id: z.uuid(), body: text }),
  z.object({ mode: z.literal("action"), meetingId: z.uuid(), id: z.uuid(), title: text.max(160), ownerId: z.uuid(), dueAt: z.iso.datetime() }),
  z.object({ mode: z.literal("status"), meetingId: z.uuid(), status: z.enum(["live", "closed", "cancelled"]) }),
]);
async function handle(request: Request, context: { params: Promise<{id: string}> }, post: boolean) {
  try {
    const { id } = await context.params;
    if (id !== "hq" && !UUID_RE.test(id)) return NextResponse.json({error: "School not found."}, {status:404});
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.");
    const user = await verifyKhposAccessToken(token);
    let mode = "list"; let input: Record<string, unknown> = {};
    if (post) {
      if (Number(request.headers.get("content-length") || 0) > 25000) return NextResponse.json({error:"Meeting request is too large."},{status:413});
      const raw = await request.text();
      if (raw.length > 25000) return NextResponse.json({error:"Meeting request is too large."},{status:413});
      const result = schema.safeParse(JSON.parse(raw));
      if (!result.success) return NextResponse.json({error:result.error.issues[0]?.message || "Check the meeting details."},{status:400});
      mode = result.data.mode; input = result.data;
    } else {
      const meetingId = new URL(request.url).searchParams.get("meeting");
      if (meetingId) { if (!UUID_RE.test(meetingId)) return NextResponse.json({error:"Invalid meeting."},{status:400}); input = {meetingId}; }
    }
    return NextResponse.json({ok:true, workspace:await meetingOperation(user.id,id,mode,input)}, {headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    const status = error instanceof KhposAuthError ? error.status : (error && typeof error === "object" && "status" in error ? Number(error.status) : 500);
    return NextResponse.json({error:error instanceof SyntaxError ? "Check the meeting details." : error instanceof Error ? error.message : "Meeting request failed."},{status:error instanceof SyntaxError ? 400 : status});
  }
}
export const GET = (r: Request,c: {params:Promise<{id:string}>}) => handle(r,c,false);
export const POST = (r: Request,c: {params:Promise<{id:string}>}) => handle(r,c,true);
