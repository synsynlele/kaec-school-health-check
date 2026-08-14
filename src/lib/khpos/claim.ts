const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class KhposClaimError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "KhposClaimError";
  }
}

export async function claimKshcAssessment(
  assessmentId: string,
  user: { id: string; email: string },
): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposClaimError("KHP-OS activation is not configured.", 503);
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/claim_kshc_assessment_server`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_assessment_id: assessmentId,
        p_user_id: user.id,
        p_verified_email: user.email,
      }),
      cache: "no-store",
    },
  );

  const body = await response.text();
  if (!response.ok) {
    let message = "This assessment could not be activated.";
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message?.includes("email does not match")) {
        message = "Use the same Google or email account used for this KSHC assessment.";
      } else if (parsed.message?.includes("completed report")) {
        message = "Complete the KSHC report before activating KHP-OS.";
      } else if (parsed.message?.includes("Assessment not found")) {
        message = "Assessment not found.";
      } else if (parsed.message?.includes("verified user")) {
        message = "Your verified account could not be confirmed.";
      }
    } catch {
      // Keep the safe public message.
    }
    throw new KhposClaimError(message, 400);
  }

  let organisationId = body.replace(/^"|"$/g, "");
  try {
    const parsed = JSON.parse(body) as unknown;
    if (typeof parsed === "string") organisationId = parsed;
  } catch {
    // PostgREST may return a bare UUID string.
  }

  if (!organisationId) {
    throw new KhposClaimError("KHP-OS activation returned no organisation.", 500);
  }

  return organisationId;
}
