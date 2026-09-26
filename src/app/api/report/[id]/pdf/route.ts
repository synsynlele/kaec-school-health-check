import { buildReportPdf } from "@/lib/pdf";
import { getReport } from "@/lib/storage";
import { notFound, serverError, UUID_RE } from "@/lib/http";
import { canAccessKshcAssessment, kshcUserFromRequest } from "@/lib/kshc-access";

export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Downloadable, print-ready School Health Report PDF. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound("Report not found.");
  const user = await kshcUserFromRequest(req);
  if (!user) return new Response("Sign in to download your report.", { status: 401 });
  if (!(await canAccessKshcAssessment(id, user.email))) return notFound("Report not found.");

  try {
    const stored = await getReport(id);
    if (!stored) return notFound("Report not found.");

    const bytes = await buildReportPdf(stored.report, stored.school);
    const filename = `KAEC-School-Health-Report-${slugify(stored.school.schoolName)}.pdf`;

    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("[kaec] pdf build failed:", err);
    return serverError("Could not build the PDF. Please try again.");
  }
}
