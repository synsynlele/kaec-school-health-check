import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bearerTokenFromRequest, verifyKhposAccessToken, KhposAuthError } from "@/lib/khpos/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 try {
  const token = bearerTokenFromRequest(request);
  if (!token) throw new KhposAuthError("Sign in to continue.");
  const user = await verifyKhposAccessToken(token);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: member, error } = await db.from("kaec_hq_members").select("status").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!member) throw new KhposAuthError("An active KAEC HQ appointment is required.", 403);
  const { data: schools, error: schoolError } = await db.from("organisations").select("id,name").eq("status", "active").eq("partner_status", "active").contains("partner_entitlements", ["khpos_core"]).order("name").limit(1000);
  if (schoolError) throw schoolError;
  return NextResponse.json({ schools }, { headers: { "Cache-Control": "private, no-store" } });
 } catch (error) {
  return NextResponse.json({ error: error instanceof KhposAuthError ? error.message : "Could not load meeting workspaces." }, { status: error instanceof KhposAuthError ? error.status : 500, headers: { "Cache-Control": "private, no-store" } });
 }
}
