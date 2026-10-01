import type {
  KhposOpsPolicy,
  KhposOpsProcess,
} from "@/lib/khpos/ops/library";

export type PolicyBaseline = {
  purpose: string;
  scope: string;
  principles: string[];
  policyStatements: string[];
  rolesResponsibilities: string[];
  rules: string[];
  exceptions: string[];
  escalation: string[];
  recordsEvidence: string[];
};

export type ProcessBaseline = {
  purpose: string;
  trigger: string;
  inputs: string[];
  steps: string[];
  sla: string;
  evidence: string[];
  expectedOutcome: string;
  exceptionConditions: string[];
  escalation: string[];
  kpis: string[];
};

type PolicyDomainBlueprint = {
  purpose: string;
  scope: string;
  principles: string[];
  statements: string[];
  roles: string[];
  rules: string[];
  exceptions: string[];
  escalation: string[];
  evidence: string[];
};

type ProcessDomainBlueprint = {
  trigger: string;
  inputs: string[];
  steps: string[];
  evidence: string[];
  outcome: string;
  exceptions: string[];
  escalation: string[];
  kpis: string[];
  sla: string;
};

const POLICY_DOMAINS: Record<string, PolicyDomainBlueprint> = {
  GOV: {
    purpose: "protect institutional authority, continuity, accountability and lawful decision-making",
    scope: "governors, custodians, school leaders, staff, contractors, partners, records and institutional commitments",
    principles: [
      "Authority must be explicit, traceable and exercised within delegated limits.",
      "Important decisions must leave an evidence trail.",
      "Sensitive information is accessed only by people with a legitimate operational need.",
      "The school maintains continuity even when individual leaders are absent.",
      "Legal, regulatory, contractual and safeguarding duties override convenience.",
    ],
    statements: [
      "Institutional authority is exercised through approved roles, delegations and documented decisions.",
      "Controlled documents must have a clear owner, version, effective date and review path.",
      "Records must be accurate, retrievable, access-controlled and retained for an appropriate period.",
      "External commitments must be approved by the role holding the relevant authority.",
      "Material changes must be communicated to affected people and implemented with evidence.",
    ],
    roles: [
      "School Custodian: protects institutional authority, approves critical controls and resolves reserved matters.",
      "School Guardian: owns day-to-day institutional implementation and ensures controls are followed.",
      "Control owner: maintains the document, monitors compliance and initiates review when conditions change.",
      "All staff: operate within delegated authority and preserve required records.",
    ],
    rules: [
      "No person may approve a matter outside their documented authority.",
      "Controlled records may not be deleted, altered or back-dated to conceal a decision or event.",
      "Material exceptions require a named approver, reason, duration and follow-up action.",
      "Critical institutional decisions must identify the decision owner, evidence considered and implementation owner.",
    ],
    exceptions: [
      "Emergency action may precede normal approval only where delay would create material harm; the action must be documented and retrospectively reviewed.",
    ],
    escalation: [
      "Escalate suspected legal, safeguarding, financial, data or authority breaches immediately to the School Guardian and School Custodian.",
      "Unresolved governance disputes move to the highest uninvolved authorised role.",
    ],
    evidence: [
      "Approved policies, processes and delegations.",
      "Decision and approval records.",
      "Controlled document history and acknowledgements.",
      "Regulatory, contractual or compliance evidence where applicable.",
    ],
  },
  FIN: {
    purpose: "protect school funds, revenue, affordability, financial records and decision integrity",
    scope: "fees, cash, transfers, expenses, procurement, vendors, concessions, scholarships, sponsorships, donations and financial reporting",
    principles: [
      "Every financial transaction must be authorised, recorded and reconcilable.",
      "No person should control request, approval, payment and reconciliation for the same material transaction.",
      "School funds are used only for approved institutional purposes.",
      "Families receive clear, consistent and documented financial communication.",
      "Financial exceptions require explicit authority and an evidence trail.",
    ],
    statements: [
      "The school maintains defined financial authority limits and approval responsibilities.",
      "Revenue and receivables are recorded against identifiable obligations and payers.",
      "Procurement decisions consider need, value, suitability, conflicts of interest and available budget.",
      "Discounts, scholarships and concessions follow approved criteria rather than informal promises.",
      "Cash and account balances are reconciled at defined intervals and discrepancies are investigated promptly.",
    ],
    roles: [
      "School Custodian: approves reserved financial matters and material exceptions.",
      "School Guardian: ensures financial controls operate and approved budgets are respected.",
      "Finance/Admin owner: records transactions, maintains receivables and performs reconciliations.",
      "Requesting/receiving staff: confirm need and receipt but do not self-approve material expenditure.",
    ],
    rules: [
      "No undocumented cash collection, payment, discount, refund or write-off is permitted.",
      "A payment must not be represented as received until evidence is available.",
      "Vendor selection and expense approval must be free from undisclosed conflicts of interest.",
      "Receipts, invoices, approvals and reconciliation evidence must be retained.",
      "Outstanding balances and exceptions must be visible to the authorised school leadership.",
    ],
    exceptions: [
      "Urgent safety or continuity expenditure may use emergency authority where delay would materially harm learners or operations; normal evidence and retrospective review still apply.",
    ],
    escalation: [
      "Suspected fraud, diversion, unexplained shortage or unauthorised commitment is escalated immediately to the School Custodian.",
      "Material reconciliation differences remain open until resolved or formally accepted by an authorised reviewer.",
    ],
    evidence: [
      "Fee schedules and approved concessions.",
      "Invoices, receipts, payment evidence and ledgers.",
      "Procurement requests, approvals and vendor evidence.",
      "Bank/cash reconciliations and variance records.",
      "Financial approvals and exception records.",
    ],
  },
  OPS: {
    purpose: "keep the school safe, ready, functional and properly controlled every operating day",
    scope: "campuses, classrooms, utilities, sanitation, facilities, assets, visitors, contractors, technology access, transport interfaces and operational close-out",
    principles: [
      "Learner and staff safety comes before convenience.",
      "Readiness is verified, not assumed.",
      "Operational defects have a named owner, severity and resolution path.",
      "Assets and access are traceable.",
      "Preventive maintenance is preferred to repeated emergency repair.",
    ],
    statements: [
      "Each campus completes defined opening, readiness and closing controls.",
      "Safety-critical defects are isolated or mitigated before normal use continues.",
      "Assets are registered, assigned where appropriate and tracked through transfer, repair and disposal.",
      "Visitors and contractors operate under controlled access and supervision.",
      "Technology and physical access are granted only for legitimate duties and removed when no longer required.",
    ],
    roles: [
      "School Guardian: accountable for campus operational readiness.",
      "Operations/Admin owner: coordinates facilities, access, vendors, utilities and records.",
      "Assigned check owner: completes the required inspection honestly and records exceptions.",
      "All staff: report hazards, failures, losses and unsafe conditions promptly.",
    ],
    rules: [
      "A failed critical readiness check cannot be silently marked complete.",
      "Unsafe equipment or space must be taken out of use until controlled.",
      "Keys, credentials and privileged access must not be shared informally.",
      "Asset movement requires an identifiable custodian and record.",
      "Maintenance work must record the fault, action, provider and completion evidence.",
    ],
    exceptions: [
      "Temporary workarounds require a risk assessment, named owner, expiry point and follow-up repair.",
    ],
    escalation: [
      "Life-safety, security, water, power, structural or critical technology failures are escalated immediately.",
      "Repeated defects or missed preventive maintenance are escalated to school leadership for root-cause action.",
    ],
    evidence: [
      "Opening, readiness and closing records.",
      "Safety inspections and incident reports.",
      "Asset register and movement history.",
      "Maintenance requests, service evidence and vendor records.",
      "Visitor, access and contractor records.",
    ],
  },
  PAR: {
    purpose: "create a clear, fair and trustworthy learner-family journey from enquiry through admission, partnership and exit",
    scope: "prospective families, enrolled families, learners, admissions, consent, communication, complaints, retention, withdrawal and alumni handover",
    principles: [
      "Families receive accurate information and consistent treatment.",
      "Admission decisions are evidence-based and free from improper influence.",
      "Consent and learner information are handled deliberately and confidentially.",
      "Complaints are heard without retaliation and resolved through a clear path.",
      "Important family interactions leave an appropriate record.",
    ],
    statements: [
      "The school defines what information, evidence and decisions are required at each stage of the family journey.",
      "No learner is represented as admitted until the authorised admission decision and required confirmation are complete.",
      "Parents receive clear expectations on fees, participation, communication and school policies.",
      "Complaints and concerns are acknowledged, assigned, resolved and escalated where necessary.",
      "Withdrawal and exit records protect continuity, accountability and learner information.",
    ],
    roles: [
      "School Guardian: accountable for admission integrity and serious parent escalations.",
      "Admissions/Admin owner: manages records, communication and handovers.",
      "Relevant academic/section leader: contributes evidence to placement or learner-related decisions.",
      "All staff: communicate respectfully and route matters to the correct owner rather than making unauthorised promises.",
    ],
    rules: [
      "Admission, scholarship, fee or placement promises require authorised approval.",
      "Consent must be specific enough for the activity or information use concerned.",
      "Material complaints must have a recorded owner and status.",
      "Sensitive learner/family information is shared only on a legitimate need-to-know basis.",
      "Parent communication must not contradict approved school policy or financial authority.",
    ],
    exceptions: [
      "Urgent learner welfare matters may bypass normal communication sequencing, but safeguarding and documentation requirements still apply.",
    ],
    escalation: [
      "Safeguarding, discrimination, serious misconduct, legal or financial allegations move immediately to the relevant protected pathway.",
      "Unresolved complaints escalate to the next authorised uninvolved role.",
    ],
    evidence: [
      "Enquiry, application and admission records.",
      "Assessment, placement and decision evidence.",
      "Consent and family-information records.",
      "Parent communication, meeting and complaint logs.",
      "Withdrawal, re-enrolment and exit records.",
    ],
  },
  SAF: {
    purpose: "protect every learner from harm and ensure concerns are acted on quickly, lawfully and confidentially",
    scope: "learners, staff, volunteers, visitors, contractors, digital activity, off-site activity, arrival/dismissal, emergencies and safeguarding records",
    principles: [
      "The learner's immediate safety is the first priority.",
      "Listen, record facts and avoid investigative questioning by unauthorised staff.",
      "Concerns are shared only with people who need the information to protect the learner.",
      "A concern is never ignored because evidence is incomplete or an allegation is uncomfortable.",
      "Safeguarding decisions and referrals are documented and independently reviewable.",
    ],
    statements: [
      "The school maintains designated safeguarding leadership and a deputy pathway.",
      "Any staff member may report a safeguarding concern without needing managerial permission.",
      "The person receiving a disclosure records the learner's words and immediate protective action accurately.",
      "Allegations involving staff or designated persons are routed away from the implicated person.",
      "External referral and authority cooperation are used when law, risk or professional judgement requires them.",
    ],
    roles: [
      "Designated safeguarding lead: receives concerns, triages risk, coordinates protection/referral and maintains restricted records.",
      "Deputy safeguarding lead: provides independent cover and acts when the lead is unavailable or implicated.",
      "School Guardian/Custodian: ensures the safeguarding system exists without overriding protected case confidentiality.",
      "All staff: protect, listen, record and report; they do not conduct unauthorised investigations.",
    ],
    rules: [
      "Immediate danger requires direct protective action and emergency response before routine administration.",
      "A safeguarding concern must never be handled only through ordinary chat, informal notes or personal devices.",
      "The reporter must not promise secrecy to a learner.",
      "Case content is restricted to designated authorised personnel.",
      "Closure requires documented follow-up and an appropriate independent review.",
    ],
    exceptions: [
      "No operational convenience, seniority or relationship creates an exception to safeguarding duties.",
    ],
    escalation: [
      "Immediate danger, serious harm, missing learners, staff allegations and required external referrals are escalated without delay.",
      "If a designated safeguarding person is implicated, route the matter to the other designated person and the appropriate external/independent authority path.",
    ],
    evidence: [
      "Restricted concern records and receipt references.",
      "Protection, triage, referral and follow-up records.",
      "Designation and safeguarding-training evidence.",
      "Incident, collection, visit or emergency records where relevant.",
      "Closure and independent review evidence.",
    ],
  },
  CUL: {
    purpose: "build a safe, dignified and accountable student culture that develops responsibility rather than fear",
    scope: "learners, staff, classrooms, activities, attendance, student voice, recognition, behaviour response and student leadership",
    principles: [
      "Dignity is preserved even when behaviour is corrected.",
      "Responses are proportionate, restorative where appropriate and evidence-based.",
      "Students are taught expectations rather than expected to infer them.",
      "Student voice does not remove adult safeguarding or governance responsibility.",
      "Recognition reinforces contribution, growth, responsibility and school values.",
    ],
    statements: [
      "Behaviour expectations are explicit, teachable and consistently applied.",
      "Serious or repeated misconduct follows a documented escalation pathway.",
      "Humiliation, degrading punishment and retaliatory treatment are not acceptable.",
      "Student leadership roles operate with defined authority, review and handover.",
      "Attendance and punctuality concerns are addressed early with learner and family support.",
    ],
    roles: [
      "School/Section leadership: owns culture consistency and serious escalation.",
      "Teachers and staff: model expectations, respond proportionately and document material incidents.",
      "Student leaders: serve within defined authority and are accountable for conduct and handover.",
      "Learners: understand expectations, repair harm where appropriate and participate in constructive voice channels.",
    ],
    rules: [
      "Material incidents are recorded before they are treated as closed.",
      "Consequences must relate to behaviour, safety, restoration or accountability rather than personal anger.",
      "Student leaders may not exercise disciplinary powers reserved for staff.",
      "Repeated attendance or punctuality patterns require intervention rather than endless isolated warnings.",
    ],
    exceptions: [
      "Immediate safety risks may require temporary removal or restriction before restorative steps occur.",
    ],
    escalation: [
      "Safeguarding concerns leave the ordinary behaviour pathway immediately.",
      "Serious/repeated incidents escalate to the designated school leader with parent communication where appropriate.",
    ],
    evidence: [
      "Culture expectations and induction records.",
      "Incident, restorative action and escalation records.",
      "Recognition records.",
      "Student voice/council records and reviews.",
      "Attendance and punctuality intervention evidence.",
    ],
  },
  EVT: {
    purpose: "ensure every school event or special programme is purposeful, safe, financially controlled and operationally ready",
    scope: "school events, external participants, trips, competitions, showcases, vendors, venues, consent, payments and programme close-out",
    principles: [
      "No event proceeds without a clear purpose, accountable owner and approval.",
      "Safeguarding and safety are designed before promotion and execution.",
      "Budget and commercial commitments are approved before money is committed.",
      "Participant information, consent and payments are traceable.",
      "Every event closes with reconciliation, evidence and learning.",
    ],
    statements: [
      "Each material event has an approved charter defining purpose, owner, date, audience, budget and success criteria.",
      "Risk, safeguarding, venue, transport and emergency arrangements are proportionate to the activity.",
      "External participants, vendors and volunteers operate under the school's safeguarding and access expectations.",
      "Event income and expenditure follow normal financial governance.",
      "Post-event close-out records attendance, incidents, finances, outcomes and lessons.",
    ],
    roles: [
      "Event owner: accountable for planning, delivery, evidence and close-out.",
      "School Guardian: approves operational readiness and unresolved material risks.",
      "Finance/Admin: controls budget, collections, payments and reconciliation.",
      "Safeguarding/operations owners: review risks within their authority.",
    ],
    rules: [
      "Public promotion must not begin before the event has an accountable owner and approval path.",
      "Required consent, participant data and payment status must be known before participation.",
      "Vendors may not receive informal commitments outside procurement/financial authority.",
      "Material event changes require documented re-approval of affected risks or costs.",
    ],
    exceptions: [
      "Urgent school-community responses may use abbreviated planning only where minimum safety, authority and finance controls remain intact.",
    ],
    escalation: [
      "Unresolved safety, safeguarding, funding, venue or staffing risks escalate before the event proceeds.",
      "Serious incidents move into the relevant safeguarding, safety or financial investigation pathway.",
    ],
    evidence: [
      "Event charter and approvals.",
      "Risk assessment, safeguarding and emergency plan.",
      "Registration, consent and payment records.",
      "Vendor, venue and logistics evidence.",
      "Attendance, incident, financial reconciliation and close-out records.",
    ],
  },
  ACD: {
    purpose: "protect consistent, high-quality teaching, learning, assessment and academic assurance",
    scope: "curriculum, planning, teaching, assessment, examinations, monitoring, intervention and academic records",
    principles: [
      "Curriculum intent is translated into visible plans and learner outcomes.",
      "Teaching quality is supported through preparation, observation and evidence.",
      "Assessment evidence is valid, fair and used to improve learning.",
      "Academic risks are identified early and acted on.",
    ],
    statements: [
      "Academic delivery follows approved curriculum, timetable and quality expectations.",
      "Assessment and examination controls protect integrity and fairness.",
      "Missed learning and identified gaps require a recovery or intervention response.",
      "Academic monitoring produces action, not only observation.",
    ],
    roles: [
      "Academic Inspector: owns academic assurance and monitoring.",
      "Section leaders: coordinate delivery, learner progress and intervention.",
      "Teachers: plan, teach, assess, record and respond to evidence.",
    ],
    rules: [
      "Required academic evidence must be completed honestly and on time.",
      "Assessment results may not be altered outside an authorised correction path.",
      "Material learner risk requires a named intervention owner.",
    ],
    exceptions: [
      "Reasonable learner accommodations may alter delivery or assessment method without lowering unauthorised standards.",
    ],
    escalation: [
      "Integrity, repeated delivery failure or serious learner-risk concerns escalate to academic leadership.",
    ],
    evidence: [
      "Schemes, plans and timetables.",
      "Lesson and observation records.",
      "Assessment/exam evidence and results.",
      "Intervention and recovery records.",
    ],
  },
  PEO: {
    purpose: "ensure the school attracts, appoints, deploys, develops and exits people fairly and safely",
    scope: "workforce planning, recruitment, appointment, onboarding, attendance, performance, conduct, development, succession and exit",
    principles: [
      "Safer recruitment and learner protection are non-negotiable.",
      "Roles, expectations and authority must be clear.",
      "Performance management is evidence-based and improvement-oriented.",
      "Staff concerns and discipline receive fair process.",
    ],
    statements: [
      "Every active staff member has an approved appointment and role placement.",
      "Recruitment and clearance evidence is completed before unrestricted duty.",
      "Attendance, leave, performance and conduct are managed through documented pathways.",
      "Exit includes access removal, handover and institutional knowledge protection.",
    ],
    roles: [
      "School leadership: owns workforce decisions within authority.",
      "Line/role leaders: set expectations, coach and evidence performance.",
      "Staff: meet role expectations, disclose conflicts and preserve school property/data.",
    ],
    rules: [
      "No one self-approves their own appointment, promotion or formal disciplinary outcome.",
      "Required safer-recruitment evidence cannot be waived informally.",
      "Performance decisions must be supported by evidence and communicated to the staff member.",
    ],
    exceptions: [
      "Temporary emergency cover must still have a named authority, defined duration and safeguarding controls.",
    ],
    escalation: [
      "Safeguarding allegations leave ordinary staff-performance handling immediately.",
      "Serious misconduct, grievance or unresolved capability concerns escalate through the authorised People pathway.",
    ],
    evidence: [
      "Workforce plan and vacancy approvals.",
      "Recruitment, clearance and appointment records.",
      "Attendance, performance, development and conduct records.",
      "Exit, clearance and handover evidence.",
    ],
  },
  HPD: {
    purpose: "discover, develop and deploy learner potential through evidence, authentic work and progressive responsibility",
    scope: "potential discovery, skills, projects, entrepreneurship, leadership, portfolios and learner transition",
    principles: [
      "Potential is broader than academic scores.",
      "Learners develop through doing, reflection, feedback and increasingly authentic responsibility.",
      "Evidence of contribution matters more than activity completion alone.",
      "Safety and ethics remain part of every authentic opportunity.",
    ],
    statements: [
      "Learner potential evidence informs opportunities and support.",
      "Skills and projects generate demonstrable capability evidence.",
      "Entrepreneurship and leadership opportunities are age-appropriate, supervised and evidence-based.",
      "Portfolios show growth, contribution and readiness for next steps.",
    ],
    roles: [
      "HPD/skills leaders: design opportunities and maintain quality.",
      "Teachers/coaches: observe, challenge, support and record evidence.",
      "Learners: own goals, participation, reflection and portfolio evidence.",
    ],
    rules: [
      "Participation alone is not treated as proof of capability.",
      "Real-money, external or higher-risk activity follows additional approval controls.",
      "Learner evidence must identify the learner's own contribution.",
    ],
    exceptions: [
      "Opportunities may be adapted for access needs while preserving authentic development goals.",
    ],
    escalation: [
      "Safety, safeguarding, finance or external commitment concerns move to the relevant protected pathway.",
    ],
    evidence: [
      "Potential profiles and evidence.",
      "Skills/project milestones.",
      "Portfolio and defence/showcase evidence.",
      "Transition and readiness records.",
    ],
  },
  LPI: {
    purpose: "identify learner risk early and provide structured support until recovery, progression or escalation is evidenced",
    scope: "learner baselines, progress, risk, diagnosis, intervention, reassessment, progression and parent partnership",
    principles: [
      "Intervention begins from evidence, not labels.",
      "Support has a defined owner, action and review point.",
      "Families are partners where appropriate.",
      "Closure requires evidence of recovery or an explicit next-step decision.",
    ],
    statements: [
      "Learner baselines and progress evidence are reviewed for emerging risk.",
      "Identified gaps lead to diagnosis before high-cost intervention.",
      "Intervention plans state actions, ownership, review date and success evidence.",
      "Progression decisions consider the learner's documented evidence and support history.",
    ],
    roles: [
      "Academic/section leaders: ensure risks are owned and reviewed.",
      "Teachers/intervention owners: deliver support and record evidence.",
      "Parents/guardians: contribute where home partnership is required.",
    ],
    rules: [
      "A learner-risk flag cannot be closed without evidence or a documented authorised decision.",
      "Support actions must be specific enough to monitor.",
      "Sensitive learner information is shared only as needed for support.",
    ],
    exceptions: [
      "Urgent welfare or safeguarding concerns bypass routine academic intervention sequencing.",
    ],
    escalation: [
      "Persistent non-response, complex needs or safeguarding concerns escalate to the appropriate specialist/leadership path.",
    ],
    evidence: [
      "Baseline and progress records.",
      "Diagnosis and intervention plans.",
      "Parent partnership records.",
      "Reassessment, closure and progression decisions.",
    ],
  },
  IPA: {
    purpose: "turn school performance evidence into accountable review, improvement and institutional learning",
    scope: "KPIs, scorecards, reviews, improvement plans, root-cause analysis, benchmarking and programme evaluation",
    principles: [
      "Measures exist to drive action, not decorate dashboards.",
      "Owners are accountable for both results and corrective action.",
      "Evidence quality matters as much as reported status.",
      "Institutional learning is captured so repeated failures reduce over time.",
    ],
    statements: [
      "Critical outcomes have defined measures, owners and review rhythms.",
      "Material gaps produce an owned improvement action or accepted risk decision.",
      "Repeated issues trigger root-cause review rather than repeated temporary fixes.",
      "Reviews distinguish evidence, interpretation, decision and action.",
    ],
    roles: [
      "School leadership: reviews performance and assigns corrective action.",
      "KPI/control owners: maintain evidence and explain variance.",
      "Action owners: close agreed improvements with evidence.",
    ],
    rules: [
      "A performance status cannot be treated as green without supporting evidence.",
      "Overdue corrective actions remain visible until closed or formally re-decided.",
      "Metric definitions may not be changed retrospectively to improve reported results.",
    ],
    exceptions: [
      "A metric may be temporarily suspended only with a documented reason, owner and replacement evidence path.",
    ],
    escalation: [
      "Persistent critical underperformance escalates to the School Custodian and relevant system owner.",
    ],
    evidence: [
      "KPI definitions and measurements.",
      "Review minutes and decisions.",
      "Improvement plans and closure evidence.",
      "Root-cause, benchmark and evaluation records.",
    ],
  },
};

