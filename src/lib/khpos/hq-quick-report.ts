export const hqProgressOptions = ["Completed as planned", "Partly completed", "Not completed", "No work planned this period"] as const;
export const hqWorkOptions = ["School follow-up", "Staff or learner support", "Planning or review", "Administration or finance", "Product or project work", "Other", "No work this period"] as const;
export type HqQuickAnswers = { progress: string; areas: string[]; help: string; followUp: string; notes?: string };

/** Server and client share the same values. No answer implies independent verification. */
export function hqQuickContents(raw: unknown, notes: string, challenges: string, next: string) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Choose the report answers first.");
  const q = raw as HqQuickAnswers;
  if (!hqProgressOptions.some(v => v === q.progress) || !Array.isArray(q.areas) || !q.areas.length ||
    q.areas.length > hqWorkOptions.length || new Set(q.areas).size !== q.areas.length ||
    q.areas.some(v => !hqWorkOptions.some(option => option === v)) ||
    !["Yes", "No"].includes(q.help) || !["Yes", "No"].includes(q.followUp)) throw new Error("Choose a valid answer for each report question.");
  if (q.areas.includes("No work this period") && q.areas.length > 1) throw new Error("Choose either no work or the areas you worked on.");
  if (q.progress === "Completed as planned" && q.areas.includes("No work this period")) throw new Error("Check the work status and areas: these answers do not agree.");
  if (["Partly completed", "Not completed"].includes(q.progress) && notes.trim().length < 10) throw new Error("Explain the unfinished work in your final notes.");
  if (q.areas.includes("Other") && notes.trim().length < 10) throw new Error("Briefly describe the other work in your final notes.");
  if (q.help === "Yes" && challenges.trim().length < 10) throw new Error("Explain the help or decision you need.");
  if (q.followUp === "Yes" && next.trim().length < 10) throw new Error("Add the next action, responsible person and date.");
  return {
    quick_answers: {progress:q.progress,areas:q.areas,help:q.help,followUp:q.followUp,notes:notes.trim()},
    achievements: `Reported work status: ${q.progress}.\nWork areas: ${q.areas.join(", ")}.${notes.trim() ? `\nStaff notes: ${notes.trim()}` : ""}`,
    challenges: q.help === "Yes" ? challenges.trim() : "Reporter selected: no help or decision needed.",
    next_actions: q.followUp === "Yes" ? next.trim() : "Reporter selected: no additional follow-up action this period.",
  };
}
