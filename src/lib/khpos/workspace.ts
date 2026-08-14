const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class KhposWorkspaceError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "KhposWorkspaceError";
  }
}

async function serviceFetch<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposWorkspaceError("KHP-OS workspace is not configured.", 503);
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new KhposWorkspaceError("The KHP-OS workspace could not be loaded.", 500);
  }

  return (await response.json()) as T;
}

interface ReportSnapshot {
  overallScore?: number;
  healthRating?: string;
  priorityArea?: string;
  priorityAreas?: Array<{ title: string; why: string; firstStep: string }>;
  departmentScores?: Array<{ chapter: string; title: string; score: number; summary?: string }>;
  plan30?: Array<{ task: string; outcome: string }>;
  plan60?: Array<{ task: string; outcome: string }>;
  plan90?: Array<{ task: string; outcome: string }>;
}

export interface KhposWorkspaceSnapshot {
  organisation: {
    id: string;
    name: string;
    country: string | null;
    state: string | null;
    schoolType: string | null;
    schoolLevel: string | null;
  };
  membership: { role: string };
  baseline: {
    assessmentId: string;
    completedAt: string | null;
    overallScore: number | null;
    healthRating: string | null;
    priorityArea: string | null;
    frameworkVersion: string;
  } | null;
  priorityAreas: Array<{ title: string; why: string; firstStep: string }>;
  departmentScores: Array<{ chapter: string; title: string; score: number; summary?: string }>;
  first90Days: {
    day30: Array<{ task: string; outcome: string }>;
    day60: Array<{ task: string; outcome: string }>;
    day90: Array<{ task: string; outcome: string }>;
  };
  transformation: {
    activePriorityCount: number;
    activeInterventionCount: number;
  };
}

export async function getKhposWorkspaceSnapshot(
  organisationId: string,
  userId: string,
): Promise<KhposWorkspaceSnapshot> {
  const membership = await serviceFetch<Array<{ role: string }>>(
    `organisation_memberships?organisation_id=eq.${encodeURIComponent(organisationId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=role&limit=1`,
  );

  if (!membership[0]) {
    throw new KhposWorkspaceError("You do not have access to this school workspace.", 403);
  }

  const organisations = await serviceFetch<
    Array<{
      id: string;
      name: string;
      country: string | null;
      state: string | null;
      school_type: string | null;
      school_level: string | null;
    }>
  >(
    `organisations?id=eq.${encodeURIComponent(organisationId)}&select=id,name,country,state,school_type,school_level&limit=1`,
  );

  const organisation = organisations[0];
  if (!organisation) {
    throw new KhposWorkspaceError("School workspace not found.", 404);
  }

  const assessments = await serviceFetch<
    Array<{
      id: string;
      completed_at: string | null;
      overall_score: number | null;
      health_rating: string | null;
      priority_area: string | null;
      framework_version: string;
    }>
  >(
    `assessments?organisation_id=eq.${encodeURIComponent(organisationId)}&status=eq.completed&select=id,completed_at,overall_score,health_rating,priority_area,framework_version&order=completed_at.desc&limit=1`,
  );

  const latest = assessments[0] ?? null;
  let report: ReportSnapshot = {};

  if (latest) {
    const reports = await serviceFetch<Array<{ full_report: ReportSnapshot }>>(
      `reports?assessment_id=eq.${encodeURIComponent(latest.id)}&select=full_report&limit=1`,
    );
    report = reports[0]?.full_report ?? {};
  }

  const [activePriorities, activeInterventions] = await Promise.all([
    serviceFetch<Array<{ id: string }>>(
      `khpos_priorities?organisation_id=eq.${encodeURIComponent(organisationId)}&status=in.(approved,active)&select=id&limit=4`,
    ),
    serviceFetch<Array<{ id: string }>>(
      `khpos_organisation_interventions?organisation_id=eq.${encodeURIComponent(organisationId)}&status=in.(approved,planned,active,under_review)&select=id&limit=4`,
    ),
  ]);

  return {
    organisation: {
      id: organisation.id,
      name: organisation.name,
      country: organisation.country,
      state: organisation.state,
      schoolType: organisation.school_type,
      schoolLevel: organisation.school_level,
    },
    membership: { role: membership[0].role },
    baseline: latest
      ? {
          assessmentId: latest.id,
          completedAt: latest.completed_at,
          overallScore: latest.overall_score ?? report.overallScore ?? null,
          healthRating: latest.health_rating ?? report.healthRating ?? null,
          priorityArea: latest.priority_area ?? report.priorityArea ?? null,
          frameworkVersion: latest.framework_version,
        }
      : null,
    priorityAreas: report.priorityAreas ?? [],
    departmentScores: report.departmentScores ?? [],
    first90Days: {
      day30: report.plan30 ?? [],
      day60: report.plan60 ?? [],
      day90: report.plan90 ?? [],
    },
    transformation: {
      activePriorityCount: activePriorities.length,
      activeInterventionCount: activeInterventions.length,
    },
  };
}
