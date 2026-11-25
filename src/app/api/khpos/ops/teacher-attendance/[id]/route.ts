import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { teacherAttendance } from "@/lib/khpos/ops/teacher-attendance";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return json({ error: "School not found." }, 404);
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) return json({ error: "Sign in first." }, 401);
    const user = await verifyKhposAccessToken(token);
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "Request too large." }, 413);
    const body = JSON.parse(raw);
    if (!body || !["list", "policy", "override", "review"].includes(body.action) ||
        !body.input || typeof body.input !== "object" || Array.isArray(body.input)) {
      return json({ error: "Choose a valid attendance action." }, 400);
    }
    const { data, error } = await teacherAttendance(user.id, id, body.action, body.input);
    if (!error) return json({ result: data });
    if (error.code === "42501") return json({ error: "Only the School Guardian can manage these settings." }, 403);
    if (/^(22|23)/.test(error.code)) return json({ error: "Check the attendance settings and try again." }, 400);
    return json({ error: "Teacher attendance is temporarily unavailable." }, 503);
  } catch (error) {
    if (error instanceof KhposAuthError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "Enter a valid request." }, 400);
    return json({ error: "Teacher attendance is temporarily unavailable." }, 503);
  }
}
