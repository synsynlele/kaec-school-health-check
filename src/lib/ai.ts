/**
 * Backward-compatible coach exports.
 *
 * KSHC report generation lives exclusively in kshc-ai-report.ts so there is
 * only one report-intelligence path and silent legacy fallback cannot return.
 */
export {
  buildCoachSystemPrompt,
  fallbackCoachReply,
  streamCoachReply,
} from "./kshc-ai-coach";
