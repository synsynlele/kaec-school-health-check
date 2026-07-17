import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { QUESTION_INDEX, RATING_OPTIONS } from "@/lib/questions";
import { getAssessmentState, saveAnswers } from "@/lib/storage";
import { badRequest, notFound, serverError, UUID_RE } from "@/lib/http";
import type { AnswerRecord } from "@/lib/types";

export const runtime = "nodejs";

const BatchSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().max(40),
        score: z.number().int().min(1).max(5),
      }),
    )
    .min(1)
    .max(60),
});

/** Autosave endpoint — upserts answers; safe to call repeatedly & offline-flush. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound("Assessment not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body.");
  }
  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Answers could not be understood.");

  /* Server derives chapter & label — the client only sends id + score. */
  const records: AnswerRecord[] = [];
  for (const a of parsed.data.answers) {
    const q = QUESTION_INDEX[a.questionId];
    if (!q) continue;
    records.push({
      questionId: a.questionId,
      chapter: q.chapter,
      score: a.score,
      answer: RATING_OPTIONS.find((r) => r.value === a.score)?.label ?? String(a.score),
    });
  }
  if (!records.length) return badRequest("No valid answers supplied.");

  try {
    const state = await getAssessmentState(id);
    if (!state) return notFound("Assessment not found.");
    if (state.completed) return NextResponse.json({ ok: true, saved: 0, completed: true });
    await saveAnswers(id, records);
    return NextResponse.json({ ok: true, saved: records.length });
  } catch (err) {
    console.error("[kaec] save answers failed:", err);
    return serverError("Could not save. Your answers are kept on this device — we will retry.");
  }
}
