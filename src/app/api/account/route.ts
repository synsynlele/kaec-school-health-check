import { NextResponse } from "next/server";
import { isFutureIssuedJwtMessage, retryFutureIssuedJwtTask } from "@/lib/khpos/ops/retry-transient-auth";
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
    const { partnerships, platformAdmin, visibleAssessments, sharedReports } =
      await retryFutureIssuedJwtTask(async () => {
        // A safe account read may briefly encounter PostgREST clock skew.
        // Never refresh, modify or bypass the verified user's JWT here.
        const [partnerships, platformAdmin, assessments] = await Promise.all([
          getUserPartnerships(user.id),
          getKhposPlatformAccess(user.id),
          listAssessmentsForEmail(user.email),
        ]);
        const visibleAssessments = await filterKshcOwnedAssessments(user.id, partnerships, assessments);
        const sharedReports = (await listKshcLeadershipReports(user.id, partnerships))
          .filter((report) => !visibleAssessments.some((assessment) => assessment.id === report.id));
        return { partnerships, platformAdmin, visibleAssessments, sharedReports };
      });
    return NextResponse.json(
      { ok: true, account: { email: user.email }, partnerships, platformAdmin, assessments: visibleAssessments, sharedReports },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && isFutureIssuedJwtMessage(error.message)) {
      console.warn("[kshc][account] Supabase token clock-validation failure");
      return NextResponse.json(
        { ok: false, error: "Supabase is temporarily rejecting fresh sessions. Your account is safe. Please try opening your account again. If it persists, contact KAEC support." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }
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