const DEFAULT_POLICY = POLICY_DOMAINS.GOV;

function policyDomain(policy: Pick<KhposOpsPolicy, "code">) {
  return POLICY_DOMAINS[policy.code.split("-")[0]] ?? DEFAULT_POLICY;
}

export function getKaecPolicyBaseline(
  policy: Pick<KhposOpsPolicy, "code" | "name" | "ownerLabel" | "priority">,
): PolicyBaseline {
  const domain = policyDomain(policy);
  const focus = policy.name.replace(/\s+Policy$/i, "");
  const critical =
    policy.priority === "C0"
      ? "This is a critical control: material exceptions require School Custodian oversight."
      : policy.priority === "C1"
        ? "This control is reviewed by the relevant school leader and escalated when material risk emerges."
        : "This enabling control is reviewed on the school's normal institutional review cycle.";

  return {
    purpose: `To establish the school-wide rules and responsibilities for ${focus.toLowerCase()} so that the school can ${domain.purpose}.`,
    scope: `This policy applies to ${domain.scope}. It governs every school activity materially connected to ${focus.toLowerCase()}.`,
    principles: [...domain.principles],
    policyStatements: [
      `The school will manage ${focus.toLowerCase()} through a documented, accountable and evidence-based control.`,
      ...domain.statements,
      critical,
    ],
    rolesResponsibilities: [
      `${policy.ownerLabel}: owns implementation of this policy, monitors compliance and initiates review when conditions change.`,
      ...domain.roles,
    ],
    rules: [
      `Actions under ${focus.toLowerCase()} must follow this approved policy and the governing KHP-OS process rather than informal custom.`,
      ...domain.rules,
    ],
    exceptions: [...domain.exceptions],
    escalation: [...domain.escalation],
    recordsEvidence: [
      `Records directly demonstrating compliance with ${focus.toLowerCase()}.`,
      ...domain.evidence,
    ],
  };
}

