/** Shared server-side model selection for KSHC and KHP-OS.
 * Legacy per-feature model variables are intentionally retired to prevent stale overrides.
 * Preserve direct Chat Completions generation and existing completion budgets during the pilot.
 */
export const KAEC_AI_MODEL = process.env.KAEC_AI_MODEL?.trim() || "gpt-6-luna";

export const KAEC_AI_CHAT_OPTIONS = KAEC_AI_MODEL === "gpt-6-luna"
  ? { reasoning_effort: "none" as const }
  : {};
