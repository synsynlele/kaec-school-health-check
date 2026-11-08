/**
 * School report pre-fill engine: uses only already-authorised, signed-in
 * session records from the existing presence workspace. Never treats a
 * missing observation as an absent lesson, and never silently saves answers.
 */
import type { SchoolReport, ReportField } from "@/lib/khpos/reports";
import type { WeeklyClassRecord } from "@/lib/khpos/ops/presence";

export interface EvidencePrefill {
  narrative: string;
  recordCount: number;
  startDate: string;
  endDate: string;
  sourceHref: string;
  suggested: Array<{ key: string; value: string; label: string }>;
  caveat: string;
}
function formatDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}
function potentialNarrativeField(field: ReportField) {
  return ["text", "textarea"].includes(field.type) &&
    /(?:notes?|summary|lesson delivery|reported work|activities|achievements|observations|teaching log|evidence)/i.test(field.key+" "+field.label);
}
export function buildEvidencePrefill(report: Pick<SchoolReport,"period_start"|"period_end"|"fields"|"payload">,
  weekly: { from: string; to: string; records: WeeklyClassRecord[] },
  schoolId: string): EvidencePrefill {
  const startDate=formatDay(report.period_start),endDate=formatDay(report.period_end);
  const records = weekly.records.filter(r=>r.date>=startDate&&r.date<=endDate);
  const completed=records.filter(r=>r.out !== null && !r.administrativelyClosed);
  const pending=records.filter(r=>r.out===null && !r.administrativelyClosed);
  const narratives: string[]=[];
  if (records.length) {
    narratives.push("Recorded class-session check-ins during "+startDate+" to "+endDate+": "+records.length+".");
    narratives.push("Sessions with a recorded teacher check-out: "+completed.length+".");
    if(pending.length)narratives.push("Sessions without a recorded check-out: "+pending.length+".");
    narratives.push("These are logged sessions, not a count of every timetabled lesson or proof that learning targets were met.");
  }
  const narrative=narratives.join("\n");
  const suggested=report.fields
    .filter(potentialNarrativeField)
    .filter(f=>!String(report.payload[f.key]??"").trim())
    .slice(0,1)
    .map(f=>({key:f.key,label:f.label,value:narrative}));
  return {
    narrative,recordCount:records.length,startDate,endDate,
    sourceHref:`/khpos/${schoolId}/teaching-presence?tab=lessons`,
    suggested:records.length?suggested:[],
    caveat: records.length
      ? "Use only after checking the attendance and teaching records. A class check-in does not establish lesson quality, an unlogged class does not prove a missed lesson, and these entries are not independent verification."
      : "No matching logged class sessions are available from the current authorised weekly view for this report period. Nothing has been inferred or filled.",
  };
}
