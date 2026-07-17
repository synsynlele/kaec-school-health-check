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
  score: number; // 1–5
  answer: string; // label chosen e.g. "Strong"
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

export interface ReportData {
  schemaVersion: number;
  schoolName: string;
  overallScore: number; // 0–100
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
