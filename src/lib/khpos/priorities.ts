import { CHAPTER_MAP, QUESTION_INDEX } from "@/lib/questions";
import {
  getKhposIndicatorMapping,
  getKhposRoute,
  KHPOS_SYSTEMS,
} from "@/lib/khpos/foundation";
import {
  getKhposWorkspaceSnapshot,
  type KhposWorkspaceSnapshot,
} from "@/lib/khpos/workspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPROVER_ROLES = new Set(["executive", "transformation_lead"]);

export class KhposPriorityError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "KhposPriorityError";
  }
}

interface AnswerRow {
  id: string;
  question_id: string | null;
  score: number | null;
  chapter: string | null;
  created_at: string | null;
}

interface PriorityRow {
  id: string;
  source_assessment_id: string;
  source_indicator_id: string;
  title: string;
  problem_statement: string;
  khp_system_id: string;
  indicator_score: number;
  priority_score: number | string;
  status: string;
  approved_at: string | null;
}

interface OrganisationInterventionRow {
  id: string;
  priority_id: string;
  intervention_version_id: string;
  title: string;
  contextualised_description: string;
  owner_id: string | null;
  start_date: string | null;
  target_date: string | null;
  status: string;
}

interface InterventionVersionRow {
  id: string;
  intervention_id: string;
  version: string;
  expected_outcome: string;
  implementation_guidance: string;
  complexity: string;
  recommended_duration_days: number;
}

interface InterventionRow {
  id: string;
  intervention_code: string;
  title: string;
  primary_system_id: string;
}

export interface KhposPriorityCandidate {
  indicatorId: string;
  indicatorScore: number;
  priorityScore: number;
  chapter: string;
  chapterTitle: string;
  question: string;
  hint: string;
  routeLabel: string;
  route: string;
  routePriority: string;
  systemId: string;
  systemName: string;
  interventionTitle: string;
  priorityTitle: string;
  problemStatement: string;
  whyNow: string;
}

export interface KhposApprovedPriority {
  id: string;
  indicatorId: string;
  title: string;
  problemStatement: string;
  systemId: string;
  systemName: string;
  indicatorScore: number;
  priorityScore: number;
  status: string;
  approvedAt: string | null;
  intervention: {
    id: string;
    code: string | null;
    title: string;
    version: string | null;
    expectedOutcome: string | null;
    implementationGuidance: string | null;
    complexity: string | null;
    recommendedDurationDays: number | null;
    ownerId: string | null;
    startDate: string | null;
    targetDate: string | null;
    status: string;
  } | null;
}

export interface KhposPriorityWorkspace {
  organisation: KhposWorkspaceSnapshot["organisation"];
  membership: KhposWorkspaceSnapshot["membership"];
  baseline: KhposWorkspaceSnapshot["baseline"];
  canApprove: boolean;
  agendaLimit: 3;
  approvedCount: number;
  approved: KhposApprovedPriority[];
  candidates: KhposPriorityCandidate[];
}

async function serviceRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new KhposPriorityError("KHP-OS priority intelligence is not configured.", 503);
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const body = await response.text();
  if (!response.ok) {
    let message = "The transformation agenda could not be updated.";
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // Keep the safe fallback.
    }
    throw new KhposPriorityError(message, response.status >= 500 ? 500 : 400);
  }

  return (body ? JSON.parse(body) : null) as T;
}

function systemIdForName(name: string): string {
  return (
    KHPOS_SYSTEMS.find((system) => system.name === name)?.id ??
    "institutional_excellence"
  );
}

function systemNameForId(id: string): string {
  return KHPOS_SYSTEMS.find((system) => system.id === id)?.name ?? id;
}

function priorityScoreFor(
  score: number,
  chapter: string,
  areaScore: number | null,
): number {
  const severity = (6 - score) * 18;
  const areaGap = areaScore === null ? 0 : Math.min(12, Math.max(0, 100 - areaScore) / 6);
  const criticality =
    (chapter === "safety" || chapter === "governance") && score <= 2
      ? 8
      : (chapter === "leadership" || chapter === "teaching") && score <= 2
        ? 4
        : 0;

  return Math.round(Math.min(100, severity + areaGap + criticality) * 10) / 10;
}

function topBalancedCandidates(
  candidates: KhposPriorityCandidate[],
): KhposPriorityCandidate[] {
  const chapterCounts = new Map<string, number>();
  const selected: KhposPriorityCandidate[] = [];

  for (const candidate of candidates) {
    const count = chapterCounts.get(candidate.chapter) ?? 0;
    if (count >= 2) continue;
    selected.push(candidate);
    chapterCounts.set(candidate.chapter, count + 1);
    if (selected.length >= 8) break;
  }

  return selected;
}

