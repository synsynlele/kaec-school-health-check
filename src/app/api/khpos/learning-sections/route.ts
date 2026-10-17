import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  verifyKhposAccessToken,
  KhposAuthError,
} from "@/lib/khpos/auth";
import {
  getLearningSections,
  saveLearningSection,
} from "@/lib/khpos/learning-sections";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function handle(request: Request, write: boolean) {
  try {
    const token = bearerTokenFromRequest(request);
    if (!token)
      throw new KhposAuthError("Sign in to manage school sections.", 401);
    const user = await verifyKhposAccessToken(token),
      school = new URL(request.url).searchParams.get("school");
    if (!school || !UUID_RE.test(school))
      return reply({ error: "Select a valid school." }, 400);
    if (write) {
      const raw = await request.text();
      if (raw.length > 10000)
        return reply({ error: "Section request is too large." }, 413);
      const body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return reply({ error: "Invalid section." }, 400);
      for (const key of ["id", "campusId"])
        if (body[key] != null && !UUID_RE.test(body[key]))
          return reply({ error: "Invalid section or campus reference." }, 400);
      await saveLearningSection(user.id, school, body);
    }
    return reply({ workspace: await getLearningSections(user.id, school) });
  } catch (cause) {
    return reply(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Learning sections could not load.",
      },
      cause instanceof KhposAuthError ? cause.status : 400,
    );
  }
}
export async function GET(request: Request) {
  return handle(request, false);
}
export async function POST(request: Request) {
  return handle(request, true);
}
