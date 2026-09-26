import { NextResponse } from "next/server";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { KSHC_SESSION_COOKIE } from "@/lib/kshc-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = bearerTokenFromRequest(request);
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    await verifyKhposAccessToken(token);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(KSHC_SESSION_COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(KSHC_SESSION_COOKIE);
  return response;
}
