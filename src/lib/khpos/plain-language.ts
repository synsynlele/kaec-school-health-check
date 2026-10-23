/** Display labels only. Stored statuses, identifiers and permission rules never change. */
const labels: Record<string,string> = {
  pending: "Pending", in_progress: "In progress", awaiting_verification: "Waiting for review",
  pending_acknowledgement: "Waiting for acceptance", awaiting_acknowledgement: "Waiting for acceptance",
  under_review: "Being reviewed", awaiting_approval: "Waiting for approval", pending_approval: "Waiting for approval",
  returned: "Needs changes", verified: "Checked", approved: "Approved", acknowledged: "Accepted",
  draft: "Draft", active: "Active", inactive: "Inactive", disabled: "Disabled", ended: "Ended", paused: "Paused",
  published: "Published", completed: "Completed", closed: "Closed", resolved: "Resolved",
  manual_on_demand: "Start when needed", recurring: "Repeated on a schedule", continuous_control: "Ongoing check",
  external_system: "Managed in another app", event: "Starts after an event", condition: "Starts when a condition is met",
  role_charter: "Role guide", process_guide: "Step-by-step procedure", recurring_rule: "Repeated task schedule",
  accountable: "Responsible", consulted: "Ask for advice", informed: "Keep updated", supporting: "Helps with the work",
  kpi: "Progress measure", matrix: "Who does what", verification: "Review", escalation: "Ask for help",
  baseline_only: "Recording starting results", baseline: "Starting point", ai_assisted: "Adapted with AI",
  check_in: "Check in", check_out: "Check out", readiness: "Ready-to-start checks", onboarding: "Getting started",
};
export function plainLabel(value: string | null | undefined): string {
  if (value == null || value === "") return "Not set";
  return labels[value.toLowerCase()] ?? value.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ");
}
