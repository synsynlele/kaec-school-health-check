/**
 * Cost-free, version-controlled Ask KHP-OS product guidance.
 *
 * Answers only from the role-authorised Training Academy curriculum. No AI
 * provider call, no model tokens, no knowledge of private school records.
 * Never invent steps or assume permissions from a lesson title.
 */
import type { AcademyCourse, AcademyLesson } from "@/lib/khpos/academy-data";

const NOISE = new Set([
  "a", "an", "and", "are", "at", "be", "can", "could", "do", "does", "for",
  "from", "help", "how", "i", "in", "is", "it", "me", "my", "of", "on",
  "or", "our", "please", "show", "some", "the", "this", "to", "us",
  "use", "using", "want", "we", "what", "when", "where", "which",
  "who", "with", "would", "you", "your", "app", "khpos", "khp",
]);
function normalized(text: string): string {
  return text.toLowerCase().replace(/khp[\s-]?os/g, "khpos").replace(/[^a-z0-9]+/g, " ").trim();
}
function terms(text: string): string[] {
  return [...new Set(normalized(text).split(/\s+/).filter((word) => word.length > 2 && !NOISE.has(word)))];
}

// Requests to analyse an actual school should still use the existing,
// permission-checked school-record question paths.
export function isKhposAppHelpQuestion(question: string): boolean {
  const q = normalized(question);
  if (!q) return false;
  if (/\b(?:training academy|tutorial|user guide|help guide|how to use|how to navigate|where to click|which button|walk me through|step by step|teach me to use)\b/.test(q)) return true;
  if (!/^(?:how|where|show|guide|teach|help|can i|could i|what steps|which page|which menu|i want to know how)\b/.test(q)) return false;
  if (/\b(?:khpos|app|platform|dashboard|page|screen|menu|button|feature|training|navigate)\b/.test(q)) return true;
  if (/\b(?:check in|check out|clock in|clock out|sign in|sign out|log in|login|timetable|attendance|invigilation|exam timetable|leave request|cover|reports?|meeting|announcement|notification|assessment|school setup|onboarding|policy|policies|process|approve|approval|staff record|positions?|register staff|teacher assignment|school health check|reassessment|submit evidence|upload evidence|change password|download|export|create a form|my work|view my tasks|find my tasks)\b/.test(q)) return true;
  return false;
}

const PRIORITIES: readonly { pattern: RegExp; title: string }[] = [
  {pattern:/\b(?:create|generate|edit|assign|publish|configure|set up|build)\b.*\b(?:timetable|class assignment|teaching plan)\b/,title:"Teaching plans and class assignments"},
  {pattern:/\b(?:attendance|sign in|sign out|check in|check out)\b.*\b(?:history|record|search|sort|leadership overview)\b/,title:"Attendance leadership overview"},
  {pattern:/\b(?:class|lesson|subject)\b.*\b(?:check in|check out|attendance|timetable)\b|\b(?:check in|check out)\b.*\b(?:class|lesson|subject)\b/,title:"Class timetable and lesson attendance"},
  {pattern:/\b(?:school|teacher|staff)\b.*\b(?:check in|check out|clock in|clock out)\b|\b(?:check in|check out|clock in|clock out)\b.*\b(?:school|teacher|staff)\b/,title:"School check-in and check-out"},
  {pattern:/\b(?:sign in|log in|login)\b.*\b(?:account|khpos|app|school)\b/,title:"Sign in and find your school"},
  {pattern:/\b(?:create|configure|schedule|set up)\b.*\b(?:report|form)\b/,title:"Reporting system and review"},
  {pattern:/\b(?:leave|absence|cover|replacement)\b/,title:"Leave, coverage, staff support and discipline"},
  {pattern:/\b(?:exam|invigilation|test)\b/,title:"Assessments, tests and invigilation"},
  {pattern:/\b(?:meeting|video call|voice call)\b/,title:"Meetings, announcements and ideas"},
  {pattern:/\b(?:kshc|health check|reassessment|school improvement)\b/,title:"School improvement and KSHC"},
  {pattern:/\b(?:training academy|tutorial|user guide|help guide)\b/,title:"Ask KHP-OS and find approved guides"},
];

export interface AppHelpMatch {
  lesson: AcademyLesson;
  courseId: AcademyCourse["id"];
  href: string;
  score: number;
}

function hrefForLesson(organisationId: string, route: string): string {
  // School-scoped lessons only. Corporate lessons are filtered out upstream.
  if (route === "/khpos") return "/khpos";
  if (!route.startsWith("/") || route.startsWith("//") || route.includes("..") || route.startsWith("/khpos/")) {
    return `/khpos/${organisationId}/ask`;
  }
  return `/khpos/${organisationId}${route}`;
}

export function matchKhposAppHelp(
  question: string,
  courses: readonly AcademyCourse[],
  organisationId: string,
): AppHelpMatch[] {
  const words = terms(question);
  const q = normalized(question);
  const entries = courses.flatMap((course) => course.lessons.map((lesson) => {
    const titleWords = new Set(terms(lesson.title));
    const descriptionWords = new Set(terms(lesson.purpose));
    const stepsWords = new Set(terms(lesson.steps.join(" ")));
    let score = words.reduce((total, word) =>
      total + (titleWords.has(word) ? 6 : 0)
      + (descriptionWords.has(word) ? 2 : 0)
      + (stepsWords.has(word) ? 1 : 0), 0);
    const title = normalized(lesson.title);
    if (q.includes(title) && title.length > 4) score += 30;
    for (const preference of PRIORITIES) {
      if (preference.pattern.test(q) && preference.title === lesson.title) score += 30;
    }
    // Too little evidence -> do not pretend to know which menu the user meant.
    return {lesson,courseId:course.id,href:hrefForLesson(organisationId,lesson.route),score};
  }));
  return entries.filter((entry) => entry.score >= 4)
    .sort((a,b) => b.score - a.score || a.lesson.title.localeCompare(b.lesson.title))
    .slice(0,2);
}

export interface AppHelpAnswer {
  answer: string;
  matches: AppHelpMatch[];
}

export function answerKhposAppHelp(
  question: string,
  courses: readonly AcademyCourse[],
  organisationId: string,
): AppHelpAnswer {
  const matches = matchKhposAppHelp(question,courses,organisationId);
  if (!matches.length) {
    return {
      answer: "I can guide you through KHP-OS without using AI tokens. Tell me the feature you want to use, such as school attendance, class check-in, timetables, reports, leave, meetings or school improvement. You can also open the Training Academy tab here for the full role-based lessons.",
      matches:[],
    };
  }
  const [primary,secondary] = matches;
  const lines = [
    `To use ${primary.lesson.title}:`,
    "",
    ...primary.lesson.steps.map((step,index) => `${index+1}. ${step}`),
    "",
    `Open the linked page: ${primary.href}`,
  ];
  if (secondary && secondary.score >= primary.score * 0.85 &&
      secondary.lesson.title !== primary.lesson.title) {
    lines.push("",`Related guide: ${secondary.lesson.title}. The two workflows may be different; select the relevant page below.`);
  }
  lines.push("","What you can see or change depends on your approved school role. Training instructions never grant additional permissions.");
  return {answer:lines.join("\n"),matches};
}
