/**
 * KAEC School Health Check — Deterministic Report Engine
 *
 * Produces a complete, professional School Health Report from the raw
 * answers. It acts as (1) the guaranteed report generator and (2) the
 * structured base onto which the OpenAI layer writes richer narrative
 * when an OPENAI_API_KEY is configured.
 */
import {
  CHAPTERS,
  CHAPTER_MAP,
  QUESTION_INDEX,
  type ChapterKey,
} from "./questions";
import { computeScores, ratingFor } from "./scoring";
import type {
  AnswerRecord,
  ChapterAnalysis,
  PlanTask,
  Recommendation,
  ReportData,
  ReportItem,
  SchoolInfo,
  WeaknessItem,
} from "./types";

/* Short topic label for every indicator, used in strengths & weaknesses. */
const ITEM_TOPICS: Record<string, string> = {
  leadership_1: "Clear vision and improvement plan",
  leadership_2: "Leaders present in classrooms",
  leadership_3: "Evidence-based decision-making",
  leadership_4: "Clear roles and accountability",
  leadership_5: "Leadership by example",
  teaching_1: "Disciplined lesson planning",
  teaching_2: "Active, engaging classrooms",
  teaching_3: "Assessment-driven teaching",
  teaching_4: "Teacher development and coaching",
  teaching_5: "Cover and teacher-support systems",
  student_dev_1: "Early tracking of learner progress",
  student_dev_2: "Development beyond academics",
  student_dev_3: "Positive, consistent discipline",
  student_dev_4: "Supported student transitions",
  student_dev_5: "Genuine student voice",
  finance_1: "Budget discipline",
  finance_2: "Sustainable fee income",
  finance_3: "Strong fee collection",
  finance_4: "Emergency financial reserves",
  finance_5: "Reliable financial records",
  infrastructure_1: "Adequate, comfortable classrooms",
  infrastructure_2: "Well-used learning resources",
  infrastructure_3: "Hygienic sanitation and water",
  infrastructure_4: "Safe play and common spaces",
  infrastructure_5: "A working maintenance culture",
  parents_1: "Regular parent communication",
  parents_2: "Responsive handling of concerns",
  parents_3: "Active parent involvement",
  parents_4: "Acting on parent feedback",
  parents_5: "Strong community reputation",
  technology_1: "Digital school records",
  technology_2: "Digitally confident teachers",
  technology_3: "Student access to technology",
  technology_4: "Reliable digital communication",
  technology_5: "Secure, backed-up data",
  governance_1: "Full regulatory compliance",
  governance_2: "Active oversight and board challenge",
  governance_3: "Written, living policies",
  governance_4: "Leadership continuity planning",
  governance_5: "Documented decisions and follow-up",
  culture_1: "Values practised daily",
  culture_2: "High staff morale",
  culture_3: "Warm, respectful relationships",
  culture_4: "Celebrating achievement",
  culture_5: "Deliberate cultural onboarding",
  safety_1: "Safeguarding policy and training",
  safety_2: "Controlled access and visitor management",
  safety_3: "Practised emergency readiness",
  safety_4: "Learning from incidents",
  safety_5: "Freedom from bullying and abuse",
  innovation_1: "Evidence-led improvement",
  innovation_2: "A working enrolment strategy",
  innovation_3: "Sharing of best practice",
  innovation_4: "Benchmarking against strong schools",
  innovation_5: "A realistic, costed growth plan",
};

interface ChapterWisdom {
  weak: string;
  mid: string;
  strong: string;
  impactIfWeak: string;
  priorityWhy: string;
  recommendations: Omit<Recommendation, "chapter">[];
  quickWin: Omit<ReportItem, "chapter">;
}

