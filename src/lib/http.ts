import { NextResponse } from "next/server";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function badRequest(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong. Please try again.") {
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}
