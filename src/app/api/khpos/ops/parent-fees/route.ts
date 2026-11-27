import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { rosterServiceClient } from "@/lib/khpos/roster-schedule";

const input = z.object({
  workspace: z.uuid(),
  learners: z.array(z.object({ id: z.uuid(), school: z.uuid().nullable(), learner: z.uuid().nullable() })).max(30),
});

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const key = process.env.KSI_ROSTER_BRIDGE_KEY?.trim();
  const expected = Buffer.from("Bearer " + key);
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  if (!key || key.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: "Unavailable." }, { status: 403, headers });
  }
  const raw = await request.text();
  if (raw.length > 8192) return Response.json({ error: "Request too large." }, { status: 413, headers });
  const parsed = input.safeParse(await Promise.resolve().then(() => JSON.parse(raw)).catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400, headers });
  const { data, error } = await rosterServiceClient().rpc("khpos_parent_fee_totals", {
    p_workspace: parsed.data.workspace, p_learners: parsed.data.learners,
  });
  return Response.json(error ? { error: "Fees unavailable." } : { fees: data }, { status: error ? 503 : 200, headers });
}
