import { NextResponse } from "next/server";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getUserPartnerships,
  KhposPartnershipError,
} from "@/lib/khpos/partnership";
import { getKhposPlatformAccess } from "@/lib/khpos/platform-admin";
import { listAssessmentsForEmail } from "@/lib/storage";
import { filterKshcOwnedAssessments, listKshcLeadershipReports } from "@/lib/kshc-access";

export async function GET(request: Request) {
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(token);
    const [partnerships, platformAdmin, assessments] = await Promise.all([
      getUserPartnerships(user.id),
      getKhposPlatformAccess(user.id),
      listAssessmentsForEmail(user.email),
    ]);
    const visibleAssessments = await filterKshcOwnedAssessments(user.id, partnerships, assessments);
    const sharedReports = (await listKshcLeadershipReports(user.id, partnerships))
      .filter((report) => !visibleAssessments.some((assessment) => assessment.id === report.id));
    return NextResponse.json(
      { ok: true, account: { email: user.email }, partnerships, platformAdmin, assessments: visibleAssessments, sharedReports },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const status =
      error instanceof KhposAuthError || error instanceof KhposPartnershipError
        ? error.status
        : 500;
    const message = error instanceof Error ? error.message : "Account could not be loaded.";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