const WISDOM: Record<ChapterKey, ChapterWisdom> = {
  leadership: {
    weak: "Leadership energy at {school} is currently absorbed by day-to-day firefighting. Without a shared plan and regular classroom presence, staff work hard but not always in the same direction, and standards vary from class to class.",
    mid: "{school} has working leadership routines, but they are inconsistent. Decisions are usually sound, yet they rely too heavily on individuals rather than on shared data, clear roles and a documented improvement plan.",
    strong: "Leadership is a genuine asset at {school}. Direction is clear, leaders are visible in classrooms, and decisions are informed by evidence — a foundation most schools never reach.",
    impactIfWeak: "Every other improvement stalls: teachers receive inconsistent guidance and parents sense drift.",
    priorityWhy: "Leadership is the multiplier — when direction, feedback and accountability improve, every other chapter improves faster.",
    recommendations: [
      { title: "Adopt a one-page term improvement plan", detail: "Set three measurable priorities for the term, assign an owner to each and review progress with your leadership team every two weeks.", priority: "high", impact: "Aligns every staff member behind the same goals within one term.", effort: "Low — one working session, then a standing 30-minute review." },
      { title: "Institute a weekly classroom-visit rhythm", detail: "Leaders visit at least five lessons a week for 10–15 minutes using a simple look-for sheet, ending each visit with one piece of developmental feedback.", priority: "high", impact: "Teaching quality responds within weeks to consistent, kind observation.", effort: "Low — calendar discipline, not cost." },
      { title: "Build a single-page leadership dashboard", detail: "Track enrolment, attendance, fee collection and assessment results in one sheet reviewed at every leadership meeting.", priority: "medium", impact: "Decisions shift from opinion to evidence.", effort: "Low — one spreadsheet, updated weekly." },
      { title: "Clarify roles with written responsibility cards", detail: "Give every staff member a one-paragraph role card listing their top five responsibilities and who they report to.", priority: "medium", impact: "Removes duplicated work and dropped tasks.", effort: "Low — half a day of drafting and one staff meeting." },
    ],
    quickWin: { title: "Start a Monday leadership stand-up", detail: "A 15-minute weekly huddle covering the week's three priorities, risks and celebrations. Immediate clarity, zero cost." },
  },
  teaching: {
    weak: "Teaching practice at {school} depends too heavily on individual goodwill. Lesson planning is inconsistent, classrooms skew towards dictation, and there is little structured feedback — so learner outcomes vary widely by teacher.",
    mid: "{school} has pockets of strong teaching, but quality is not yet systematic. Planning and assessment happen, though not uniformly, and weaker lessons persist because support is informal.",
    strong: "Teaching quality at {school} is a strength worth advertising. Lessons are planned, engaging and informed by assessment — keep investing to keep it that way.",
    impactIfWeak: "Learning outcomes and parent confidence erode quietly, then show up suddenly in results and withdrawals.",
    priorityWhy: "Teaching is the product parents are buying. Improvement here is the fastest route to better results and word-of-mouth growth.",
    recommendations: [
      { title: "Introduce a shared lesson-plan standard", detail: "One simple template — objective, activity, check for understanding — submitted weekly and sampled by a leader.", priority: "high", impact: "Raises the floor of every classroom within a month.", effort: "Low — a template plus a weekly routine." },
      { title: "Launch termly peer observation", detail: "Every teacher observes a colleague once per term using three look-fors, then swaps one idea each.", priority: "medium", impact: "Good practice spreads without outside consultants.", effort: "Low — timetable coordination only." },
      { title: "Run monthly micro-CPD sessions", detail: "Forty-five minutes after school on a single high-impact technique — questioning, checking for understanding, feedback — led by your strongest teachers.", priority: "high", impact: "Compounding skill growth at near-zero cost.", effort: "Medium — one hour a month of preparation." },
      { title: "Add a check-for-understanding routine", detail: "Every lesson ends with three quick questions or an exit ticket; teachers adjust the next lesson based on the results.", priority: "medium", impact: "Stops pupils silently falling behind.", effort: "Low — a classroom habit, not a system." },
    ],
    quickWin: { title: "Publish a one-page 'great lesson' checklist", detail: "Five observable behaviours every teacher can aim for tomorrow. Celebrate the first teachers spotted using all five." },
  },
  student_dev: {
    weak: "Students at {school} are not yet tracked or supported as individuals. Struggling learners are discovered late, development beyond academics is thin, and discipline relies more on reaction than on a taught, positive system.",
    mid: "{school} looks after students' wellbeing in important ways, but support is uneven. Progress tracking, enrichment and student voice exist, without the consistency that makes them dependable.",
    strong: "Student development at {school} is genuinely holistic — progress is watched, character is built and students feel known. This is a reputation-making strength.",
    impactIfWeak: "Pupils plateau or withdraw, discipline consumes teaching time, and parents look for schools that 'know' their child.",
    priorityWhy: "Students are the evidence of everything else. Early intervention and a positive culture lift results, behaviour and retention together.",
    recommendations: [
      { title: "Create a simple learner-progress tracker", detail: "Per class, flag every pupil red/amber/green each half-term and agree one action for every red flag.", priority: "high", impact: "Stops silent failure within one term.", effort: "Low — one shared sheet per class." },
      { title: "Build a positive behaviour ladder", detail: "Teach three to five school-wide routines, recognise them publicly, and apply a consistent, calm consequence ladder.", priority: "high", impact: "Less disruption, calmer corridors, better lessons.", effort: "Medium — one staff session and daily consistency." },
      { title: "Protect weekly enrichment time", detail: "Timetable sports, clubs or arts for every student every week — staffed by current teachers' interests.", priority: "medium", impact: "Visible joy that markets the school for you.", effort: "Medium — timetable design." },
      { title: "Stand up a student leadership council", detail: "Class prefects plus a council that meets monthly with a leader and owns two improvement ideas per term.", priority: "low", impact: "Student voice becomes a leadership asset.", effort: "Low — one meeting a month." },
    ],
    quickWin: { title: "Launch a 'caught doing it right' board", detail: "Daily public recognition of students demonstrating school values. Culture shifts faster than any sanction." },
  },
  finance: {
    weak: "The financial foundations of {school} are fragile: spending is not fully tracked against a budget, collections are uncertain and reserves are thin. One weak term could force painful emergency decisions.",
    mid: "{school}'s finances function, but margin for error is small. Budgeting and collections need tightening so that surpluses become planned rather than accidental.",
    strong: "Financial management at {school} is disciplined — a budget is honoured, collections are strong and reserves exist. This stability funds improvement everywhere else.",
    impactIfWeak: "Salary delays, deferred maintenance and sudden fee decisions damage trust with staff and parents alike.",
    priorityWhy: "Money is oxygen. Tight collections and a real budget fund every other improvement and remove existential risk.",
    recommendations: [
      { title: "Adopt a one-page annual budget", detail: "List income and the top ten cost lines, then review actuals against it for 20 minutes every month with a second pair of eyes.", priority: "high", impact: "Ends financial surprises within one term.", effort: "Low — a spreadsheet and a standing meeting." },
      { title: "Install a fee-collection rhythm", detail: "Published deadlines, a reminder sequence (SMS/WhatsApp), a payment-plan option and a weekly collections review.", priority: "high", impact: "Typically lifts collection rates by 10–20% in a term.", effort: "Medium — consistent follow-through." },
      { title: "Start a reserve transfer", detail: "Move a fixed percentage of every fee inflow into a separate account until you hold two to three months of expenses.", priority: "medium", impact: "Converts panic into options when shocks come.", effort: "Low — one standing instruction." },
      { title: "Separate duties on money", detail: "The person who records is not the person who approves; review the books monthly with someone external to the process.", priority: "medium", impact: "Protects the school and the people handling money.", effort: "Low — role clarity and one reviewer." },
    ],
    quickWin: { title: "Send automated fee reminders this week", detail: "A polite, scheduled WhatsApp/SMS sequence before and after due dates typically recovers outstanding fees within days." },
  },
  infrastructure: {
    weak: "Facilities at {school} are falling behind enrolment. Classrooms, sanitation or learning resources are below the standard parents expect, and maintenance is reactive — visitors can see the strain.",
    mid: "{school}'s facilities serve their purpose, but gaps — in resources, comfort or upkeep — occasionally undermine the quality of teaching and the impression on visiting families.",
    strong: "The learning environment at {school} is a visible asset: adequate, hygienic and well maintained. Parents notice this before they notice anything else.",
    impactIfWeak: "Health risks, lost admissions and a daily signal to staff and students that excellence is negotiable.",
    priorityWhy: "Facilities are the cover of your book. Prospect families judge competence by toilets, classrooms and maintenance before any conversation.",
    recommendations: [
      { title: "Run a termly facilities audit", detail: "Walk the site with a 20-point checklist — hazards, toilets, water, furniture, lighting — score it, fix the reds first.", priority: "high", impact: "Removes safety risk and the most visible defects.", effort: "Low — one morning per term." },
      { title: "Create a maintenance log and SLA", detail: "One ledger where faults are reported, assigned and closed within a set number of days.", priority: "high", impact: "Broken things stop becoming permanent.", effort: "Low — a notebook or spreadsheet plus ownership." },
      { title: "Prioritise sanitation investment", detail: "Set a standard for pupil-to-toilet ratio, daily cleaning rotas and guaranteed water — then fund to it.", priority: "high", impact: "The single most-cited facility in parent decisions.", effort: "Medium — modest budget, high return." },
      { title: "Sweat your learning resources", detail: "Timetable library, lab and ICT usage so every class uses every resource weekly.", priority: "low", impact: "Existing assets start earning their keep.", effort: "Low — scheduling only." },
    ],
    quickWin: { title: "Fix the first-impression path", detail: "Repair and refresh everything a visiting parent sees from gate to office — signage, paint, plants. One weekend, outsized effect." },
  },
  parents: {
    weak: "Communication between {school} and parents is thin and mostly transactional. Concerns travel slowly, satisfaction is unmeasured and the school's reputation is left to chance.",
    mid: "{school} communicates with parents and involves them in events, but the partnership is not yet systematic — feedback loops and response standards need to become routine.",
    strong: "Parents are genuine partners at {school} — informed, heard and involved. This is the engine of referrals and retention.",
    impactIfWeak: "Small grievances compound into withdrawals, and happy families have no channel to advocate for you.",
    priorityWhy: "Parents fund the school and market the school. A weekly communication habit is the cheapest growth strategy that exists.",
    recommendations: [
      { title: "Send a weekly head's update", detail: "One short message — what happened, what is coming, one celebration — to every parent via WhatsApp or email.", priority: "high", impact: "Trust rises measurably within a term.", effort: "Low — 30 minutes a week." },
      { title: "Set a 48-hour response standard", detail: "Every parent concern acknowledged within 24 hours and resolved or scheduled within 48 — tracked in a simple log.", priority: "high", impact: "Converts complainants into loyalists.", effort: "Low — a log and a habit." },
      { title: "Run a termly parent pulse survey", detail: "Five questions, one minute, every term: satisfaction, communication, teaching, safety, one open box. Publish what changed.", priority: "medium", impact: "You know your reputation before it walks away.", effort: "Low — a form and a termly summary." },
      { title: "Create three parent-involvement rituals", detail: "An open-classroom morning, a celebration assembly families attend, and a parent volunteer register.", priority: "medium", impact: "Parents who feel inside the school stay and refer.", effort: "Medium — one event per term." },
    ],
    quickWin: { title: "Phone five parents today", detail: "Call five families unprompted to share something positive about their child. Word of that call will travel further than any advert." },
  },
  technology: {
    weak: "{school}'s records and communication run largely on paper and memory. Data is hard to retrieve, digital teaching is minimal and there is little protection if devices or files are lost.",
    mid: "{school} uses technology in places — records or communication — but usage is uneven across staff and students, and security practices lag behind the ambition.",
    strong: "Technology at {school} quietly multiplies quality — records are digital, teachers use tools willingly and data is protected. Keep the hardware refreshed and the training current.",
    impactIfWeak: "Hours lost to paperwork, avoidable errors in records and fees, and a growing credibility gap with digital-native parents.",
    priorityWhy: "Digital records are the nervous system of a modern school — they make every other improvement faster and auditable.",
    recommendations: [
      { title: "Digitise the core registers", detail: "Move enrolment, attendance, fees and results into one affordable school-management tool or structured spreadsheets.", priority: "high", impact: "Any number, any student, in under a minute.", effort: "Medium — one setup fortnight, then routine." },
      { title: "Back up everything automatically", detail: "Weekly cloud backup of records with two staff able to restore; no critical file lives on one device.", priority: "high", impact: "Removes a catastrophic single point of failure.", effort: "Low — one afternoon to configure." },
      { title: "Train teachers in three digital habits", detail: "Project or share content once a week, record marks digitally, and message parents through official channels.", priority: "medium", impact: "Technology starts appearing in learning, not just admin.", effort: "Medium — short monthly practice sessions." },
      { title: "Timetable student digital literacy", detail: "Guaranteed, assessed technology time for every student, even if devices must be shared in rotation.", priority: "low", impact: "A selling point parents actively seek.", effort: "Medium — timetabling and shared devices." },
    ],
    quickWin: { title: "Create one official parent channel", detail: "A verified WhatsApp community or broadcast list per class. Announcements stop leaking through scattered groups this week." },
  },
  governance: {
    weak: "Governance at {school} rests almost entirely on the owner. Compliance, policies and succession are informal, creating risk that one absence or one inspection could expose painfully.",
    mid: "{school} meets its core obligations and has some written policies, but oversight is light and decisions are not consistently documented or followed through.",
    strong: "Governance at {school} is a quiet strength: compliant, policy-guided and overseen with real challenge. Institutions with this discipline outlive their founders.",
    impactIfWeak: "Regulatory exposure, dependency on one person, and decisions that cannot be verified or defended.",
    priorityWhy: "Governance de-risks everything: compliance protects licence to operate, and written decisions stop the same problems being re-fought termly.",
    recommendations: [
      { title: "Complete a compliance health-check", detail: "List every registration, approval and renewal with its expiry date in one register reviewed monthly.", priority: "high", impact: "No surprise penalties or closures.", effort: "Low — a register and a monthly glance." },
      { title: "Form a small advisory board", detail: "Three to five respected people — an educator, an accountant, a parent — meeting termly to review results, finances and complaints with honest challenge.", priority: "high", impact: "The owner's blind spots get seen.", effort: "Medium — recruitment, then one meeting per term." },
      { title: "Write the six core policies", detail: "Admissions, staffing, safeguarding, finance, behaviour and complaints — two pages each, signed and shared.", priority: "medium", impact: "Consistency that survives staff turnover.", effort: "Medium — a focused fortnight of drafting." },
      { title: "Minute every leadership meeting", detail: "Decisions, owners and deadlines recorded and opened each following meeting.", priority: "low", impact: "Execution becomes trackable.", effort: "Low — ten minutes per meeting." },
    ],
    quickWin: { title: "Create a 'delegated authority' note", detail: "One page naming who decides what when the head or proprietor is unavailable. Continuity insurance in an afternoon." },
  },
  culture: {
    weak: "The culture of {school} is currently accidental. Values are unspoken, morale is fragile and recognition is rare — good people disengage first, and students feel the temperature.",
    mid: "{school} has a warm core and strong relationships in places, but values are implicit and recognition is sporadic, so the culture depends too much on individuals.",
    strong: "Culture is one of {school}'s crown jewels — values are lived, morale is high and achievement is celebrated. Guard it deliberately as you grow.",
    impactIfWeak: "Quiet resignations of your best staff, inconsistent classroom climates and a reputation that forms without your input.",
    priorityWhy: "Culture decides whether strategies survive contact with Tuesday afternoon. It must be named and managed, not hoped for.",
    recommendations: [
      { title: "Define and teach five school values", detail: "Co-create five values with staff, attach a behaviour to each and open every assembly and staff meeting with one.", priority: "high", impact: "A shared language for every decision.", effort: "Low — two working sessions." },
      { title: "Start monthly staff recognition", detail: "Nominate and celebrate one staff member monthly against the values — certificate plus a story told publicly.", priority: "medium", impact: "Morale and retention rise visibly.", effort: "Low — a standing agenda item." },
      { title: "Survey staff every term", detail: "Ten anonymous questions on workload, respect and support — then act on one finding per term, visibly.", priority: "medium", impact: "You hear problems while they are still small.", effort: "Low — a form and a termly hour." },
      { title: "Design a new-staff induction", detail: "A half-day welcome covering values, routines and expectations, plus a buddy for the first term.", priority: "low", impact: "Culture stops diluting as you hire.", effort: "Low — a checklist and a buddy rota." },
    ],
    quickWin: { title: "Open assembly with one celebration daily", detail: "Sixty seconds recognising a student or teacher living the values. The cheapest morale intervention in education." },
  },
  safety: {
    weak: "Safety and safeguarding at {school} are below an acceptable threshold. There is no trained, written safeguarding system, and emergency readiness is assumed rather than practised. This must be addressed first.",
    mid: "{school} manages physical safety reasonably, but safeguarding training, incident recording and drilled emergency procedures need to become systematic and provable.",
    strong: "Safety and safeguarding at {school} are professional grade — written, trained, practised and recorded. Tell parents: this diligence is rare and precious.",
    impactIfWeak: "One incident can cause irreversible harm to a child and to the school's existence. This is the one chapter where 'average' is not acceptable.",
    priorityWhy: "Nothing else matters if a child is harmed. Safeguarding is also the first thing sophisticated parents and inspectors check.",
    recommendations: [
      { title: "Adopt a written child-protection policy", detail: "Define concerns, reporting lines and response steps; every adult signs it and a designated safeguarding lead is named.", priority: "high", impact: "Every concern gets a correct, recorded response.", effort: "Low — adopt a template, one training session." },
      { title: "Control the gates", detail: "Single entry point, visitor badges, sign-in, and authorised-pickup lists checked daily.", priority: "high", impact: "Closes the most common safety breach instantly.", effort: "Low — process, not construction." },
      { title: "Drill emergencies termly", detail: "Fire and evacuation this term; first-aid point stocked and two staff trained; drill logged and timed.", priority: "high", impact: "Real emergencies become managed ones.", effort: "Medium — one drill per term." },
      { title: "Keep an incident log", detail: "Every accident and near-miss recorded and reviewed monthly for patterns.", priority: "medium", impact: "Hazards get fixed before the third child trips.", effort: "Low — a ledger and a monthly look." },
    ],
    quickWin: { title: "Name and publish your safeguarding lead", detail: "One trained adult with a known face and a known reporting line — communicated to staff, students and parents this week." },
  },
  innovation: {
    weak: "{school} is currently run for survival rather than growth. There is no working enrolment strategy, improvements are unplanned and the school has little sense of how it compares to stronger competitors.",
    mid: "{school} improves and recruits with some success, but growth depends on seasonal luck more than strategy, and good ideas stay inside individual classrooms.",
    strong: "{school} thinks like a growing institution — it benchmarks, experiments and plans years ahead. Growth-minded schools in this position usually dominate their market within three years.",
    impactIfWeak: "Enrolment drifts to better-organised competitors and the school ages while the market modernises around it.",
    priorityWhy: "Growth funds everything. A working enrolment engine plus a benchmarking habit turns improvement from a cost into a compounding asset.",
    recommendations: [
      { title: "Build a year-round enrolment funnel", detail: "Track enquiries, visits, offers and starts monthly; assign one owner; run two open-classroom days and a referral reward for current parents.", priority: "high", impact: "Admissions becomes a system, not a season.", effort: "Medium — one owner and a monthly review." },
      { title: "Benchmark against three strong schools", detail: "Compare fees, results, facilities and parent sentiment; adopt two ideas and differentiate on one.", priority: "medium", impact: "Strategy based on reality, not worry.", effort: "Low — conversations and visits." },
      { title: "Write a costed three-year plan", detail: "Enrolment targets, fee strategy, staffing and facility milestones with rough costs per year.", priority: "medium", impact: "Turns ambition into fundable steps.", effort: "Medium — a working weekend." },
      { title: "Run a termly 'practice share'", detail: "Each teacher brings one thing that worked; the best three are adopted school-wide and credited.", priority: "low", impact: "Innovation spreads without consultants.", effort: "Low — one staff meeting per term." },
    ],
    quickWin: { title: "Launch a parent referral thank-you", detail: "A simple, public thank-you — fee credit or celebration — for every family that brings another. Enrolment help from your happiest customers." },
  },
};