const PROCESS_DOMAINS: Record<string, ProcessDomainBlueprint> = {
  SAF: {
    trigger: "A safeguarding, welfare, safety or learner-protection concern is observed, disclosed, reported or becomes reasonably suspected.",
    inputs: [
      "Immediate facts known at the time.",
      "Learner identity/location where known.",
      "Immediate protective action already taken.",
      "Current designated safeguarding contacts.",
    ],
    steps: [
      "Protect the learner and address immediate danger before administrative processing.",
      "Listen and record factual information without conducting an unauthorised investigation.",
      "Contact the appropriate designated safeguarding person directly and avoid routing to an implicated person.",
      "Create or update the restricted safeguarding record and preserve the reporter receipt/reference.",
      "The designated lead triages risk, decides referral/protection actions and records follow-up ownership.",
      "Complete follow-up, required external cooperation and independent closure review.",
    ],
    evidence: [
      "Restricted concern/case record.",
      "Protection and triage record.",
      "Referral/follow-up evidence where applicable.",
      "Closure or ongoing monitoring record.",
    ],
    outcome: "The learner is protected, the concern reaches the correct authorised pathway, actions are traceable and confidentiality is preserved.",
    exceptions: [
      "Immediate danger requires emergency protective action before routine workflow steps.",
      "If a designated person is implicated, the case routes to the other designated/independent authority path.",
    ],
    escalation: [
      "Immediate danger or serious harm: emergency/protective response without delay.",
      "Staff/adult allegation or designated-person implication: independent safeguarding escalation.",
      "Required external referral: contact the appropriate authority under the school's safeguarding framework.",
    ],
    kpis: [
      "Urgent concerns receive immediate protective action.",
      "100% of accepted cases have designated ownership.",
      "No case is closed without follow-up evidence and review.",
    ],
    sla: "Immediate protection; same-day designated safeguarding triage for urgent concerns.",
  },
  FIN: {
    trigger: "A fee, payment, collection, expense, procurement, concession, refund, sponsorship, donation or reconciliation action requires processing.",
    inputs: [
      "Approved financial authority/budget where applicable.",
      "Payer, payee, learner, vendor or transaction reference.",
      "Invoice, request, fee obligation or supporting evidence.",
      "Required approval and conflict-of-interest disclosure where applicable.",
    ],
    steps: [
      "Confirm the transaction purpose, amount, authority and supporting evidence.",
      "Separate request, approval, payment/collection and reconciliation responsibilities where material.",
      "Obtain the required approval before commitment or release of funds.",
      "Record the transaction against the correct person, vendor, budget or obligation.",
      "Retain receipt/invoice/payment evidence and communicate the authorised outcome.",
      "Reconcile the transaction and investigate any variance or outstanding balance.",
    ],
    evidence: [
      "Authorised request/approval.",
      "Invoice, receipt or payment evidence.",
      "Ledger/receivable record.",
      "Reconciliation and variance record where applicable.",
    ],
    outcome: "The financial action is authorised, accurately recorded, evidenced, communicated and reconcilable.",
    exceptions: [
      "Emergency safety/continuity spending may use approved emergency authority with retrospective review.",
    ],
    escalation: [
      "Unauthorised commitment, suspected fraud, shortage or unexplained variance to School Custodian.",
      "Unresolved payment or receivable dispute to the authorised Finance/School leadership pathway.",
    ],
    kpis: [
      "100% of material transactions have required approval evidence.",
      "Reconciliations completed within the defined cycle.",
      "Outstanding exceptions remain visible until resolved.",
    ],
    sla: "Process authorised transactions promptly; critical exceptions are escalated the same operating day.",
  },
  OPS: {
    trigger: "A campus operating cycle, readiness check, facility need, asset movement, access request, maintenance issue or safety condition requires action.",
    inputs: [
      "Applicable checklist, asset/facility/access record or reported issue.",
      "Campus/location and accountable owner.",
      "Current risk/severity and any temporary control.",
      "Required vendor, resource or approval information.",
    ],
    steps: [
      "Identify the exact operational requirement, location, owner and risk level.",
      "Complete the required check or verify the reported condition using observable evidence.",
      "Where unsafe, isolate the hazard or apply an authorised temporary control.",
      "Assign the corrective/operating action, due point and responsible person.",
      "Record completion evidence, asset/access changes or vendor service details.",
      "Verify closure and escalate repeated or unresolved failure for root-cause action.",
    ],
    evidence: [
      "Checklist or issue record.",
      "Photo/reference/service evidence where appropriate.",
      "Asset/access/vendor record where relevant.",
      "Verified closure or escalation record.",
    ],
    outcome: "The campus remains safe, ready and traceable, with operational exceptions visibly owned until verified closed.",
    exceptions: [
      "Temporary workarounds require a named owner, risk control and expiry/review point.",
    ],
    escalation: [
      "Life-safety, security, structural, utilities or critical access failures immediately to School Guardian.",
      "Repeated/unresolved operational defects to School Custodian and relevant owner.",
    ],
    kpis: [
      "Critical readiness checks completed before normal use.",
      "P0 operational exceptions have same-day ownership.",
      "Preventive/repair actions close with verification evidence.",
    ],
    sla: "P0 safety/readiness issues: immediate containment and same-day ownership; other issues by assigned due date.",
  },
  PAR: {
    trigger: "A prospective or current family enters a defined admissions, communication, consent, complaint, retention or exit stage.",
    inputs: [
      "Family/learner identity and contact information.",
      "Relevant application, learner, consent or complaint information.",
      "Required evidence for the current stage.",
      "Applicable school policy, fee or placement information.",
    ],
    steps: [
      "Log the family interaction or stage and identify the accountable owner.",
      "Verify the information/evidence required before making the next-stage decision.",
      "Complete the authorised assessment, communication, consent or resolution action.",
      "Record the decision, commitment, meeting or response and any required approval.",
      "Communicate the outcome clearly to the family and state the next action/deadline.",
      "Complete handover, follow-up or closure evidence before marking the stage complete.",
    ],
    evidence: [
      "Application/family record.",
      "Assessment, consent, meeting or complaint evidence as applicable.",
      "Authorised decision/communication.",
      "Handover, follow-up or closure record.",
    ],
    outcome: "The learner-family journey advances through a clear, fair and traceable stage with no hidden promise or missing handover.",
    exceptions: [
      "Urgent welfare/safeguarding concerns leave the ordinary parent journey and enter the protected pathway.",
    ],
    escalation: [
      "Serious complaint, legal, safeguarding, discrimination or financial dispute to the authorised specialist/leadership path.",
      "Unresolved ordinary complaint to the next uninvolved authorised role.",
    ],
    kpis: [
      "Required records complete before stage closure.",
      "Family receives an explicit next step or resolution.",
      "No material complaint remains ownerless.",
    ],
    sla: "Acknowledge material family matters promptly; use the school-defined due point for resolution and escalation.",
  },
  EVT: {
    trigger: "A new event/programme is proposed or an approved event reaches a planning, registration, delivery or close-out milestone.",
    inputs: [
      "Event purpose, audience, owner, proposed date/location and success criteria.",
      "Safeguarding/safety, staffing and logistics requirements.",
      "Budget, revenue/payment assumptions and required approvals.",
      "Participant/consent requirements.",
    ],
    steps: [
      "Define the event charter, accountable owner, purpose and success criteria.",
      "Obtain required calendar/authority approval before material commitment or promotion.",
      "Complete safeguarding, risk, staffing, venue, transport and emergency planning.",
      "Approve budget/commercial plan and control participant registration, consent and payments.",
      "Verify operational readiness before event start and manage incidents through protected pathways.",
      "Complete attendance, financial reconciliation, outcome review and lessons learned.",
    ],
    evidence: [
      "Approved charter/calendar record.",
      "Risk/safeguarding/readiness evidence.",
      "Registration, consent and payment records.",
      "Budget/vendor/logistics evidence.",
      "Event close-out and reconciliation.",
    ],
    outcome: "The event is purposeful, safe, financially controlled, well-evidenced and closed with institutional learning.",
    exceptions: [
      "Abbreviated planning is allowed only for genuinely urgent activity and must retain minimum authority, safety and finance controls.",
    ],
    escalation: [
      "Unresolved safety, safeguarding, budget, venue or staffing risk before execution.",
      "Serious incidents into the relevant safeguarding, safety or financial pathway.",
    ],
    kpis: [
      "100% of material events have an accountable owner and approval.",
      "Required consent/risk controls complete before participation.",
      "Financial and operational close-out completed after the event.",
    ],
    sla: "Approval and readiness must be complete before the relevant commitment or event start.",
  },
  CUL: {
    trigger: "A student culture, behaviour, attendance, recognition, voice or leadership action requires a documented response.",
    inputs: [
      "Observed facts and learner/context information.",
      "Applicable expectation, prior pattern or leadership role.",
      "Immediate safety/welfare information.",
      "Relevant parent or staff input where appropriate.",
    ],
    steps: [
      "Clarify the facts, expectation and immediate safety/welfare needs.",
      "Use the least escalated response proportionate to the issue or opportunity.",
      "For behaviour harm, use restorative/accountability action where appropriate.",
      "Record material incidents, recognition, student voice or leadership decisions.",
      "Engage parent/leadership support where the defined threshold is reached.",
      "Review repeated patterns, verify agreed action and close or escalate.",
    ],
    evidence: [
      "Culture/incident/recognition/voice record.",
      "Restorative or corrective action evidence.",
      "Parent/leadership communication where applicable.",
      "Review, recall, handover or closure record.",
    ],
    outcome: "Student culture is strengthened through clear expectations, dignity, accountability, voice and evidence-based escalation.",
    exceptions: [
      "Immediate safety or safeguarding risk may require protective restriction before ordinary restorative sequencing.",
    ],
    escalation: [
      "Safeguarding concerns immediately to the safeguarding pathway.",
      "Serious/repeated misconduct or leadership failure to the designated school leader.",
    ],
    kpis: [
      "Material cases have an owner and recorded outcome.",
      "Repeated patterns trigger review rather than repeated isolated responses.",
      "Student leadership transitions include review/handover where applicable.",
    ],
    sla: "Immediate safety response; material culture incidents assigned and recorded the same school day where practicable.",
  },
  GOV: {
    trigger: "A controlled decision, document, authority, compliance, record, contract, partnership, continuity or institutional change requires action.",
    inputs: [
      "Matter requiring governance action.",
      "Applicable authority, policy, contract or regulatory requirement.",
      "Evidence required for the decision.",
      "Affected people, systems or implementation owners.",
    ],
    steps: [
      "Identify the decision/control owner and required authority.",
      "Gather the minimum reliable evidence and applicable policy/regulatory requirements.",
      "Make or route the decision to the authorised uninvolved approver.",
      "Record the decision, rationale, effective point and implementation owner.",
      "Communicate the controlled outcome to affected roles.",
      "Verify implementation and retain the evidence/history required for review.",
    ],
    evidence: [
      "Decision/approval record.",
      "Controlled document or contractual evidence.",
      "Communication/acknowledgement where required.",
      "Implementation and review evidence.",
    ],
    outcome: "Institutional action is authorised, traceable, communicated and implemented without relying on undocumented personal knowledge.",
    exceptions: [
      "Emergency action may precede normal approval only where delay creates material harm; retrospective review is mandatory.",
    ],
    escalation: [
      "Legal, safeguarding, financial, data or authority breach immediately to School Custodian.",
      "Unresolved authority conflict to the highest uninvolved authorised role.",
    ],
    kpis: [
      "Critical decisions contain owner, authority and evidence.",
      "Controlled documents retain version history.",
      "Material exceptions have a review/expiry point.",
    ],
    sla: "Urgent governance risks same day; routine matters by their controlled due date.",
  },
  ACD: {
    trigger: "An academic planning, delivery, monitoring, assessment or learner-risk control reaches its scheduled point or exception threshold.",
    inputs: [
      "Approved curriculum/scheme/timetable or assessment requirement.",
      "Teacher/learner/class evidence.",
      "Applicable academic standard and owner.",
      "Prior progress, exception or intervention information.",
    ],
    steps: [
      "Confirm the academic requirement, owner, class/learner scope and due point.",
      "Complete the planned teaching/assessment/monitoring action using the approved standard.",
      "Record objective evidence and any variance from expectation.",
      "Address immediate recoverable gaps and assign unresolved academic risk.",
      "Escalate integrity, repeated delivery or serious learner-risk concerns.",
      "Verify recovery/closure and feed learning into the next academic cycle.",
    ],
    evidence: [
      "Academic plan/delivery record.",
      "Assessment, observation or progress evidence.",
      "Intervention/recovery evidence where applicable.",
      "Verified closure or academic decision.",
    ],
    outcome: "Academic delivery remains controlled, evidence-led and responsive to learner risk.",
    exceptions: [
      "Approved accommodations may adapt method while maintaining authorised academic expectations.",
    ],
    escalation: [
      "Integrity breach, repeated missed delivery or serious learner risk to academic leadership.",
    ],
    kpis: [
      "Required academic evidence completed on schedule.",
      "P0 academic exceptions have named ownership.",
      "Recovery/intervention closes with evidence.",
    ],
    sla: "Follow the academic calendar; P0 exceptions receive same-day ownership.",
  },
  PEO: {
    trigger: "A workforce, recruitment, appointment, deployment, availability, performance, conduct, development or exit event requires action.",
    inputs: [
      "Approved role/workforce requirement.",
      "Staff/candidate identity and applicable evidence.",
      "Required authority, policy and due point.",
      "Safeguarding or conflict information where applicable.",
    ],
    steps: [
      "Confirm the People action, authority, owner and evidence requirements.",
      "Complete the required assessment, clearance, approval or documented conversation.",
      "Record the decision/action and communicate expectations to the affected person.",
      "Complete required deployment, development, support, correction or handover actions.",
      "Escalate safeguarding, grievance, serious conduct or unresolved capability through the protected pathway.",
      "Verify closure, access changes and retained evidence.",
    ],
    evidence: [
      "People request/decision record.",
      "Clearance, appointment, attendance, performance or conduct evidence as applicable.",
      "Communication and approval evidence.",
      "Closure/handover/access evidence.",
    ],
    outcome: "The school has the right person, authority, evidence and follow-through for the People action.",
    exceptions: [
      "Temporary emergency cover requires explicit authority, duration and safeguarding controls.",
    ],
    escalation: [
      "Safeguarding allegation immediately out of ordinary People handling.",
      "Serious grievance, misconduct or unresolved capability to authorised leadership.",
    ],
    kpis: [
      "Required safer-recruitment controls complete before unrestricted duty.",
      "Material People actions have explicit authority.",
      "Exit includes handover and access removal.",
    ],
    sla: "Safety/clearance exceptions immediately; other People actions by their documented due point.",
  },
  HPD: {
    trigger: "A learner potential, skills, project, entrepreneurship, leadership, portfolio or transition milestone requires action.",
    inputs: [
      "Learner identity and current evidence.",
      "Capability/opportunity objective.",
      "Coach/owner and milestone expectations.",
      "Safety, finance or external-participation controls where relevant.",
    ],
    steps: [
      "Define the capability objective, opportunity and evidence expected from the learner.",
      "Establish ownership, milestone and any safety/approval boundaries.",
      "Allow the learner to perform authentic work with proportionate support.",
      "Capture the learner's own contribution, reflection and feedback.",
      "Review evidence against the capability objective and decide next challenge/support.",
      "Link verified evidence to the learner portfolio/readiness record.",
    ],
    evidence: [
      "Opportunity/milestone record.",
      "Learner work and individual contribution evidence.",
      "Feedback/reflection.",
      "Portfolio or readiness link.",
    ],
    outcome: "Learner potential is developed through authentic, evidenced contribution and progressively greater responsibility.",
    exceptions: [
      "Access accommodations may adapt how the learner participates without fabricating capability evidence.",
    ],
    escalation: [
      "Safety, safeguarding, real-money or external commitment concerns to the relevant authorised pathway.",
    ],
    kpis: [
      "Learner evidence identifies individual contribution.",
      "Milestones lead to verified feedback or next action.",
      "Verified capability evidence reaches the learner portfolio.",
    ],
    sla: "Review at the defined milestone; safety/real-money exceptions before the activity proceeds.",
  },
  LPI: {
    trigger: "Learner evidence crosses a risk threshold, a planned review is due, or intervention progress requires reassessment.",
    inputs: [
      "Baseline/current learner evidence.",
      "Risk/gap signal and relevant context.",
      "Existing intervention/support history.",
      "Parent/specialist evidence where appropriate.",
    ],
    steps: [
      "Verify the risk signal and gather enough evidence to describe the gap.",
      "Diagnose likely learning/support needs before selecting intervention.",
      "Create a specific intervention with owner, actions, evidence and review date.",
      "Deliver the intervention and record implementation evidence.",
      "Reassess progress and involve family/specialist support where appropriate.",
      "Close with recovery evidence or escalate to the next support/progression decision.",
    ],
    evidence: [
      "Risk/diagnosis record.",
      "Intervention plan and delivery evidence.",
      "Parent/support communication where applicable.",
      "Reassessment and closure/progression decision.",
    ],
    outcome: "Learner risk is visibly owned and supported until recovery or an explicit next-step decision is evidenced.",
    exceptions: [
      "Safeguarding/welfare concerns bypass routine academic intervention sequencing.",
    ],
    escalation: [
      "Persistent non-response or complex need to the appropriate academic/support leader.",
      "Safeguarding concern to the safeguarding pathway.",
    ],
    kpis: [
      "No P0 learner risk remains ownerless.",
      "Interventions contain review dates and measurable evidence.",
      "Closure requires recovery evidence or authorised escalation.",
    ],
    sla: "P0 learner risk assigned promptly; reviews occur by the intervention due date.",
  },
  IPA: {
    trigger: "A KPI, review cycle, performance exception, improvement action or institutional learning milestone becomes due.",
    inputs: [
      "Current measure/status and supporting evidence.",
      "Target/standard and accountable owner.",
      "Open issues/actions from prior review.",
      "Relevant learner, people, finance or operational context.",
    ],
    steps: [
      "Verify current evidence and compare performance with the defined standard.",
      "Separate fact, interpretation, root cause and proposed action.",
      "Assign corrective action or record an authorised risk/decision.",
      "Track owner, due date and evidence until closure.",
      "Escalate persistent critical underperformance or repeated failure.",
      "Capture institutional learning and update the relevant control where needed.",
    ],
    evidence: [
      "KPI/scorecard evidence.",
      "Review decision/action log.",
      "Improvement/root-cause evidence.",
      "Verified closure and learning capture.",
    ],
    outcome: "Performance evidence results in clear decisions, owned improvement and retained institutional learning.",
    exceptions: [
      "A metric may be suspended only with documented authority, reason and replacement evidence.",
    ],
    escalation: [
      "Persistent critical underperformance to School Custodian and relevant system owner.",
    ],
    kpis: [
      "Critical measures have current evidence.",
      "Overdue actions remain visible until re-decided or closed.",
      "Repeated issues trigger root-cause review.",
    ],
    sla: "Follow the defined review rhythm; P0 exceptions receive same-cycle action ownership.",
  },
};

