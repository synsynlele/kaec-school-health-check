/**
 * KAEC School Health Check — Assessment Question Bank
 * 11 chapters × 5 questions = 55 indicators of school health.
 * Each question is rated on a 1–5 maturity scale by the school leader.
 */

export type ChapterKey =
  | "leadership"
  | "teaching"
  | "student_dev"
  | "finance"
  | "infrastructure"
  | "parents"
  | "technology"
  | "governance"
  | "culture"
  | "safety"
  | "innovation";

export interface Chapter {
  key: ChapterKey;
  title: string;
  shortTitle: string;
  description: string;
}

export const CHAPTERS: Chapter[] = [
  { key: "leadership", title: "Leadership & Vision", shortTitle: "Leadership", description: "Clarity of direction and quality of school leadership." },
  { key: "teaching", title: "Teaching Quality", shortTitle: "Teaching", description: "Planning, delivery and continuous improvement of teaching." },
  { key: "student_dev", title: "Student Development & Wellbeing", shortTitle: "Student Development", description: "Academic growth, behaviour, wellbeing and student voice." },
  { key: "finance", title: "Financial Health", shortTitle: "Finance", description: "Budget discipline, income, reserves and record-keeping." },
  { key: "infrastructure", title: "Infrastructure & Facilities", shortTitle: "Infrastructure", description: "Classrooms, resources, sanitation and maintenance." },
  { key: "parents", title: "Parent & Community Engagement", shortTitle: "Parents", description: "Communication, trust and partnership with families." },
  { key: "technology", title: "Technology & Digital Learning", shortTitle: "Technology", description: "Systems, digital teaching and data security." },
  { key: "governance", title: "Governance & Compliance", shortTitle: "Governance", description: "Oversight, policies, compliance and continuity." },
  { key: "culture", title: "School Culture & Values", shortTitle: "Culture", description: "Values in practice, staff morale and belonging." },
  { key: "safety", title: "Safety & Child Protection", shortTitle: "Safety", description: "Safeguarding, emergencies and a safe environment." },
  { key: "innovation", title: "Innovation & Growth", shortTitle: "Innovation", description: "Improvement mindset, enrolment growth and future plans." },
];

export const CHAPTER_MAP: Record<ChapterKey, Chapter> = Object.fromEntries(
  CHAPTERS.map((c) => [c.key, c]),
) as Record<ChapterKey, Chapter>;

export interface QuestionItem {
  id: string;
  chapter: ChapterKey;
  text: string;
  hint: string;
}

function q(chapter: ChapterKey, n: number, text: string, hint: string): QuestionItem {
  return { id: `${chapter}_${n}`, chapter, text, hint };
}

