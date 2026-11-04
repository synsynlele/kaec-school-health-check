import { MEET_JOIN_URL } from "./call-plan";

type GoogleMeetFailureCode = "meet_api_disabled" | "google_permission_missing" | "google_connection_expired" | "google_access_denied" | "google_quota" | "google_unavailable" | "invalid_google_response" | "invalid_request";

export class GoogleMeetPreparationError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: GoogleMeetFailureCode, public readonly links: string[] = [], public readonly setupUrl?: string) {
    super(message);
    this.name = "GoogleMeetPreparationError";
  }
}

async function googleFailure(response: Response, links: string[]) {
  // Read only known error fields. Never return Google's raw message, payload or tokens.
  let reasons: string[] = [];
  let consumer: string | undefined;
  try {
    const body = await response.json() as { error?: { details?: { "@type"?: string; domain?: string; reason?: string; metadata?: { consumer?: string; service?: string } }[]; errors?: { reason?: string }[] } };
    const details = Array.isArray(body.error?.details) ? body.error.details : [];
    const info = details.filter(item => item?.["@type"] === "type.googleapis.com/google.rpc.ErrorInfo" && item.domain === "googleapis.com");
    reasons = info.map(item => item.reason ?? "");
    const disabled = info.find(item => item.reason === "SERVICE_DISABLED" && item.metadata?.service === "meet.googleapis.com");
    consumer = disabled?.metadata?.consumer;
    if (Array.isArray(body.error?.errors)) reasons.push(...body.error.errors.map(item => item?.reason ?? ""));
  } catch { /* Status-only errors still receive a safe explanation. */ }

  if (reasons.includes("SERVICE_DISABLED") || reasons.includes("accessNotConfigured")) {
    const project = typeof consumer === "string" ? /^projects\/([0-9]{6,20})$/.exec(consumer)?.[1] : undefined;
    const setupUrl = "https://console.cloud.google.com/apis/library/meet.googleapis.com" + (project ? `?project=${project}` : "");
    return new GoogleMeetPreparationError("Google Meet API is switched off for the Google project connected to KHP-OS. Its administrator needs to enable the API, then try creating the links again.", 400, "meet_api_disabled", links, setupUrl);
  }
  if (response.status === 401) {
    return new GoogleMeetPreparationError("Your Google meeting connection has expired or is no longer valid. Choose Allow Google meeting creation again, then create the links.", 400, "google_connection_expired", links);
  }
  if (reasons.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") || reasons.includes("insufficientPermissions")) {
    return new GoogleMeetPreparationError("Google has not granted permission to create meetings. Choose Allow Google meeting creation again and approve meeting creation for your KHP-OS Google account.", 400, "google_permission_missing", links);
  }
  if (response.status === 403) {
    return new GoogleMeetPreparationError("Google denied permission to create the meeting. Ask the Google project administrator to check the account's test access and meeting permissions. Adding a tester alone does not enable the Meet API.", 400, "google_access_denied", links);
  }
  if (response.status === 429) {
    return new GoogleMeetPreparationError("Google's request limit has been reached. Keep the completed links and try creating the remaining links later, or paste prepared links.", 429, "google_quota", links);
  }
  return new GoogleMeetPreparationError("Google could not prepare every call part. Completed links are retained below; add the remaining links or try again.", 502, "google_unavailable", links);
}

/** Uses the consenting host's short-lived provider token; no token storage or refresh grants. */
export async function createGoogleMeetParts(token: string, count: number, request: typeof fetch = fetch) {
  if (!Number.isInteger(count) || count < 1 || count > 6 || !token || token.length > 4096) {
    throw new GoogleMeetPreparationError("Choose between one and six call parts.", 400, "invalid_request");
  }
  const links: string[] = [];
  for (let index = 0; index < count; index++) {
    let response: Response;
    try {
      response = await request("https://meet.googleapis.com/v2/spaces", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // Use Google’s documented minimal request and inherit the host’s call admission settings.
        body: "{}", cache: "no-store", signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new GoogleMeetPreparationError("Google did not respond in time. Completed links are retained below; add the rest or try again.", 504, "google_unavailable", links);
    }
    if (!response.ok) throw await googleFailure(response, links);
    let body: { meetingUri?: string };
    try { body = await response.json(); } catch {
      throw new GoogleMeetPreparationError("Google returned an unreadable response. Add the remaining links manually.", 502, "invalid_google_response", links);
    }
    if (!body.meetingUri || !MEET_JOIN_URL.test(body.meetingUri) || links.includes(body.meetingUri)) {
      throw new GoogleMeetPreparationError("Google returned an invalid or duplicate joining link. Add the remaining links manually.", 502, "invalid_google_response", links);
    }
    links.push(body.meetingUri);
  }
  return links;
}