const DEFAULT_PROCESS = PROCESS_DOMAINS.GOV;

function processDomain(process: Pick<KhposOpsProcess, "code">) {
  return PROCESS_DOMAINS[process.code.split("-")[0]] ?? DEFAULT_PROCESS;
}

function titleSpecificSteps(title: string): string[] {
  const lower = title.toLowerCase();

  if (/(opening|readiness inspection|closing)/.test(lower)) {
    return [
      "Use the approved campus checklist rather than relying on memory.",
      "Mark each critical control from direct observation and record every exception before sign-off.",
    ];
  }
  if (/(complaint|concern)/.test(lower) && !/safeguard/.test(lower)) {
    return [
      "Acknowledge the matter, create a case/record and identify an uninvolved owner.",
      "Separate the complainant's account, verified facts, decision and corrective action.",
    ];
  }
  if (/(admission|application|selection|placement|offer)/.test(lower)) {
    return [
      "Verify the learner/family record is complete enough for the current decision stage.",
      "Do not communicate an admission or placement commitment before authorised decision evidence exists.",
    ];
  }
  if (/(cash|payment|fees|reconciliation|procurement|expense|budget)/.test(lower)) {
    return [
      "Verify financial authority and supporting evidence before commitment or posting.",
      "Preserve separation between request, approval and reconciliation where material.",
    ];
  }
  if (/(emergency|missing|injury|illness|safeguard|harm|allegation)/.test(lower)) {
    return [
      "Address immediate safety/protection before normal administration.",
      "Preserve facts, route to the authorised protected pathway and avoid unauthorised investigation.",
    ];
  }
  return [];
}

