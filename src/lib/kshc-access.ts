import { cookies } from "next/headers";
import { bearerTokenFromRequest, verifyKhposAccessToken, type VerifiedKhposUser } from "@/lib/khpos/auth";
import { getAssessmentState } from "@/lib/storage";

export const KSHC_SESSION_COOKIE = "kshc_session";

export async function kshcUserFromRequest(request: Request): Promise<VerifiedKhposUser | null> {
  const token = bearerTokenFromRequest(request) ?? (await cookies()).get(KSHC_SESSION_COOKIE)?.value;
  if (!token) return null;
  try { return await verifyKhposAccessToken(token); } catch { return null; }
}

export async function kshcUserFromCookie(): Promise<VerifiedKhposUser | null> {
  const token = (await cookies()).get(KSHC_SESSION_COOKIE)?.value;
  if (!token) return null;
  try { return await verifyKhposAccessToken(token); } catch { return null; }
}

export async function canAccessKshcAssessment(id: string, email: string): Promise<boolean> {
  const state = await getAssessmentState(id);
  return Boolean(state && state.school.email.trim().toLowerCase() === email.trim().toLowerCase());
}
