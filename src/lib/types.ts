import type { ChapterKey } from "./questions";

export interface SchoolInfo {
  id: string;
  schoolName: string;
  contactName: string;
  email: string;
  phone: string;
  state: string;
  country: string;
  schoolType: string;
  schoolLevel: string;
  studentPopulation: string;
  staffPopulation: string;
  assessmentDate: string;
  createdAt: string;
}

export interface AnswerRecord {
  questionId: string;
  chapter: ChapterKey;
  score: number;
  answer: string;
}

export interface ReportItem {
  title: string;
  detail: string;
  chapter?: ChapterKey;
}

export interface WeaknessItem extends ReportItem {
  impact: string;
}

export interface Recommendation extends ReportItem {
  priority: "high" | "medium" | "low";
  impact: string;
  effort: string;
}

export interface PlanTask {
  task: string;
  outcome: string;
}

export interface PriorityArea {
  chapter: ChapterKey;
  title: string;
  why: string;
  firstStep: string;
}

export interface ChapterAnalysis {
  chapter: ChapterKey;
  title: string;
  score: number;
  rating: string;
  analysis: string;
}

export interface DepartmentScore {
  chapter: ChapterKey;
  title: string;
  score: number;
  summary: string;
}

export type ReportGenerationStatus =
  | "openai_success"
  | "ai_not_configured"
  | "ai_incomplete_assessment"
  | "ai_schema_failed"
  | "ai_api_failed";

export interface ReportGenerationMeta {
  aiStatus: ReportGenerationStatus;
  model: string;
  attempts: number;
  detail?: string;
}

export interface ReportData {
  schemaVersion: number;
  schoolName: string;
  overallScore: number;
  healthRating: string;
  priorityArea: string;
  executiveSummary: string;
  strengths: ReportItem[];
  weaknesses: WeaknessItem[];
  priorityAreas: PriorityArea[];
  departmentScores: DepartmentScore[];
  chapterAnalyses: ChapterAnalysis[];
  recommendations: Recommendation[];
  quickWins: ReportItem[];
  plan30: PlanTask[];
  plan60: PlanTask[];
  plan90: PlanTask[];
  longTermVision: string;
  closingMessage: string;
  generatedAt: string;
  engine: "openai" | "engine";
  generation?: ReportGenerationMeta;
}

export interface AssessmentState {
  assessmentId: string;
  school: SchoolInfo;
  answers: AnswerRecord[];
  completed: boolean;
  hasReport: boolean;
  createdAt: string;
}

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GlobalStats {
  totalReports: number;
  averageScore: number;
  mostCommonWeakness: string;
}
