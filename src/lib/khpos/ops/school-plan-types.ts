export const planKinds = {
  closure: "School closed (break or holiday)",
  no_lessons: "No regular lessons (staff working)",
  exam_period: "Exam period",
  event: "School event or deadline",
  weekly_theme: "Weekly theme",
  daily_topic: "Daily topic",
  weekly_duty: "Weekly staff duty",
  invigilation: "Exam or test invigilation",
} as const;
export type PlanKind = keyof typeof planKinds;
export type PlanEntry = {
  id: string; kind: PlanKind; title: string; start_day: string; end_day: string;
  archived_at?: string | null;
  document_id?: string | null; can_edit: boolean; published: boolean; campus_id: string | null; campus_name: string | null;
  staff_id: string | null; staff_name: string | null; assessment_id: string | null;
  assessment_start: string | null; assessment_title: string | null;
};
export type SchoolPlan = {
  canManage: boolean; canManageWholeSchool: boolean; entries: PlanEntry[];
  campuses: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  assessments: { id: string; name: string; start: string }[];
  terms: { id: string; name: string; session: string; start: string; end: string }[];
  rules: { id: string; name: string; mode: string }[];
};