export const QUESTIONS: QuestionItem[] = [
  // ── 1. Leadership & Vision ──────────────────────────────────────────────
  q("leadership", 1, "The school has a clear, written vision, mission and improvement plan that leaders actively use to guide decisions.", "Is there a documented plan that leaders reference — not just a slogan on the wall?"),
  q("leadership", 2, "School leaders regularly observe classrooms and give teachers constructive, specific feedback.", "Think about how often leaders are actually inside classrooms each term."),
  q("leadership", 3, "Leadership decisions are made using evidence and data rather than guesswork or habit.", "Do results, attendance and fee data genuinely inform the big decisions?"),
  q("leadership", 4, "Roles, responsibilities and reporting lines are clearly defined and understood by every staff member.", "Would every teacher know exactly who they report to and what they own?"),
  q("leadership", 5, "Leaders model the standards they expect — punctuality, professionalism and integrity.", "Does leadership behaviour set the tone for the whole school?"),

  // ── 2. Teaching Quality ─────────────────────────────────────────────────
  q("teaching", 1, "Teachers plan lessons in advance with clear learning objectives and prepared materials.", "Are lesson notes current, reviewed and actually used in class?"),
  q("teaching", 2, "Lessons actively engage students — questioning, discussion, practice and activities rather than dictation alone.", "Visit a classroom: are pupils doing and thinking, or only copying?"),
  q("teaching", 3, "Teachers check for understanding regularly and adapt their teaching based on the results.", "Do teachers know which pupils are lost before the exam reveals it?"),
  q("teaching", 4, "Staff receive continuous professional development, coaching and peer learning opportunities.", "Is there a real CPD calendar, or training only by accident?"),
  q("teaching", 5, "There is a dependable system for covering absent teachers and supporting underperforming ones.", "When a teacher is absent or struggling, is there a plan or chaos?"),

  // ── 3. Student Development & Wellbeing ──────────────────────────────────
  q("student_dev", 1, "The school tracks each learner's academic progress and identifies struggling students early.", "Could you name, today, the pupils falling behind in each class?"),
  q("student_dev", 2, "Students receive development beyond academics — sports, clubs, arts, leadership and life skills.", "Is the timetable richer than subjects alone?"),
  q("student_dev", 3, "Behaviour and discipline are managed through clear, consistent and positive systems.", "Are rules known, fairly applied, and corrective rather than only punitive?"),
  q("student_dev", 4, "Key transitions — new intakes, class-to-class moves, exam classes — are deliberately supported.", "Do new pupils settle fast? Are exam-year students specifically mentored?"),
  q("student_dev", 5, "Student voice is genuine — learners give feedback, take leadership roles and feel heard.", "Prefects, councils, suggestion channels: do they exist and matter?"),

  // ── 4. Financial Health ─────────────────────────────────────────────────
  q("finance", 1, "The school operates on a written annual budget that is reviewed against actuals regularly.", "Is spending tracked against a plan, or discovered after the money is gone?"),
  q("finance", 2, "Fee income reliably covers operating costs, with a surplus or a credible plan to reach one.", "After salaries and bills, is anything left — or is every term a scramble?"),
  q("finance", 3, "Fee collection rates are high and outstanding debts are followed up systematically.", "What percentage of billed fees is actually collected each term?"),
  q("finance", 4, "The school keeps an emergency reserve covering at least two to three months of expenses.", "If enrolment dipped for a term, would the school survive comfortably?"),
  q("finance", 5, "Financial records are accurate, current and independently reviewed.", "Are books reconciled monthly and checked by someone other than the writer?"),

  // ── 5. Infrastructure & Facilities ──────────────────────────────────────
  q("infrastructure", 1, "Classrooms are adequate in size, light, ventilation and furniture for the number of learners.", "Would you be comfortable learning all day in your least comfortable classroom?"),
  q("infrastructure", 2, "Learning resources — library, laboratories, ICT and teaching aids — are sufficient and genuinely used.", "Do facilities exist only on paper, or are they timetabled and alive?"),
  q("infrastructure", 3, "Sanitation is adequate and hygienic: toilets, clean water and waste management.", "Count toilets against enrolment. Is water always available?"),
  q("infrastructure", 4, "Playgrounds and common spaces are safe, well maintained and fit for purpose.", "Any hazards — open wells, broken slabs, exposed wires, unsafe play equipment?"),
  q("infrastructure", 5, "There is a preventive maintenance plan and repairs are handled promptly.", "Do broken things get fixed in days, or do they become the landscape?"),

  // ── 6. Parent & Community Engagement ────────────────────────────────────
  q("parents", 1, "The school communicates with parents regularly — not only at report-card time.", "Do parents hear from you about progress, events and expectations all term?"),
  q("parents", 2, "Parents can raise concerns easily and receive timely, respectful responses.", "Is there a known channel, and do complaints get answered within days?"),
  q("parents", 3, "Parents are actively involved in school life — events, volunteering and input into decisions.", "Do parents feel like partners or customers kept at arm's length?"),
  q("parents", 4, "The school measures parent satisfaction and visibly acts on the feedback.", "Have parents ever seen something change because they asked?"),
  q("parents", 5, "The school enjoys a strong reputation in the community that drives referrals.", "Do new families mostly arrive by word of mouth from happy parents?"),

  // ── 7. Technology & Digital Learning ────────────────────────────────────
  q("technology", 1, "The school uses a digital system for core records: enrolment, attendance, fees and results.", "Could you produce accurate numbers from a system — not a paper ledger?"),
  q("technology", 2, "Teachers are trained and supported to use digital tools confidently in teaching.", "Do teachers project, share and assess digitally, or avoid the machines?"),
  q("technology", 3, "Students get meaningful, regular access to technology for learning.", "Is the computer room a working learning space or a locked museum?"),
  q("technology", 4, "Communication with parents and staff runs on reliable digital channels.", "Can you reach every parent within an hour when it truly matters?"),
  q("technology", 5, "Student and school data is stored securely, backed up and access-controlled.", "If a laptop was stolen tomorrow, would records be lost or exposed?"),

  // ── 8. Governance & Compliance ──────────────────────────────────────────
  q("governance", 1, "The school is fully registered and compliant with all regulatory and government requirements.", "Approvals, renewals, inspections: is everything current and documented?"),
  q("governance", 2, "An active governing body or advisory board provides real oversight, challenge and support.", "Does anyone beyond the owner rigorously review the school's performance?"),
  q("governance", 3, "Key policies — admissions, staffing, safeguarding, finance — exist in writing and are followed.", "Are policies living documents staff know, or files that gather dust?"),
  q("governance", 4, "Leadership continuity is planned — the school runs well even when key people are absent.", "If the head or proprietor was away for a month, what would break?"),
  q("governance", 5, "Meetings and governance decisions are documented and followed through.", "Do meetings produce minutes, owners and deadlines — or just talk?"),

  // ── 9. School Culture & Values ──────────────────────────────────────────
  q("culture", 1, "The school has explicit values that staff and students can name — and that are visibly practised.", "Ask five people the school's values. Would their answers match?"),
  q("culture", 2, "Staff morale is high — teachers feel respected, supported and proud to work here.", "Would your best teacher recommend this school as a workplace?"),
  q("culture", 3, "Relationships between staff and students are warm, respectful and orderly.", "Is discipline built on respect and routine, or on fear and shouting?"),
  q("culture", 4, "Achievement is celebrated — successes of students and staff are recognised regularly.", "When did the school last publicly honour a pupil or teacher?"),
  q("culture", 5, "New staff and families are deliberately onboarded into the school's culture.", "Is there an induction, or do newcomers just figure it out?"),

  // ── 10. Safety & Child Protection ───────────────────────────────────────
  q("safety", 1, "A written child-protection and safeguarding policy exists and every staff member is trained on it.", "Would every adult in the building know exactly what to report and to whom?"),
  q("safety", 2, "Entry, exit and visitor movement are controlled and monitored throughout the day.", "Could a stranger walk in unnoticed, or a child leave unaccounted for?"),
  q("safety", 3, "Emergency procedures — fire, medical, evacuation — exist, are resourced and are practised.", "When was the last drill? Is there a stocked first-aid point?"),
  q("safety", 4, "Incidents and accidents are recorded, reviewed and used to prevent recurrence.", "Is there an incident log that leadership actually studies?"),
  q("safety", 5, "The environment is free from bullying, harassment and abuse — students report feeling safe.", "Do pupils have safe ways to speak up, and are they believed?"),

  // ── 11. Innovation & Growth ─────────────────────────────────────────────
  q("innovation", 1, "The school regularly introduces improvements based on evidence and feedback.", "Name three things the school deliberately improved in the last year."),
  q("innovation", 2, "Enrolment is stable or growing, guided by a clear recruitment and marketing strategy.", "Are you waiting for admissions season, or working a plan all year?"),
  q("innovation", 3, "Staff are encouraged to try better methods and share what works with colleagues.", "Do good practices spread across classrooms or die inside one?"),
  q("innovation", 4, "The school benchmarks itself against strong schools and recognised standards.", "Do you know how your results, fees and facilities compare to the best nearby?"),
  q("innovation", 5, "There is a realistic, costed development plan for the next one to three years.", "Does 'where we are going' exist as a plan, or only as a wish?"),
];