function inFilter(ids: string[]): string {
  return `in.(${ids.join(",")})`;
}

export async function getKhposPriorityWorkspace(
  organisationId: string,
  userId: string,
): Promise<KhposPriorityWorkspace> {
  const workspace = await getKhposWorkspaceSnapshot(organisationId, userId);
  const assessmentId = workspace.baseline?.assessmentId;

  if (!assessmentId) {
    return {
      organisation: workspace.organisation,
      membership: workspace.membership,
      baseline: null,
      canApprove: APPROVER_ROLES.has(workspace.membership.role),
      agendaLimit: 3,
      approvedCount: 0,
      approved: [],
      candidates: [],
    };
  }

  const [answers, priorities] = await Promise.all([
    serviceRequest<AnswerRow[]>(
      `answers?assessment_id=eq.${encodeURIComponent(assessmentId)}&select=id,question_id,score,chapter,created_at&order=created_at.desc`,
    ),
    serviceRequest<PriorityRow[]>(
      `khpos_priorities?organisation_id=eq.${encodeURIComponent(organisationId)}&source_assessment_id=eq.${encodeURIComponent(assessmentId)}&status=in.(approved,active)&select=id,source_assessment_id,source_indicator_id,title,problem_statement,khp_system_id,indicator_score,priority_score,status,approved_at&order=priority_score.desc`,
    ),
  ]);

  const latestByIndicator = new Map<string, AnswerRow>();
  for (const answer of answers) {
    if (!answer.question_id || latestByIndicator.has(answer.question_id)) continue;
    latestByIndicator.set(answer.question_id, answer);
  }

  let orgInterventions: OrganisationInterventionRow[] = [];
  if (priorities.length) {
    orgInterventions = await serviceRequest<OrganisationInterventionRow[]>(
      `khpos_organisation_interventions?organisation_id=eq.${encodeURIComponent(organisationId)}&priority_id=${encodeURIComponent(inFilter(priorities.map((priority) => priority.id)))}&select=id,priority_id,intervention_version_id,title,contextualised_description,owner_id,start_date,target_date,status`,
    );
  }

  const versionIds = [...new Set(orgInterventions.map((item) => item.intervention_version_id))];
  const versions = versionIds.length
    ? await serviceRequest<InterventionVersionRow[]>(
        `khpos_intervention_versions?id=${encodeURIComponent(inFilter(versionIds))}&select=id,intervention_id,version,expected_outcome,implementation_guidance,complexity,recommended_duration_days`,
      )
    : [];

  const interventionIds = [...new Set(versions.map((version) => version.intervention_id))];
  const interventionDefinitions = interventionIds.length
    ? await serviceRequest<InterventionRow[]>(
        `khpos_interventions?id=${encodeURIComponent(inFilter(interventionIds))}&select=id,intervention_code,title,primary_system_id`,
      )
    : [];

  const interventionByPriority = new Map(
    orgInterventions.map((intervention) => [intervention.priority_id, intervention]),
  );
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const definitionById = new Map(
    interventionDefinitions.map((definition) => [definition.id, definition]),
  );

  const approved: KhposApprovedPriority[] = priorities.map((priority) => {
    const organisationIntervention = interventionByPriority.get(priority.id) ?? null;
    const version = organisationIntervention
      ? versionById.get(organisationIntervention.intervention_version_id) ?? null
      : null;
    const definition = version
      ? definitionById.get(version.intervention_id) ?? null
      : null;

    return {
      id: priority.id,
      indicatorId: priority.source_indicator_id,
      title: priority.title,
      problemStatement: priority.problem_statement,
      systemId: priority.khp_system_id,
      systemName: systemNameForId(priority.khp_system_id),
      indicatorScore: priority.indicator_score,
      priorityScore: Number(priority.priority_score),
      status: priority.status,
      approvedAt: priority.approved_at,
      intervention: organisationIntervention
        ? {
            id: organisationIntervention.id,
            code: definition?.intervention_code ?? null,
            title: organisationIntervention.title,
            version: version?.version ?? null,
            expectedOutcome: version?.expected_outcome ?? null,
            implementationGuidance: version?.implementation_guidance ?? null,
            complexity: version?.complexity ?? null,
            recommendedDurationDays: version?.recommended_duration_days ?? null,
            ownerId: organisationIntervention.owner_id,
            startDate: organisationIntervention.start_date,
            targetDate: organisationIntervention.target_date,
            status: organisationIntervention.status,
          }
        : null,
    };
  });

  const approvedIndicators = new Set(approved.map((priority) => priority.indicatorId));
  const areaScores = new Map(
    workspace.departmentScores.map((area) => [area.chapter, Number(area.score)]),
  );

  const rawCandidates: KhposPriorityCandidate[] = [];

  for (const [indicatorId, answer] of latestByIndicator) {
    const score = Number(answer.score);
    if (!Number.isFinite(score) || score < 1 || score > 3) continue;
    if (approvedIndicators.has(indicatorId)) continue;

    const question = QUESTION_INDEX[indicatorId];
    const mapping = getKhposIndicatorMapping(indicatorId);
    const route = getKhposRoute(score);

    if (!question || !mapping || !route) continue;

    const systemId = systemIdForName(mapping.primarySystem);
    const chapterTitle = CHAPTER_MAP[question.chapter]?.title ?? question.chapter;
    const scoreValue = priorityScoreFor(
      score,
      question.chapter,
      areaScores.get(question.chapter) ?? null,
    );
    const priorityTitle = `Strengthen ${mapping.interventionFamily}`;

    rawCandidates.push({
      indicatorId,
      indicatorScore: score,
      priorityScore: scoreValue,
      chapter: question.chapter,
      chapterTitle,
      question: question.text,
      hint: question.hint,
      routeLabel: route.label,
      route: route.route,
      routePriority: route.priority,
      systemId,
      systemName: mapping.primarySystem,
      interventionTitle: mapping.interventionFamily,
      priorityTitle,
      problemStatement: `KSHC scored this indicator ${score}/5 (${route.label}). ${question.text}`,
      whyNow: `${route.priority} attention: this evidence routes to ${route.route} before lower-risk optimisation work.`,
    });
  }

  rawCandidates.sort(
    (a, b) =>
      b.priorityScore - a.priorityScore ||
      a.indicatorScore - b.indicatorScore ||
      a.indicatorId.localeCompare(b.indicatorId),
  );

  return {
    organisation: workspace.organisation,
    membership: workspace.membership,
    baseline: workspace.baseline,
    canApprove: APPROVER_ROLES.has(workspace.membership.role),
    agendaLimit: 3,
    approvedCount: approved.length,
    approved,
    candidates: topBalancedCandidates(rawCandidates),
  };
}

