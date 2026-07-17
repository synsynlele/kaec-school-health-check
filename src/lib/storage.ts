/**
 * KAEC School Health Check — Storage Layer
 *
 * Zero-config: works immediately with DATABASE_URL (local/managed Postgres).
 * If NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set instead,
 * the same functions transparently use the Supabase REST API (tables from
 * supabase/schema.sql). No ORM. No sessions. Just durable records.
 */
import { Pool } from "pg";
import type {
  AnswerRecord,
  AssessmentState,
  GlobalStats,
  ReportData,
  SchoolInfo,
} from "./types";
import type { ChapterKey } from "./questions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

/* ------------------------------------------------------------------ */
/* PostgreSQL mode (auto-provisioning)                                 */
/* ------------------------------------------------------------------ */

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

const DDL = `
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  state text DEFAULT '',
  country text DEFAULT '',
  school_type text DEFAULT '',
  school_level text DEFAULT '',
  student_population text DEFAULT '',
  staff_population text DEFAULT '',
  assessment_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  overall_score integer,
  health_rating text,
  priority_area text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  chapter text NOT NULL,
  score integer NOT NULL,
  answer text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (assessment_id, question_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
  executive_summary text DEFAULT '',
  strengths jsonb DEFAULT '[]'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  ninety_day_plan jsonb DEFAULT '{}'::jsonb,
  full_report jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text DEFAULT '',
  name text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  request_type text DEFAULT 'talk',
  message text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text DEFAULT '',
  country text DEFAULT '',
  school_type text DEFAULT '',
  overall_score integer,
  chapter_scores jsonb DEFAULT '{}'::jsonb,
  completion_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  status text DEFAULT 'queued',
  detail text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_answers_assessment ON answers (assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessments_school ON assessments (school_id);
CREATE INDEX IF NOT EXISTS idx_analytics_state ON analytics (state);
`;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 8000,
    });
  }
  return pool;
}

async function ensurePg(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await getPool().query(DDL);
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function pg<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensurePg();
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

/* ------------------------------------------------------------------ */
/* Supabase REST mode                                                  */
/* ------------------------------------------------------------------ */

async function sb<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as T;
}