export const TOTAL_QUESTIONS = QUESTIONS.length;

export const QUESTION_INDEX: Record<string, QuestionItem> = Object.fromEntries(
  QUESTIONS.map((item) => [item.id, item]),
);

export interface RatingOption {
  value: number;
  label: string;
  description: string;
}

export const RATING_OPTIONS: RatingOption[] = [
  { value: 1, label: "Critical Gap", description: "Not in place, or a serious ongoing concern." },
  { value: 2, label: "Weak", description: "Barely established; problems are frequent." },
  { value: 3, label: "Partial", description: "Exists and works sometimes, but inconsistent." },
  { value: 4, label: "Strong", description: "Works reliably and well in most situations." },
  { value: 5, label: "Excellent", description: "Fully embedded, measured and improving." },
];

export const SCHOOL_TYPES = [
  "Nursery / Early Years",
  "Primary School",
  "Secondary School",
  "Combined (Nursery & Primary)",
  "All-through (Nursery to Secondary)",
  "International School",
  "Faith-based School",
  "Special / Inclusive School",
  "Vocational / Technical School",
];

export const SCHOOL_LEVELS = [
  "Early Years",
  "Primary",
  "Junior Secondary",
  "Senior Secondary",
  "All Levels",
];

export const POPULATION_RANGES = [
  "Under 100",
  "100 – 299",
  "300 – 599",
  "600 – 999",
  "1,000 – 1,999",
  "2,000+",
];

export const COUNTRIES = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "Uganda",
  "Rwanda",
  "Tanzania",
  "South Africa",
  "United Kingdom",
  "United States",
  "Canada",
  "United Arab Emirates",
  "Other",
];

export const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT - Abuja","Gombe",
  "Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos",
  "Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto",
  "Taraba","Yobe","Zamfara",
];
