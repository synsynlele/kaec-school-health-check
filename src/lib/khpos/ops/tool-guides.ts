// User-facing guidance for existing workflows. These links do not create records or grant access.
export type ToolGuide = {
  when: string;
  steps: string[];
  destination: string;
  label: string;
  automatic?: boolean;
};
const guide = (
  when: string,
  destination: string,
  label: string,
  steps: string[],
  automatic = false,
): ToolGuide => ({ when, destination, label, steps, automatic });
const guides: Record<string, ToolGuide> = {
  role_charter: guide(
    "You need to understand a role’s duties, authority and reporting line.",
    "/team",
    "Open Team & Roles",
    [
      "Find the relevant role and read its charter.",
      "Check its responsibilities, expected results and who it reports to.",
      "Complete any role-specific onboarding assigned to you.",
    ],
  ),
  matrix: guide(
    "You need to know who owns, supports or reviews a process.",
    "/library?tab=processes",
    "Open processes",
    [
      "Open the relevant process and its responsibility map.",
      "Check the accountable role and supporting roles before starting work.",
      "Ask the authorised school leader to resolve an unclear assignment.",
    ],
  ),
  process_guide: guide(
    "You need the approved steps for a school activity.",
    "/library?tab=processes",
    "Open processes",
    [
      "Find the process and read its current approved version.",
      "Check the trigger, owner, steps, evidence and escalation route.",
      "Open your assigned work in Today to carry it out.",
    ],
  ),
  task: guide(
    "You have an assigned piece of work to complete.",
    "/work",
    "Open Today",
    [
      "Open your assigned work item and start it.",
      "Complete its checklist, reports and evidence where required.",
      "Submit for review or complete the work using the controls provided.",
    ],
  ),
  recurring_rule: guide(
    "A school leader needs an approved process to run on a repeated schedule.",
    "/execution-control",
    "Open Execution Control",
    [
      "Find the approved process and check its execution setup.",
      "Check the configured recurring rule, schedule, trigger and accountable role with an authorised school leader.",
      "Staff complete the work generated in Today; they do not recreate the schedule each time.",
    ],
  ),
  evidence: guide(
    "You need to show what was actually done or what result was achieved.",
    "/work",
    "Open assigned work",
    [
      "Open the related work item.",
      "Add a factual operating note or the evidence requested there.",
      "Complete any required review; adding evidence alone does not verify it.",
    ],
  ),
  issue: guide(
    "Something has gone wrong, work is blocked or a risk needs attention.",
    "/issues",
    "Open Issues & Escalations",
    [
      "Describe the problem, affected area and immediate action taken.",
      "Set the appropriate urgency and route it to the responsible role.",
      "Track the response, resolution and verification.",
    ],
  ),
  escalation: guide(
    "An issue needs higher authority or has not been resolved on time.",
    "/issues",
    "Open Issues & Escalations",
    [
      "Open the existing issue so its history stays together.",
      "Record the unresolved problem and the decision or support needed.",
      "Use the escalation controls available to your role.",
    ],
  ),
  approval: guide(
    "You need an authorised decision before proceeding.",
    "/decisions",
    "Open Decisions & Approvals",
    [
      "State the request, context and recommended action.",
      "Submit it through the authority route shown in the form.",
      "Wait for the recorded decision and complete any resulting action.",
    ],
  ),
  decision: guide(
    "An authorised decision needs to be requested, recorded or followed through.",
    "/decisions",
    "Open Decisions & Approvals",
    [
      "Open or create the relevant decision request.",
      "Keep the reason, outcome and conditions with the decision.",
      "Assign and track any implementation action using the available controls.",
    ],
  ),
  action: guide(
    "You need to follow through on agreed work or a decision.",
    "/work",
    "Open Today",
    [
      "Find the assigned action and its deadline.",
      "Record progress, blockers and completion evidence.",
      "Submit it for verification when required.",
    ],
  ),
  checklist: guide(
    "A work item requires a consistent set of checks.",
    "/work",
    "Open assigned work",
    [
      "Open the work item that contains the checklist.",
      "Answer each check based on what you actually verified.",
      "Record exceptions and complete required reports or evidence before closing the work.",
    ],
  ),
  handover: guide(
    "Work or responsibility is changing hands.",
    "/staff-transition",
    "Open Progression & Exit",
    [
      "Open the relevant transition or handover record available to your role.",
      "Record outstanding work, records, assets and the receiving person or role.",
      "Complete the required acknowledgement or verification before closure.",
    ],
  ),
  meeting: guide(
    "A meeting needs a record of outcomes and follow-up.",
    "/reports",
    "Open Reports",
    [
      "Use an approved one-off meeting report type; a school leader must configure it if none is available.",
      "Record the meeting date, participants, decisions and actions with owners and deadlines.",
      "Use Decisions & Approvals for formal approvals and Today for assigned follow-through.",
    ],
  ),
  risk_assessment: guide(
    "An activity has risks that need assessment before it proceeds.",
    "/library?tab=processes",
    "Find the governing process",
    [
      "Read the governing process and identify the responsible leader.",
      "Record risks, controls and remaining concerns in its required form or assigned work.",
      "Use the relevant event, safeguarding or approval workflow when the process requires it.",
    ],
  ),
  incident: guide(
    "A significant event needs to be recorded and acted on.",
    "/issues",
    "Open Issues & Escalations",
    [
      "Record the facts, time, affected area and immediate action.",
      "For child safeguarding or confidential personnel matters, use the protected specialist workflow instead of a general issue.",
      "Follow the assigned response and review to closure.",
    ],
  ),
  case: guide(
    "An issue needs several linked steps, records and follow-ups.",
    "/library?tab=processes",
    "Find the correct case workflow",
    [
      "Identify the governing process and the authorised case owner.",
      "Use the relevant protected area, such as Safeguarding, People or Parent Partnership.",
      "Keep case details in that workflow; do not copy confidential records into a general report.",
    ],
  ),
  improvement_plan: guide(
    "Repeated gaps need a plan with an owner and measurable follow-up.",
    "/improvement",
    "Open Improvement",
    [
      "Identify the evidence-backed problem and desired change.",
      "Set actions, responsible roles, deadlines and review measures.",
      "Review progress using evidence and record what changed.",
    ],
  ),
  root_cause: guide(
    "You need to understand why a problem keeps happening.",
    "/issues",
    "Open the related issue",
    [
      "Start from the existing issue and its evidence.",
      "Separate symptoms from the underlying cause and record the corrective action.",
      "Verify whether the action prevents the problem from recurring.",
    ],
  ),
  review: guide(
    "Evidence and results need a formal review.",
    "/reviews",
    "Open Reviews",
    [
      "Use this area for school transformation reviews.",
      "For an assigned work review, open Today; for a staff or learner review, use its relevant workspace.",
      "Record the evidence, conclusion and follow-up action in the appropriate review.",
    ],
  ),
  acknowledgement: guide(
    "A policy has been assigned to your role for reading and acceptance.",
    "/library?tab=policies",
    "Open policies",
    [
      "Open the current policy assigned to your role.",
      "Read it and use the acknowledgement control when you understand it.",
      "Contact your school leader if the required policy or acknowledgement is missing.",
    ],
  ),
  consent: guide(
    "The governing process requires recorded permission.",
    "/library?tab=processes",
    "Find the governing process",
    [
      "Check what consent is required, from whom and for what purpose.",
      "Record it in the relevant protected learner, parent, event or safeguarding workflow.",
      "Do not treat a general report or policy acknowledgement as a substitute for consent.",
    ],
  ),
  communication: guide(
    "An important school message or conversation needs a record.",
    "/announcements",
    "Open Announcements",
    [
      "Use Announcements for notices to authorised staff audiences.",
      "Record individual parent or case communications in the relevant protected workflow.",
      "Use the school’s configured report type for other communication logs when required.",
    ],
  ),
  document_control: guide(
    "An official policy or process needs a controlled revision.",
    "/library?tab=policies",
    "Open Policies & Processes",
    [
      "Open the document and check its current approved version.",
      "An authorised leader prepares a revision and submits it through the review process.",
      "Use the approved version; a saved draft does not replace it.",
    ],
  ),
  kpi_definition: guide(
    "A result needs a clear and consistent measurement rule.",
    "/performance",
    "Open Performance & Scorecards",
    [
      "Check what the measure means, its evidence source, target and owner.",
      "Use the controls available to your leadership role to configure or review it.",
      "Record the actual result against the agreed reporting period.",
    ],
  ),
  scorecard: guide(
    "You need to review performance against agreed measures.",
    "/performance",
    "Open Performance & Scorecards",
    [
      "Select the relevant scorecard and reporting period.",
      "Check results against the underlying evidence.",
      "Record or follow up on gaps using the authorised action and review controls.",
    ],
  ),
  audit: guide(
    "You need to understand who changed a record and why.",
    "/records",
    "Open Records & Evidence",
    [
      "Open the relevant record’s history or review trail in its workspace.",
      "Check the recorded actions, dates and reasons.",
      "History is captured by the app; it is not a form for staff to recreate.",
    ],
    true,
  ),
  learning: guide(
    "A reviewed experience should improve how the school works.",
    "/reports",
    "Open Reports",
    [
      "Use a configured learning or review report type for the relevant period or event.",
      "Record what happened, what was learned and what should change.",
      "Route process changes through their normal approval and revision controls.",
    ],
  ),
  calendar: guide(
    "Work has a date, deadline or milestone that must be followed.",
    "/calendar",
    "Open Calendar",
    [
      "Find the scheduled event or deadline and its responsible role.",
      "Open its source record to make any authorised change.",
      "Complete the linked work and evidence rather than only changing the date.",
    ],
  ),
  notification_rule: guide(
    "You need reminders for outstanding work and reviews.",
    "/work",
    "Open Today",
    [
      "Check the outstanding action and its deadline in Today.",
      "Open the notification bell to review reminders and enable device alerts.",
      "Leaders configure process timing in Execution Control; a tool entry does not create a reminder by itself.",
    ],
  ),
  operating_log: guide(
    "Assigned work requires a dated log of events, observations or actions.",
    "/work",
    "Open Reports & logs in Today",
    [
      "Open the assigned work item and find Reports & logs.",
      "Complete the required log fields and submit the entry.",
      "Use Reports for separate one-off or recurring logs configured by your school.",
    ],
  ),
  operating_report: guide(
    "Assigned work requires a report covering a period or result.",
    "/work",
    "Open Reports & logs in Today",
    [
      "Open the assigned work item and find Reports & logs.",
      "Record the reporting period, results, exceptions and next actions requested.",
      "Submit the report, then complete the work’s review or verification steps.",
    ],
  ),
};
export function getToolGuide(type: string): ToolGuide {
  return (
    (Object.hasOwn(guides, type) ? guides[type] : undefined) ??
    guide(
      "Use this tool when the school’s approved process calls for it.",
      "/library?tab=processes",
      "Find the related process",
      [
        "Find the process that requires this tool.",
        "Check its owner, instructions and required evidence.",
        "Complete the form in its assigned work area. If none is available, ask an authorised leader to configure it.",
      ],
    )
  );
}
export function readableToolLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim();
}
export type ToolFieldPreview = {
  label: string;
  answer: string;
  required: boolean | null;
  options: string[];
};
export function toolFieldPreview(
  schema: Record<string, unknown>,
): ToolFieldPreview[] {
  const raw = schema.fields;
  const fromProperties =
    raw === undefined &&
    schema.properties &&
    typeof schema.properties === "object" &&
    !Array.isArray(schema.properties)
      ? Object.entries(schema.properties as Record<string, unknown>).map(
          ([key, value]) => ({
            key,
            ...(value && typeof value === "object" && !Array.isArray(value)
              ? value
              : {}),
          }),
        )
      : null;
  const list = Array.isArray(raw) ? raw : (fromProperties ?? []);
  const labels: Record<string, string> = {
    text: "Short answer",
    string: "Written answer",
    textarea: "Long answer",
    date: "Date",
    number: "Number",
    integer: "Whole number",
    boolean: "Yes or No",
    select: "Choose an option",
    url: "Document link",
    array: "List of entries",
    object: "Details",
  };
  return list.flatMap((value): ToolFieldPreview[] => {
    if (typeof value === "string")
      return [
        {
          label: readableToolLabel(value),
          answer: "Written answer",
          required: Array.isArray(schema.required)
            ? schema.required.includes(value)
            : null,
          options: [],
        },
      ];
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const f = value as Record<string, unknown>,
      key =
        typeof f.key === "string"
          ? f.key
          : typeof f.name === "string"
            ? f.name
            : "",
      label =
        typeof f.label === "string"
          ? f.label
          : typeof f.title === "string"
            ? f.title
            : key;
    if (!label) return [];
    const choices = Array.isArray(f.options)
      ? f.options
      : Array.isArray(f.enum)
        ? f.enum
        : [];
    return [
      {
        label: readableToolLabel(label),
        answer: choices.length
          ? "Choose an option"
          : (Object.hasOwn(labels, String(f.type)) ? labels[String(f.type)] : "Written answer"),
        required:
          typeof f.required === "boolean"
            ? f.required
            : Array.isArray(schema.required)
              ? schema.required.includes(key)
              : null,
        options: choices.filter((v): v is string => typeof v === "string"),
      },
    ];
  });
}
