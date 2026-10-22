import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  verifyKhposAccessToken,
  KhposAuthError,
} from "@/lib/khpos/auth";
import {
  getReports,
  reportAction,
  getReportAttention,
} from "@/lib/khpos/reports";
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
      throw new KhposAuthError("Sign in to open School Reports.", 401);
    const user = await verifyKhposAccessToken(token),
      url = new URL(request.url),
      school = url.searchParams.get("school");
    if (!school || !UUID_RE.test(school))
      return reply({ error: "Select a valid school." }, 400);
    if (!write && url.searchParams.get("summary") === "1") {
      const attention = await getReportAttention(school, user.id);
      return reply({
        workspace: {
          summary: attention.summary,
          tasks: attention.items,
          items: [],
          types: [],
          roles: [],
          recipients: [],
          scopes: [],
          history: [],
          total: 0,
        },
      });
    }
    let id: string | undefined;
    if (write) {
      if (Number(request.headers.get("content-length") || 0) > 150000)
        return reply({ error: "Report request is too large." }, 413);
      const raw = await request.text();
      if (raw.length > 150000)
        return reply({ error: "Report request is too large." }, 413);
      const body: unknown = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return reply({ error: "Invalid report action." }, 400);
      const input = body as Record<string, unknown>;
      if (
        typeof input.mode !== "string" ||
        ![
          "type_save",
          "type_status",
          "create",
          "save",
          "submit",
          "withdraw",
          "accept",
          "return",
        ].includes(input.mode)
      )
        return reply({ error: "Invalid report action." }, 400);
      for (const key of [
        "id",
        "typeId",
        "assignmentId",
        "ownerRoleId",
        "reviewerRoleId",
        "campusId",
        "unitId",
      ]) {
        if (
          input[key] != null &&
          input[key] !== "" &&
          (typeof input[key] !== "string" ||
            !UUID_RE.test(input[key] as string))
        )
          return reply({ error: "Invalid report or role reference." }, 400);
      }
      id = await reportAction(user.id, school, input.mode, input);
    }
    const report = url.searchParams.get("report");
    if (report && !UUID_RE.test(report))
      return reply({ error: "Invalid report reference." }, 400);
    const type = url.searchParams.get("type"),
      from = url.searchParams.get("from"),
      to = url.searchParams.get("to");
    if (type && !UUID_RE.test(type))
      return reply({ error: "Invalid report type." }, 400);
    if ([from, to].some((d) => d && !/^\d{4}-\d{2}-\d{2}$/.test(d)))
      return reply({ error: "Use a valid reporting date." }, 400);
    const offset = Number(url.searchParams.get("offset") || 0);
    return reply({
      id,
      workspace: await getReports(user.id, school, {
        view: url.searchParams.get("view") === "review" ? "review" : "mine",
        query: (url.searchParams.get("q") || "").slice(0, 160),
        status: url.searchParams.get("status") || "",
        offset: Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0,
        report,
        type: type || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    });
  } catch (cause) {
    return reply(
      {
        error:
          cause instanceof Error ? cause.message : "Reports could not load.",
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
