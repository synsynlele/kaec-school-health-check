import { notFound, redirect } from "next/navigation";
import { UUID_RE } from "@/lib/http";

/** Keep historical URLs and meeting invitations functional without
 * maintaining duplicate user-facing workspaces. All destinations are fixed
 * internal paths; existing school and API permissions remain unchanged.
 */
export function redirectLegacySchoolWorkspace(
  organisationId: string,
  destination: "announcements" | "calendar" | "reports" | "parents" | "priorities" | "performance",
  view: string,
  search: Record<string, string | string[] | undefined> = {},
): never {
  if (!UUID_RE.test(organisationId)) notFound();
  const query = new URLSearchParams({ view });
  for (const [key, value] of Object.entries(search)) {
    if (key === "view" || key.length > 40 || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key)) continue;
    const text = Array.isArray(value) ? value[0] : value;
    if (typeof text === "string" && text.length <= 500) query.set(key, text);
  }
  redirect("/khpos/" + organisationId + "/" + destination + "?" + query.toString());
}
