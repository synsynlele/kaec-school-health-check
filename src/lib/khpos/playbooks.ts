import type { KhposImplementationPlan } from "@/lib/khpos/implementation";

export interface KhposSchoolPlaybook {
  id: string;
  title: string;
  purpose: string;
  owner: string;
  useWhen: string;
  completionOutcome: string;
  steps: string[];
  checklist: string[];
  evidence: string[];
  escalation: string[];
}

export const UNIVERSAL_SCHOOL_PLAYBOOKS: readonly KhposSchoolPlaybook[] = [
  {
    id: "transformation-leadership",
    title: "Transformation Leadership & Responsibility",
    purpose:
      "Create clear ownership for the school transformation so no action is left to assumption or depends on one person.",
    owner: "School Owner/Board representative and the school's Transformation Lead.",
    useWhen:
      "At the beginning of the engagement, when a new priority is approved, or whenever responsibility changes.",
    completionOutcome:
      "Every active priority has one accountable owner, supporting people, authority boundaries and a clear escalation route.",
    steps: [
      "Appoint one School Transformation Lead to coordinate implementation.",
      "Confirm the owner or board representative who retains final institutional authority.",
      "Assign one accountable owner to every active priority.",
      "Identify the people who must support each owner and what they must contribute.",
      "Clarify which decisions owners can make independently and which need leadership approval.",
      "Record ownership in KHP-OS and review it whenever unclear responsibility causes delay.",
    ],
    checklist: [
      "School Transformation Lead appointed.",
      "Owner or board sponsor confirmed.",
      "Every active priority has one accountable owner.",
      "Supporting roles are identified.",
      "Decision authority is clear.",
      "Owners have accepted their responsibilities.",
    ],
    evidence: [
      "Leadership responsibility map or meeting record.",
      "Named implementation owners in KHP-OS.",
      "Any formal delegation or role memo required by the school.",
    ],
    escalation: [
      "No suitable owner can be identified.",
      "A priority owner lacks the authority needed to execute.",
      "Leaders dispute accountability.",
      "An owner repeatedly fails to execute agreed actions.",
    ],
  },
  {
    id: "transformation-kickoff",
    title: "Transformation Kick-off",
    purpose:
      "Turn an approved transformation priority into an organised start with shared understanding, resources and deadlines.",
    owner: "School Transformation Lead and the owner of the approved priority.",
    useWhen: "Immediately after KHP-OS activates an approved intervention.",
    completionOutcome:
      "The implementation team understands the problem, desired outcome, actions, timeline, evidence standard and responsibilities before work begins.",
    steps: [
      "Read the approved priority, intervention and outcome contract in KHP-OS.",
      "Meet with the people directly involved in implementation.",
      "Explain the problem being solved and what successful change will look like.",
      "Review actions in sequence and confirm owners, due dates, resources and dependencies.",
      "Identify immediate risks or constraints before work begins.",
      "Agree how progress and evidence will be recorded.",
      "Start the first action and schedule the first weekly execution check.",
    ],
    checklist: [
      "Priority and intervention reviewed.",
      "Desired outcome explained.",
      "Implementation team briefed.",
      "Actions and sequence understood.",
      "Resources checked.",
      "Risks identified.",
      "Evidence requirements understood.",
      "First action started.",
    ],
    evidence: [
      "Kick-off meeting record.",
      "Confirmed action owners and dates.",
      "Resource or constraint notes.",
      "Any staff communication issued.",
    ],
    escalation: [
      "The team does not understand or accept the intervention.",
      "Required resources cannot be secured.",
      "A major operational or financial constraint makes the plan unrealistic.",
      "The approved plan conflicts with law, safeguarding or a serious school obligation.",
    ],
  },
  {
    id: "priority-implementation",
    title: "Priority Implementation",
    purpose:
      "Help the school execute each approved priority as disciplined institutional change rather than a list of activities.",
    owner: "Assigned Priority Owner.",
    useWhen: "Throughout the life of every active intervention.",
    completionOutcome:
      "Required actions are completed in sequence, evidence is produced, milestones are reached and the intended institutional condition is achieved.",
    steps: [
      "Open the active intervention playbook in KHP-OS.",
      "Start with the earliest incomplete action unless a dependency requires otherwise.",
      "Complete the action according to its description and agreed standard.",
      "Collect required evidence while the work happens.",
      "Update progress truthfully and check the next milestone.",
      "Resolve small blockers immediately and escalate material blockers.",
      "Do not declare completion simply because activities were performed; confirm the outcome contract.",
    ],
    checklist: [
      "Correct intervention playbook is being followed.",
      "Actions are being executed in sequence.",
      "Owners know their next action.",
      "Deadlines are monitored.",
      "Evidence is collected during execution.",
      "Milestones are reviewed.",
      "Outcome condition is checked before completion.",
    ],
    evidence: [
      "Completed action records.",
      "Evidence specified by KHP-OS.",
      "Milestone records.",
      "Policies, tools, records or outputs produced by the intervention.",
    ],
    escalation: [
      "Actions repeatedly miss deadlines.",
      "Implementation is producing unintended harm or disruption.",
      "Circumstances have materially changed.",
      "The plan needs adjustment rather than continued execution.",
    ],
  },
  {
    id: "weekly-execution",
    title: "Weekly Execution",
    purpose:
      "Create a simple weekly rhythm that keeps transformation moving without turning it into excessive meetings.",
    owner: "School Transformation Lead.",
    useWhen: "Every week while any transformation priority is active.",
    completionOutcome:
      "Leadership can see what was due, what was completed, what is behind, what evidence exists and what must happen next.",
    steps: [
      "Review all active actions due in the current or previous week.",
      "Ask each owner what was completed and verify rather than relying on verbal assurance.",
      "Identify overdue actions and the reason for delay.",
      "Review evidence already produced.",
      "Identify risks, dependencies or decisions needed from leadership.",
      "Agree the next action for every active priority.",
      "Record changes and keep unrelated operational matters outside this meeting.",
    ],
    checklist: [
      "Active priorities reviewed.",
      "Completed work verified.",
      "Overdue work identified.",
      "Evidence checked.",
      "Risks and blockers identified.",
      "Next actions, owners and dates confirmed.",
      "Escalations recorded.",
    ],
    evidence: [
      "Short weekly execution record.",
      "Updated action and evidence status.",
      "Escalation notes where required.",
    ],
    escalation: [
      "An action is overdue for two consecutive checks.",
      "A priority has stalled.",
      "Evidence repeatedly fails to support reported progress.",
      "Leadership action is required to unlock implementation.",
    ],
  },
  {
    id: "change-adoption",
    title: "Staff Communication & Change Adoption",
    purpose:
      "Help staff understand, accept and consistently apply changes introduced through the transformation.",
    owner:
      "School leader responsible for the affected team, supported by the School Transformation Lead.",
    useWhen:
      "Whenever an intervention changes expectations, routines, standards, roles, tools or behaviour.",
    completionOutcome:
      "People affected by the change understand why it is happening, what is changing, what is expected and where to get support.",
    steps: [
      "Identify exactly who is affected by the change.",
      "Explain the reason for the change in practical school terms.",
      "State what will change and what will remain unchanged.",
      "Demonstrate the new standard, process or tool where necessary.",
      "Allow questions and surface legitimate constraints.",
      "Provide training or coaching when capability is the problem.",
      "Set the date from which the new practice is expected and observe adoption.",
      "Correct inconsistency early and fairly.",
    ],
    checklist: [
      "Affected people identified.",
      "Reason for change communicated.",
      "New expectation explained clearly.",
      "Training or support provided where required.",
      "Effective date stated.",
      "Adoption observed.",
      "Non-adoption addressed.",
    ],
    evidence: [
      "Briefing or training record.",
      "Communication issued to affected staff.",
      "Observation or coaching records where relevant.",
      "Examples of the new practice in use.",
    ],
    escalation: [
      "Resistance is widespread or threatens implementation.",
      "A change creates a serious staff welfare, contractual or safeguarding concern.",
      "Leaders are communicating contradictory expectations.",
      "Additional change-management support is required.",
    ],
  },
  {
    id: "evidence-documentation",
    title: "Evidence & Documentation",
    purpose:
      "Ensure the school can prove implementation and improvement with relevant, credible evidence.",
    owner:
      "Action owners produce evidence; the School Transformation Lead checks completeness.",
    useWhen:
      "Whenever KHP-OS marks evidence as required and throughout implementation.",
    completionOutcome:
      "Evidence is available, relevant, traceable to the school, privacy-safe and sufficient for review.",
    steps: [
      "Read the evidence requirement before performing the related action.",
      "Collect evidence from normal school operations wherever possible.",
      "Use evidence that shows what actually happened—not material created only to satisfy KAEC-NG.",
      "Label evidence with the relevant action or priority and date.",
      "Protect confidential, child and staff information.",
      "Check that the evidence proves the claimed progress.",
      "Replace weak or irrelevant evidence before review and never alter, fabricate or backdate evidence.",
    ],
    checklist: [
      "Evidence requirement understood.",
      "Evidence collected at the right time.",
      "Evidence is relevant and attributable to the school.",
      "Dates and context are clear.",
      "Privacy is protected.",
      "Evidence supports the claim being made.",
      "Missing evidence is identified before review.",
    ],
    evidence: [
      "Documents, records, meeting minutes, policies or logs.",
      "Privacy-safe photographs or screenshots where appropriate.",
      "Samples of work or output.",
      "Observation or monitoring records.",
      "Approved quantitative records or aggregate data.",
    ],
    escalation: [
      "Evidence cannot be obtained without breaching privacy or safeguarding.",
      "Evidence appears manipulated, inconsistent or unreliable.",
      "The school cannot prove a material completion claim.",
      "The system evidence requirement does not fit the real intervention context.",
    ],
  },
  {
    id: "risk-escalation",
    title: "Problem, Risk & Escalation",
    purpose:
      "Resolve implementation problems early and ensure serious issues reach the right authority before they damage the transformation.",
    owner:
      "Priority Owner first; the School Transformation Lead coordinates escalation.",
    useWhen:
      "Whenever implementation is blocked, delayed, disputed, unsafe or materially different from plan.",
    completionOutcome:
      "Problems are classified, owned and resolved at the lowest appropriate level while significant risks receive timely leadership or KAEC-NG attention.",
    steps: [
      "Describe the problem factually: what happened, when, where and what it affects.",
      "Decide whether it is a routine operational issue or a material transformation risk.",
      "For routine issues, assign an owner and resolution date immediately.",
      "For material risks, pause the affected action if continuing could cause harm or waste.",
      "Record what has already been tried.",
      "Escalate with the facts, impact, urgency and decision needed.",
      "After resolution, record the decision and any change to the implementation plan.",
    ],
    checklist: [
      "Problem clearly described.",
      "Impact identified.",
      "Routine issue versus material risk determined.",
      "Owner assigned.",
      "Immediate containment taken if required.",
      "Correct authority engaged.",
      "Resolution or decision documented.",
    ],
    evidence: [
      "Risk or issue record.",
      "Relevant correspondence or meeting decision.",
      "Updated action or plan where necessary.",
    ],
    escalation: [
      "Safeguarding, legal, ethical or serious reputational risk exists.",
      "Financial commitment outside approved authority is required.",
      "A plan change could materially alter the approved outcome.",
      "Leadership conflict prevents execution.",
      "The same blocker recurs despite corrective action.",
    ],
  },
  {
    id: "transformation-review",
    title: "Transformation Review",
    purpose:
      "Prepare the school to make evidence-based decisions at midpoint and outcome reviews.",
    owner:
      "School Transformation Lead, Priority Owner and authorised School Leader.",
    useWhen: "Before and during every KHP-OS midpoint or outcome review.",
    completionOutcome:
      "A clear human decision—Continue, Adjust, Escalate, Complete, Pause or Stop—is made from evidence and the outcome contract.",
    steps: [
      "Review the outcome contract and original baseline.",
      "Confirm action and milestone status.",
      "Gather required evidence before the review.",
      "Identify what changed, what did not and what remains uncertain.",
      "Discuss causes rather than simply reporting activity.",
      "Review risks and unintended effects.",
      "Make and record the authorised review decision with its reason.",
      "Assign follow-up actions immediately.",
      "Remember that completing an implementation cycle does not prove institutional improvement until reassessment.",
    ],
    checklist: [
      "Baseline and outcome contract reviewed.",
      "Actions and milestones checked.",
      "Evidence is complete enough for a decision.",
      "Progress and gaps discussed.",
      "Risks considered.",
      "Human decision recorded.",
      "Follow-up actions assigned.",
    ],
    evidence: [
      "Review record and decision.",
      "Evidence set used for the decision.",
      "Adjusted actions or timelines if applicable.",
    ],
    escalation: [
      "Evidence is insufficient for a consequential decision.",
      "Stakeholders materially disagree about completion.",
      "An intervention should be stopped or redesigned.",
      "Completion is being claimed without evidence of the desired condition.",
    ],
  },
  {
    id: "reassessment-improvement",
    title: "Reassessment & Continuous Improvement",
    purpose:
      "Verify whether institutional conditions improved and convert learning from one cycle into the next improvement cycle.",
    owner:
      "School Owner or authorised leader with the School Transformation Lead.",
    useWhen:
      "At the end of the agreed transformation cycle or when KHP-OS schedules reassessment.",
    completionOutcome:
      "The school completes reassessment honestly, compares results against baseline and agrees the next priorities.",
    steps: [
      "Confirm the relevant cycle has reached review and the school is ready for reassessment.",
      "Complete the KSHC reassessment using the same evidence discipline as the baseline.",
      "Do not inflate responses to demonstrate success.",
      "Review changes across indicators, areas and KHP-OS systems.",
      "Identify verified improvement, unchanged conditions and regression.",
      "Compare reassessment results with implementation evidence.",
      "Capture lessons and select the next priorities through the approved KHP-OS process.",
    ],
    checklist: [
      "Reassessment timing confirmed.",
      "Assessment completed honestly.",
      "Baseline comparison reviewed.",
      "Improvement and regression identified.",
      "Evidence compared with reassessment.",
      "Lessons captured.",
      "Next priorities agreed.",
    ],
    evidence: [
      "Completed reassessment.",
      "Baseline-to-current comparison.",
      "Cycle learning notes.",
      "New approved priorities.",
    ],
    escalation: [
      "Reassessment results materially conflict with implementation evidence.",
      "A serious regression appears.",
      "The school wants to change assessment answers to protect reputation.",
      "Leadership needs support interpreting the next strategic priorities.",
    ],
  },
  {
    id: "sustainability-institutionalisation",
    title: "Sustainability & Institutionalisation",
    purpose:
      "Make successful improvements part of normal school practice so progress survives staff changes, leadership transitions and reduced KAEC-NG support.",
    owner: "School Owner or Board and senior leadership.",
    useWhen:
      "When an intervention is working and before the improved practice is considered fully embedded.",
    completionOutcome:
      "The improved practice is owned by the institution, documented, resourced, monitored and able to continue without dependence on one individual.",
    steps: [
      "Identify the practice or system that produced the improvement.",
      "Document the minimum standard the school intends to maintain.",
      "Assign the permanent role responsible for the practice.",
      "Embed it into an existing policy, calendar, meeting rhythm, role description or operating procedure.",
      "Ensure new staff can learn the practice through induction or handover.",
      "Define the simple metric or evidence that will show whether it continues.",
      "Check whether the practice depends on one person, temporary funding or exceptional effort.",
      "Remove unnecessary owner dependency and schedule periodic leadership review.",
    ],
    checklist: [
      "Successful practice clearly identified.",
      "Minimum standard documented.",
      "Permanent owner assigned.",
      "Practice embedded into normal operations.",
      "Induction or handover route exists.",
      "Monitoring evidence defined.",
      "Single-person dependency checked.",
      "Periodic review scheduled.",
    ],
    evidence: [
      "Updated policy, process or role description where appropriate.",
      "Operating calendar or recurring review record.",
      "Induction or handover material.",
      "Evidence that the practice continues over time.",
    ],
    escalation: [
      "The practice cannot continue without one individual.",
      "Long-term resource requirements are unsustainable.",
      "Leadership changes threaten continuity.",
      "The school needs governance or succession redesign to preserve the improvement.",
    ],
  },
] as const;

export function interventionPlaybookProgress(plan: KhposImplementationPlan) {
  const completedActions = plan.actions.filter((action) => action.status === "completed").length;
  const completedEvidence = plan.evidenceRequirements.filter(
    (requirement) => requirement.status === "accepted" || requirement.status === "verified" || requirement.status === "completed",
  ).length;

  return {
    completedActions,
    totalActions: plan.actions.length,
    completedEvidence,
    totalEvidence: plan.evidenceRequirements.length,
    percent: plan.actions.length
      ? Math.round((completedActions / plan.actions.length) * 100)
      : 0,
  };
}
