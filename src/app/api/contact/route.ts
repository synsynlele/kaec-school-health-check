import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createContactRequest } from "@/lib/storage";
import { badRequest, serverError } from "@/lib/http";

export const runtime = "nodejs";

const ContactSchema = z.object({
  name: z.string().trim().min(2, "Your name is required").max(140),
  email: z.string().trim().email("A valid email is required").max(160),
  schoolName: z.string().trim().max(140).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  requestType: z
    .enum(["consultation", "training", "talk", "general"])
    .optional()
    .default("general"),
  message: z.string().trim().min(5, "Please tell us a little about what you need").max(4000),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
  }

  try {
    const id = await createContactRequest(parsed.data);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[kaec] contact request failed:", err);
    return serverError("We could not send your message. Please try again.");
  }
}
