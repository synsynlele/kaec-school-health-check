import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { learnerRegister } from "@/lib/khpos/ops/learner-register";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return json({ error: "School not found." }, 404);
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) return json({ error: "Sign in to open the learner register." }, 401);
    const user = await verifyKhposAccessToken(token);
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "Request too large." }, 413);
    const body = JSON.parse(raw);
    if (!body || !["roster", "mark", "schedule", "assign"].includes(body.action) ||
        !body.input || typeof body.input !== "object" || Array.isArray(body.input)) {
      return json({ error: "Choose a valid register action." }, 400);
    }
    const { data, error } = await learnerRegister(user.id, id, body.action, body.input);
    if (!error) return json({ result: data });
    if (error.code === "42501") return json({ error: "Your role does not permit this register action." }, 403);
    if (error.code === "22023") return json({ error: error.message }, 409);
    if (/^(22|23)/.test(error.code)) return json({ error: "Check the register details and try again." }, 400);
    console.error("[khpos] learner register failed", error.code);
    return json({ error: "The learner register is temporarily unavailable." }, 503);
  } catch (error) {
    if (error instanceof KhposAuthError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "Enter a valid register request." }, 400);
    return json({ error: "The learner register is temporarily unavailable." }, 503);
  }
}
