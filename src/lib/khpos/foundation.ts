import foundation from "./foundation.v1.json";

export const KHPOS_FOUNDATION_VERSION = foundation.foundationVersion;
export const KSHC_FRAMEWORK = foundation.diagnosticFramework;
export const REPORT_SCHEMA_VERSION = foundation.reportSchemaVersion;
export const SCORING_VERSION = foundation.scoringVersion;
export const AI_REPORT_PROMPT_VERSION = foundation.aiReportPromptVersion;

export const KHPOS_SYSTEMS = foundation.systems;
export const KHPOS_SCORE_ROUTING = foundation.scoreRouting;
export const KHPOS_INDICATOR_REGISTRY = foundation.indicatorRegistry;

export type KhposSystemName = (typeof KHPOS_SYSTEMS)[number]["name"];
export type KhposRoute = (typeof KHPOS_SCORE_ROUTING)[number]["route"];
export type KhposIndicatorMapping = (typeof KHPOS_INDICATOR_REGISTRY)[number];

const indicatorMap = new Map(
  KHPOS_INDICATOR_REGISTRY.map((entry) => [entry.indicatorId, entry]),
);

export function getKhposIndicatorMapping(
  indicatorId: string,
): KhposIndicatorMapping | undefined {
  return indicatorMap.get(indicatorId);
}

export function getKhposRoute(score: number) {
  return KHPOS_SCORE_ROUTING.find((entry) => entry.score === score);
}
