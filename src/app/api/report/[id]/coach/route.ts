import { NextRequest } from "next/server";
import { z } from "zod";
import { buildCoachSystemPrompt, streamCoachReply } from "@/lib/ai";
import { getReport } from "@/lib/storage";
import { badRequest, clientIp, notFound, serverError, UUID_RE } from "@/lib/http";
import type { CoachMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Lightweight in-memory rate limit: 30 coach messages per 10 minutes per IP. */
const buckets = new Map<string, { count: number; reset: number }>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset < now) {
    buckets.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    return true;
  }
  if (b.count >= 30) return false;
  b.count += 1;
  return true;
}

const BodySchema = z.object({
  message: z.string().trim().min(2).max(600),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(12)
    .optional()
    .default([]),
});

/** AI Coach chat — streams plaintext tokens with the report as context. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound("Report not found.");
  if (!allowed(clientIp(req))) {
    return new Response("You have sent many questions in a short time. Please pause for a few minutes and try again.", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body.");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return badRequest("Please ask a question (up to 600 characters).");

  try {
    const stored = await getReport(id);
    if (!stored) return notFound("Report not found.");

    const history: CoachMessage[] = parsed.data.history.slice(-8);
    const system = buildCoachSystemPrompt(stored.school, stored.report);
    const stream = await streamCoachReply(
      system,
      history,
      parsed.data.message,
      stored.report,
    );

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[kaec] coach failed:", err);
    return serverError("The coach is unavailable right now. Please try again.");
  }
}