/* ------------------------------------------------------------------ */
/* Row mappers                                                         */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSchool(r: any): SchoolInfo {
  return {
    id: r.id,
    schoolName: r.school_name,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone ?? "",
    state: r.state ?? "",
    country: r.country ?? "",
    schoolType: r.school_type ?? "",
    schoolLevel: r.school_level ?? "",
    studentPopulation: r.student_population ?? "",
    staffPopulation: r.staff_population ?? "",
    assessmentDate: r.assessment_date,
    createdAt: r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAnswer(r: any): AnswerRecord {
  return {
    questionId: r.question_id,
    chapter: r.chapter as ChapterKey,
    score: Number(r.score),
    answer: r.answer ?? "",
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface SchoolInput {
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
}

/** Create the school record + a fresh assessment in one call. */
export async function createSchoolAssessment(
  input: SchoolInput,
): Promise<{ schoolId: string; assessmentId: string }> {
  const schoolRow = {
    school_name: input.schoolName,
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone,
    state: input.state,
    country: input.country,
    school_type: input.schoolType,
    school_level: input.schoolLevel,
    student_population: input.studentPopulation,
    staff_population: input.staffPopulation,
  };

  if (USE_SUPABASE) {
    const [school] = await sb<{ id: string }[]>("schools", {
      method: "POST",
      body: JSON.stringify(schoolRow),
    });
    const [assessment] = await sb<{ id: string }[]>("assessments", {
      method: "POST",
      body: JSON.stringify({ school_id: school.id }),
    });
    return { schoolId: school.id, assessmentId: assessment.id };
  }

  const schools = await pg<{ id: string }>(
    `INSERT INTO schools (school_name, contact_name, email, phone, state, country, school_type, school_level, student_population, staff_population)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      schoolRow.school_name, schoolRow.contact_name, schoolRow.email,
      schoolRow.phone, schoolRow.state, schoolRow.country, schoolRow.school_type,
      schoolRow.school_level, schoolRow.student_population, schoolRow.staff_population,
    ],
  );
  const assessments = await pg<{ id: string }>(
    `INSERT INTO assessments (school_id) VALUES ($1) RETURNING id`,
    [schools[0].id],
  );
  return { schoolId: schools[0].id, assessmentId: assessments[0].id };
}

/** Upsert a batch of answers (autosave & offline flush). */
export async function saveAnswers(
  assessmentId: string,
  answers: AnswerRecord[],
): Promise<void> {
  if (!answers.length) return;
  if (USE_SUPABASE) {
    await sb("answers", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(
        answers.map((a) => ({
          assessment_id: assessmentId,
          question_id: a.questionId,
          chapter: a.chapter,
          score: a.score,
          answer: a.answer,
        })),
      ),
    });
    return;
  }
  const client = await getPool().connect();
  try {
    await ensurePg();
    await client.query("BEGIN");
    for (const a of answers) {
      await client.query(
        `INSERT INTO answers (assessment_id, question_id, chapter, score, answer)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (assessment_id, question_id)
         DO UPDATE SET score = EXCLUDED.score, answer = EXCLUDED.answer`,
        [assessmentId, a.questionId, a.chapter, a.score, a.answer],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Full assessment state for resuming (school + answers + status). */
export async function getAssessmentState(
  assessmentId: string,
): Promise<AssessmentState | null> {
  if (USE_SUPABASE) {
    const asess = await sb<Record<string, unknown>[]>(
      `assessments?select=*&id=eq.${assessmentId}`,
    );
    if (!asess.length) return null;
    const a = asess[0] as { school_id: string; completed_at: string | null; created_at: string };
    const schools = await sb<Record<string, unknown>[]>(
      `schools?select=*&id=eq.${a.school_id}`,
    );
    if (!schools.length) return null;
    const ans = await sb<Record<string, unknown>[]>(
      `answers?select=question_id,chapter,score,answer&assessment_id=eq.${assessmentId}`,
    );
    const reps = await sb<{ id: string }[]>(
      `reports?select=id&assessment_id=eq.${assessmentId}`,
    );
    return {
      assessmentId,
      school: toSchool(schools[0]),
      answers: ans.map(toAnswer),
      completed: Boolean(a.completed_at),
      hasReport: reps.length > 0,
      createdAt: a.created_at,
    };
  }

  const rows = await pg<Record<string, unknown>>(
    `SELECT a.id AS assessment_id, a.completed_at, a.created_at AS assessment_created, s.*
     FROM assessments a JOIN schools s ON s.id = a.school_id WHERE a.id = $1`,
    [assessmentId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  const ans = await pg<Record<string, unknown>>(
    `SELECT question_id, chapter, score, answer FROM answers WHERE assessment_id = $1`,
    [assessmentId],
  );
  const reps = await pg<{ id: string }>(
    `SELECT id FROM reports WHERE assessment_id = $1`,
    [assessmentId],
  );
  return {
    assessmentId,
    school: toSchool(row),
    answers: ans.map(toAnswer),
    completed: Boolean(row.completed_at),
    hasReport: reps.length > 0,
    createdAt: String(row.assessment_created),
  };
}

/** Persist the generated report and mark the assessment complete (+ anonymous analytics). */
export async function saveReportAndComplete(
  assessmentId: string,
  report: ReportData,
  chapterScores: Record<string, number>,
): Promise<void> {
  const schoolState = await getAssessmentState(assessmentId);
  const completedAtIso = new Date().toISOString();
  const completionSeconds = schoolState
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(schoolState.createdAt).getTime()) / 1000,
        ),
      )
    : 0;

  const ninetyDayPlan = { plan30: report.plan30, plan60: report.plan60, plan90: report.plan90 };

  if (USE_SUPABASE) {
    await sb("reports", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        assessment_id: assessmentId,
        executive_summary: report.executiveSummary,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        recommendations: report.recommendations,
        ninety_day_plan: ninetyDayPlan,
        full_report: report,
      }),
    });
    await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessmentId}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        overall_score: report.overallScore,
        health_rating: report.healthRating,
        priority_area: report.priorityArea,
        completed_at: completedAtIso,
      }),
    });
    await sb("analytics", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        state: schoolState?.school.state ?? "",
        country: schoolState?.school.country ?? "",
        school_type: schoolState?.school.schoolType ?? "",
        overall_score: report.overallScore,
        chapter_scores: chapterScores,
        completion_seconds: completionSeconds,
      }),
    });
    return;
  }

  await pg(
    `INSERT INTO reports (assessment_id, executive_summary, strengths, weaknesses, recommendations, ninety_day_plan, full_report)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (assessment_id) DO UPDATE SET
       executive_summary = EXCLUDED.executive_summary,
       strengths = EXCLUDED.strengths,
       weaknesses = EXCLUDED.weaknesses,
       recommendations = EXCLUDED.recommendations,
       ninety_day_plan = EXCLUDED.ninety_day_plan,
       full_report = EXCLUDED.full_report`,
    [
      assessmentId,
      report.executiveSummary,
      JSON.stringify(report.strengths),
      JSON.stringify(report.weaknesses),
      JSON.stringify(report.recommendations),
      JSON.stringify(ninetyDayPlan),
      JSON.stringify(report),
    ],
  );
  await pg(
    `UPDATE assessments SET overall_score=$2, health_rating=$3, priority_area=$4, completed_at=now() WHERE id=$1`,
    [assessmentId, report.overallScore, report.healthRating, report.priorityArea],
  );
  await pg(
    `INSERT INTO analytics (state, country, school_type, overall_score, chapter_scores, completion_seconds)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      schoolState?.school.state ?? "",
      schoolState?.school.country ?? "",
      schoolState?.school.schoolType ?? "",
      report.overallScore,
      JSON.stringify(chapterScores),
      completionSeconds,
    ],
  );
}

export interface StoredReport {
  report: ReportData;
  school: SchoolInfo;
  createdAt: string;
  completedAt: string | null;
}

export async function getReport(assessmentId: string): Promise<StoredReport | null> {
  if (USE_SUPABASE) {
    const reps = await sb<Record<string, unknown>[]>(
      `reports?select=*&assessment_id=eq.${assessmentId}`,
    );
    if (!reps.length) return null;
    const asess = await sb<Record<string, unknown>[]>(
      `assessments?select=*&id=eq.${assessmentId}`,
    );
    if (!asess.length) return null;
    const a = asess[0] as { school_id: string; completed_at: string | null };
    const schools = await sb<Record<string, unknown>[]>(
      `schools?select=*&id=eq.${a.school_id}`,
    );
    if (!schools.length) return null;
    return {
      report: reps[0].full_report as ReportData,
      school: toSchool(schools[0]),
      createdAt: String(reps[0].created_at),
      completedAt: a.completed_at ? String(a.completed_at) : null,
    };
  }

  const rows = await pg<Record<string, unknown>>(
    `SELECT r.full_report, r.created_at AS report_created, a.completed_at, s.*
     FROM reports r
     JOIN assessments a ON a.id = r.assessment_id
     JOIN schools s ON s.id = a.school_id
     WHERE r.assessment_id = $1`,
    [assessmentId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    report: row.full_report as ReportData,
    school: toSchool(row),
    createdAt: String(row.report_created),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

/** Idempotency check used by the analyze route. */
export async function hasReport(assessmentId: string): Promise<boolean> {
  if (USE_SUPABASE) {
    const reps = await sb<{ id: string }[]>(
      `reports?select=id&assessment_id=eq.${assessmentId}`,
    );
    return reps.length > 0;
  }
  const rows = await pg<{ id: string }>(
    `SELECT id FROM reports WHERE assessment_id = $1`,
    [assessmentId],
  );
  return rows.length > 0;
}

export interface ContactInput {
  schoolName: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  requestType: string;
}

export async function createContactRequest(input: ContactInput): Promise<string> {
  const row = {
    school_name: input.schoolName,
    name: input.name,
    email: input.email,
    phone: input.phone,
    request_type: input.requestType,
    message: input.message,
  };
  if (USE_SUPABASE) {
    const [r] = await sb<{ id: string }[]>("contact_requests", {
      method: "POST",
      body: JSON.stringify(row),
    });
    return r.id;
  }
  const rows = await pg<{ id: string }>(
    `INSERT INTO contact_requests (school_name, name, email, phone, request_type, message)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [row.school_name, row.name, row.email, row.phone, row.request_type, row.message],
  );
  return rows[0].id;
}

export async function logEmail(
  toEmail: string,
  subject: string,
  status: string,
  detail: string,
): Promise<void> {
  try {
    if (USE_SUPABASE) {
      await sb("email_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ to_email: toEmail, subject, status, detail }),
      });
      return;
    }
    await pg(
      `INSERT INTO email_log (to_email, subject, status, detail) VALUES ($1,$2,$3,$4)`,
      [toEmail, subject, status, detail],
    );
  } catch {
    /* logging must never break the main flow */
  }
}

/** Anonymous aggregate stats — used for honest social proof on the landing page. */
export async function getGlobalStats(): Promise<GlobalStats> {
  const fallback: GlobalStats = { totalReports: 0, averageScore: 0, mostCommonWeakness: "" };
  try {
    if (USE_SUPABASE) {
      const analytics = await sb<Record<string, unknown>[]>(
        "analytics?select=overall_score",
      );
      const lows = await sb<{ chapter: string }[]>(
        "answers?select=chapter&score=lte.2&limit=5000",
      );
      const counts = new Map<string, number>();
      for (const l of lows) counts.set(l.chapter, (counts.get(l.chapter) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      const avg = analytics.length
        ? Math.round(
            analytics.reduce((s, r) => s + Number((r as { overall_score: number }).overall_score), 0) /
              analytics.length,
          )
        : 0;
      return { totalReports: analytics.length, averageScore: avg, mostCommonWeakness: top?.[0] ?? "" };
    }
    const agg = await pg<{ c: string; avg: string }>(
      `SELECT COUNT(*)::text AS c, COALESCE(ROUND(AVG(overall_score)),0)::text AS avg FROM analytics`,
    );
    const low = await pg<{ chapter: string }>(
      `SELECT chapter, COUNT(*) AS c FROM answers WHERE score <= 2 GROUP BY chapter ORDER BY c DESC LIMIT 1`,
    );
    return {
      totalReports: Number(agg[0]?.c ?? 0),
      averageScore: Number(agg[0]?.avg ?? 0),
      mostCommonWeakness: low[0]?.chapter ?? "",
    };
  } catch {
    return fallback;
  }
}

export function storageBackend(): "supabase" | "postgres" {
  return USE_SUPABASE ? "supabase" : "postgres";
}
