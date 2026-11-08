/**
 * Server-side AI cost governor for KHP-OS.
 *
 * Hard stop BEFORE invoking a paid model, using a Postgres-atomic school/month
 * reservation. AI failure or exhausted quota must never disable governed
 * KHP-OS records, processes, and deterministic recommendations.
 *
 * No prompts, personal data, or model responses are persisted in this ledger.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type KhposAiFeature = "ask" | "briefing" | "meeting" | "improvement" | "network";

interface ModelRates {
  input: number; // US dollars per million input tokens
  output: number; // US dollars per million output tokens
}

export interface KhposAiPermit {
  reservationId: string;
  model: string;
  rates: ModelRates;
  estimatedMicroUsd: number;
}

const KNOWN_MODEL_RATES: Record<string, ModelRates> = {
  "gpt-4.1-mini-2025-04-14": { input: 0.4, output: 1.6 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano-2025-04-14": { input: 0.1, output: 0.4 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
};

function positiveNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function khposAiRates(model: string): ModelRates | null {
  // Unknown model prices must be explicitly set, never silently treated as free.
  const input = positiveNumber(process.env.KHPOS_AI_INPUT_USD_PER_1M);
  const output = positiveNumber(process.env.KHPOS_AI_OUTPUT_USD_PER_1M);
  if (input !== null && output !== null) return { input, output };
  return KNOWN_MODEL_RATES[model] ?? null;
}

export function khposAiMonthlyCapMicroUsd(): number {
  // An operator may lower the cap, but an invalid environment value cannot
  // accidentally make a school unlimited.
  const limit = positiveNumber(process.env.KHPOS_AI_MONTHLY_USD_CAP) ?? 0.3;
  return Math.max(1, Math.floor(limit * 1_000_000));
}

export function khposAiCostMicroUsd(
  inputTokens: number,
  outputTokens: number,
  rates: ModelRates,
): number {
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) ||
      inputTokens < 0 || outputTokens < 0) {
    throw new Error("Invalid token usage.");
  }
  return Math.ceil(inputTokens * rates.input + outputTokens * rates.output);
}

export async function reserveKhposAi(
  client: SupabaseClient,
  options: {
    organisationId: string;
    actorUserId: string;
    feature: KhposAiFeature;
    model: string;
    inputCharacters: number;
    maxOutputTokens: number;
  },
): Promise<KhposAiPermit | null> {
  if (process.env.KHPOS_AI_DISABLED === "1") return null;
  const rates = khposAiRates(options.model);
  if (!rates) {
    console.warn("[khpos][ai_budget] model pricing not configured; using non-AI answer");
    return null;
  }

  // Conservative text estimate (+ request scaffolding). Output tokens are
  // bounded by max_completion_tokens at the provider.
  const inputEstimate = Math.ceil(Math.max(0, options.inputCharacters) / 2) + 512;
  const maxOutput = Math.max(1, Math.ceil(options.maxOutputTokens));
  const estimatedMicroUsd = Math.max(
    1, khposAiCostMicroUsd(inputEstimate, maxOutput, rates),
  );

  try {
    const { data, error } = await client.rpc("khpos_ai_budget_reserve", {
      p_org: options.organisationId,
      p_actor: options.actorUserId,
      p_feature: options.feature,
      p_estimate_micro_usd: estimatedMicroUsd,
      p_limit_micro_usd: khposAiMonthlyCapMicroUsd(),
    });
    if (error) {
      console.warn("[khpos][ai_budget] reservation unavailable", error.code);
      return null; // Fail closed for paid AI. Deterministic KHP-OS stays up.
    }
    if (typeof data !== "string" || !/^[a-f0-9-]{36}$/i.test(data)) return null;
    return {
      reservationId: data,
      model: options.model,
      rates,
      estimatedMicroUsd,
    };
  } catch (error) {
    console.warn("[khpos][ai_budget] reservation failed", error instanceof Error ? error.name : "unknown");
    return null;
  }
}

export async function settleKhposAi(
  client: SupabaseClient,
  permit: KhposAiPermit,
  usage: { inputTokens?: number; outputTokens?: number } | null,
  success: boolean,
): Promise<void> {
  const inputTokens = Math.max(0, Math.floor(usage?.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.floor(usage?.outputTokens ?? 0));
  // If the provider completed but supplied no token count, account for the
  // full reservation instead of under-reporting paid usage.
  const actualMicroUsd = !success ? 0
    : usage ? khposAiCostMicroUsd(inputTokens, outputTokens, permit.rates)
    : permit.estimatedMicroUsd;
  try {
    const { error } = await client.rpc("khpos_ai_budget_settle", {
      p_reservation: permit.reservationId,
      p_actual_micro_usd: actualMicroUsd,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_model: permit.model,
      p_success: success,
    });
    if (error) console.warn("[khpos][ai_budget] settlement unavailable", error.code);
  } catch (error) {
    console.warn("[khpos][ai_budget] settlement failed", error instanceof Error ? error.name : "unknown");
  }
}