export async function approveKhposPriority(
  organisationId: string,
  userId: string,
  indicatorId: string,
): Promise<void> {
  const workspace = await getKhposPriorityWorkspace(organisationId, userId);

  if (!workspace.canApprove) {
    throw new KhposPriorityError(
      "Only an executive or transformation lead can approve transformation priorities.",
      403,
    );
  }

  if (workspace.approvedCount >= workspace.agendaLimit) {
    throw new KhposPriorityError(
      "This transformation agenda already has three active priorities. Archive one before approving another.",
      409,
    );
  }

  const candidate = workspace.candidates.find(
    (item) => item.indicatorId === indicatorId,
  );

  if (!candidate || !workspace.baseline) {
    throw new KhposPriorityError(
      "That indicator is not currently eligible for the focused transformation agenda.",
      400,
    );
  }

  await serviceRequest<unknown>("rpc/khpos_approve_priority_server", {
    method: "POST",
    body: JSON.stringify({
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_assessment_id: workspace.baseline.assessmentId,
      p_indicator_id: candidate.indicatorId,
      p_title: candidate.priorityTitle,
      p_problem_statement: candidate.problemStatement,
      p_khp_system_id: candidate.systemId,
      p_indicator_score: candidate.indicatorScore,
      p_priority_score: candidate.priorityScore,
      p_owner_id: userId,
    }),
  });
}

export async function archiveKhposPriority(
  organisationId: string,
  userId: string,
  priorityId: string,
): Promise<void> {
  const workspace = await getKhposPriorityWorkspace(organisationId, userId);

  if (!workspace.canApprove) {
    throw new KhposPriorityError(
      "Only an executive or transformation lead can change the transformation agenda.",
      403,
    );
  }

  if (!workspace.approved.some((priority) => priority.id === priorityId)) {
    throw new KhposPriorityError("Active priority not found.", 404);
  }

  await serviceRequest<unknown>("rpc/khpos_archive_priority_server", {
    method: "POST",
    body: JSON.stringify({
      p_actor_user_id: userId,
      p_organisation_id: organisationId,
      p_priority_id: priorityId,
    }),
  });
}