const SUMMARY_BY_CHAPTER: Record<ChapterKey, string> = {
  leadership: "Direction, feedback and accountability from the leadership team.",
  teaching: "Lesson planning, delivery and teacher growth.",
  student_dev: "Progress tracking, behaviour, wellbeing and student voice.",
  finance: "Budgeting, collections, reserves and records.",
  infrastructure: "Classrooms, resources, sanitation and maintenance.",
  parents: "Communication, trust and partnership with families.",
  technology: "Digital systems, teaching tools and data protection.",
  governance: "Compliance, oversight, policies and continuity.",
  culture: "Values, morale, relationships and recognition.",
  safety: "Safeguarding, emergencies and a secure environment.",
  innovation: "Improvement mindset, enrolment and forward planning.",
};

/* ------------------------------------------------------------------ */

function bandOf(score: number): "weak" | "mid" | "strong" {
  if (score < 55) return "weak";
  if (score < 75) return "mid";
  return "strong";
}

function fill(template: string, school: SchoolInfo): string {
  return template.replaceAll("{school}", school.schoolName);
}

export function generateEngineReport(
  school: SchoolInfo,
  answers: AnswerRecord[],
): ReportData {
  const summary = computeScores(answers);
  const overallRating = ratingFor(summary.overall);
  const sorted = [...summary.chapterScores].sort((a, b) => a.score - b.score);
  const weakest = sorted.slice(0, 4);
  const strongest = [...summary.chapterScores].sort((a, b) => b.score - a.score).slice(0, 4);

  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));

  /* Strengths: best-rated individual indicators. */
  const strongItems = answers
    .filter((a) => a.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const strengths: ReportItem[] = (
    strongItems.length ? strongItems : answers.slice(0, 3)
  )
    .slice(0, 5)
    .map((a) => ({
      title: ITEM_TOPICS[a.questionId] ?? QUESTION_INDEX[a.questionId]?.text ?? "Strength",
      detail: `Rated ${a.score} out of 5 by the school itself. ${
        a.score >= 4
          ? `This is working well inside the ${CHAPTER_MAP[a.chapter].title.toLowerCase()} area — protect it and make sure it survives staff changes.`
          : `A relative strength in an otherwise demanding picture — a foundation to build on.`
      }`,
      chapter: a.chapter,
    }));

  /* Weaknesses: lowest-rated indicators with consequences. */
  const weakItems = answers
    .filter((a) => a.score <= 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
  const weaknesses: WeaknessItem[] = (
    weakItems.length
      ? weakItems
      : [...answers].sort((a, b) => a.score - b.score).slice(0, 3)
  ).map((a) => ({
    title: ITEM_TOPICS[a.questionId] ?? QUESTION_INDEX[a.questionId]?.text ?? "Gap",
    detail: `Rated ${a.score}/5 by the school itself. The indicator “${QUESTION_INDEX[a.questionId]?.text ?? ""}” is not yet reliably true.`,
    impact: WISDOM[a.chapter].impactIfWeak,
    chapter: a.chapter,
  }));

  /* Per-chapter narrative. */
  const chapterAnalyses: ChapterAnalysis[] = summary.chapterScores.map((cs) => {
    const w = WISDOM[cs.chapter];
    const band = bandOf(cs.score);
    return {
      chapter: cs.chapter,
      title: CHAPTER_MAP[cs.chapter].title,
      score: cs.score,
      rating: ratingFor(cs.score).label,
      analysis: fill(w[band], school),
    };
  });

  const departmentScores = summary.chapterScores.map((cs) => ({
    chapter: cs.chapter,
    title: CHAPTER_MAP[cs.chapter].title,
    score: cs.score,
    summary: SUMMARY_BY_CHAPTER[cs.chapter],
  }));

  const priorityAreas = weakest.slice(0, 3).map((cs) => {
    const w = WISDOM[cs.chapter];
    return {
      chapter: cs.chapter,
      title: CHAPTER_MAP[cs.chapter].title,
      why: `Scored ${cs.score}% — your lowest area. ${w.priorityWhy}`,
      firstStep: `${w.recommendations[0].title}: ${w.recommendations[0].detail}`,
    };
  });

  /* Recommendations — drawn from the weakest chapters first (broad coverage
     across the five lowest areas so every plan is balanced). */
  const recommendations: Recommendation[] = [];
  const perChapterCap = 3;
  for (const cs of sorted.slice(0, 5)) {
    const w = WISDOM[cs.chapter];
    let taken = 0;
    for (const rec of w.recommendations) {
      if (recommendations.length >= 10 || taken >= perChapterCap) break;
      recommendations.push({ ...rec, chapter: cs.chapter });
      taken += 1;
    }
  }
  recommendations.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[a.priority] - rank[b.priority];
  });

  const quickWins: ReportItem[] = weakest
    .slice(0, 4)
    .map((cs) => ({ ...WISDOM[cs.chapter].quickWin, chapter: cs.chapter }));

  /* 30 / 60 / 90 day plan. */
  const plan30: PlanTask[] = [
    ...quickWins.slice(0, 4).map((qw) => ({
      task: `${qw.title} (${CHAPTER_MAP[qw.chapter as ChapterKey].shortTitle})`,
      outcome: "Visible movement staff and parents notice within the month.",
    })),
    ...priorityAreas.slice(0, 1).map((p) => ({
      task: p.firstStep.split(":")[0],
      outcome: "The turnaround in your weakest area is formally underway.",
    })),
  ];
  const highRecs = recommendations.filter((r) => r.priority === "high");
  const plan60: PlanTask[] = highRecs.slice(0, 5).map((r) => ({
    task: `${r.title} (${CHAPTER_MAP[r.chapter as ChapterKey].shortTitle})`,
    outcome: r.impact,
  }));
  const plan90: PlanTask[] = [
    ...recommendations.filter((r) => r.priority === "medium").slice(0, 3).map((r) => ({
      task: `${r.title} (${CHAPTER_MAP[r.chapter as ChapterKey].shortTitle})`,
      outcome: r.impact,
    })),
    {
      task: "Review progress against this report with your leadership team",
      outcome: "Every completed action is verified; the next 90-day cycle is agreed.",
    },
    {
      task: "Retake this School Health Check",
      outcome: "Score improvement is measured, celebrated and reset for the next quarter.",
    },
  ];

  const executiveSummary =
    `${school.schoolName} — a ${school.schoolType.toLowerCase()} in ${[school.state, school.country].filter(Boolean).join(", ")} — scores ${summary.overall}/100 on the KAEC School Health Index, a rating of “${overallRating.label}”. ` +
    `${overallRating.message} ` +
    `The school's clearest asset is ${strongest[0].title.toLowerCase()} (${strongest[0].score}%), while ${weakest[0].title.toLowerCase()} (${weakest[0].score}%) is the area where focused effort will pay back fastest. ` +
    `This report isolates ${weaknesses.length} priority weaknesses, names ${strengths.length} strengths to protect, and lays out a sequenced 90-day plan that requires leadership attention more than new money. None of the findings are unusual for a school at this stage; all of them are fixable.`;

  const longTermVision =
    `Twelve months from now, ${school.schoolName} can be the reference ${school.schoolType.toLowerCase()} in its community: ${weakest[0].title.toLowerCase()} no longer a concern but a strength in progress (target ${Math.min(100, weakest[0].score + 25)}%+), teaching quality consistently above 80%, and a parent community that recruits on your behalf. ` +
    `The path is not dramatic reform — it is ${weakest.slice(0, 3).map((c) => c.title.toLowerCase()).join(", ")} improved term by term, measured honestly, and celebrated loudly. Schools that run four consecutive 90-day cycles from this report typically move a full rating band within a year.`;

  const closingMessage =
    overallRating.band === "critical" || overallRating.band === "at_risk"
      ? `A ${summary.overall}/100 is not a verdict — it is a map. Every strong school you admire once sat exactly where ${school.schoolName} sits today, and the difference was never money: it was the decision to fix one thing completely, then the next. Begin with the 30-day plan on Monday. In ninety days, retake this assessment and watch the number move. KAEC exists to walk this road with schools exactly like yours.`
      : `What ${school.schoolName} has already built is real, and this report proves it in numbers. Now comes the more rewarding work: converting a ${overallRating.label.toLowerCase()} school into an undeniable one. Pick the first three actions, give each an owner and a date, and let momentum do the rest. KAEC is ready to help you turn this diagnosis into the school's next great chapter.`;

  return {
    schemaVersion: 1,
    schoolName: school.schoolName,
    overallScore: summary.overall,
    healthRating: overallRating.label,
    priorityArea: weakest[0].title,
    executiveSummary,
    strengths,
    weaknesses,
    priorityAreas,
    departmentScores,
    chapterAnalyses,
    recommendations: recommendations.slice(0, 10),
    quickWins,
    plan30: plan30.slice(0, 5),
    plan60: plan60.slice(0, 5),
    plan90: plan90.slice(0, 5),
    longTermVision,
    closingMessage,
    generatedAt: new Date().toISOString(),
    engine: "engine",
  };
}

export function chapterScoresRecord(answers: AnswerRecord[]): Record<string, number> {
  const summary = computeScores(answers);
  return Object.fromEntries(summary.chapterScores.map((c) => [c.chapter, c.score]));
}