export function getKaecProcessBaseline(
  process: Pick<
    KhposOpsProcess,
    | "code"
    | "title"
    | "ownerLabel"
    | "criticality"
    | "governingPolicyCodes"
    | "technology"
  >,
): ProcessBaseline {
  const domain = processDomain(process);
  const specific = titleSpecificSteps(process.title);
  const criticality =
    process.criticality === "P0"
      ? "P0 process: failure or delay can materially affect safety, learning, integrity, finance or school continuity."
      : process.criticality === "P1"
        ? "P1 process: monitor timeliness and repeated exceptions closely."
        : "P2 process: execute within the planned institutional cycle.";

  return {
    purpose: `To execute ${process.title.toLowerCase()} consistently, safely and accountably, with clear ownership, evidence and escalation.`,
    trigger: domain.trigger,
    inputs: [
      ...domain.inputs,
      ...(process.governingPolicyCodes.length
        ? [`Active governing policies: ${process.governingPolicyCodes.join(", ")}.`]
        : []),
    ],
    steps: [
      `Confirm the accountable owner for ${process.title.toLowerCase()} and the required completion point.`,
      ...specific,
      ...domain.steps,
      `Before closure, verify the outcome and retain the evidence required for ${process.title.toLowerCase()}.`,
    ],
    sla: `${domain.sla} ${criticality}`,
    evidence: [...domain.evidence],
    expectedOutcome: `${domain.outcome} Specifically, ${process.title.toLowerCase()} is complete only when its required outcome and evidence are verified.`,
    exceptionConditions: [...domain.exceptions],
    escalation: [...domain.escalation],
    kpis: [
      ...domain.kpis,
      `Exceptions in ${process.title.toLowerCase()} remain visible until verified closed or formally re-decided.`,
    ],
  };
}
