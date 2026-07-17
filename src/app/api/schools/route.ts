import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSchoolAssessment } from "@/lib/storage";
import { badRequest, serverError } from "@/lib/http";

export const runtime = "nodejs";

const SchoolSchema = z.object({
  schoolName: z.string().trim().min(2, "School name is required").max(140),
  contactName: z.string().trim().min(2, "Contact name is required").max(140),
  email: z.string().trim().email("A valid email is required").max(160),
  phone: z.string().trim().max(40).optional().default(""),
  country: z.string().trim().min(2, "Country is required").max(80),
  state: z.string().trim().min(1, "State / region is required").max(80),
  schoolType: z.string().trim().min(2, "School type is required").max(80),
  schoolLevel: z.string().trim().min(1, "School level is required").max(80),
  studentPopulation: z.string().trim().min(1, "Student population is required").max(40),
  staffPopulation: z.string().trim().min(1, "Staff population is required").max(40),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const parsed = SchoolSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
  }

  try {
    const ids = await createSchoolAssessment(parsed.data);
    return NextResponse.json({ ok: true, ...ids });
  } catch (err) {
    console.error("[kaec] create school failed:", err);
    return serverError("We could not start your assessment. Please try again.");
  }
}
