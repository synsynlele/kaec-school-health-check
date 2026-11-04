import { MEET_JOIN_URL } from "./call-plan";

/** Uses the consenting host's short-lived provider token; no token storage or refresh grants. */
export async function createGoogleMeetParts(token: string, count: number, request: typeof fetch = fetch) {
  if (!Number.isInteger(count) || count < 1 || count > 6 || !token || token.length > 4096) {
    throw Object.assign(new Error("Choose between one and six call parts."), { status: 400 });
  }
  const links: string[] = [];
  for (let index = 0; index < count; index++) {
    let response: Response;
    try { response = await request("https://meet.googleapis.com/v2/spaces", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ config: { accessType: "RESTRICTED" } }), cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    } catch {
      throw Object.assign(new Error("Google did not respond in time. Completed links are retained below; add the rest or try again."), { status: 504, links });
    }
    // Do not log the response, token, or provider error payload.
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? "Connect Google with meeting permission. The Google Meet API must also be enabled for the sign-in project. You can paste prepared links instead."
        : "Google could not prepare every call part. Any completed links are retained below; add the remaining links or try again.";
      throw Object.assign(new Error(message), { status: response.status === 429 ? 429 : 400, links });
    }
    let body: { meetingUri?: string };
    try { body = await response.json(); } catch {
      throw Object.assign(new Error("Google returned an unreadable response. Add the remaining links manually."), { status: 502, links });
    }
    if (!body.meetingUri || !MEET_JOIN_URL.test(body.meetingUri) || links.includes(body.meetingUri)) {
      throw Object.assign(new Error("Google returned an invalid or duplicate joining link. Add the remaining links manually."), { status: 502, links });
    }
    links.push(body.meetingUri);
  }
  return links;
}
