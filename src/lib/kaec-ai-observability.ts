/**
 * KSHC AI usage observability. Non-blocking from the user's perspective:
 * recording failure is logged but must never prevent a valid report or coach.
 * No school identifiers, prompts, messages or diagnostic contents are stored.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { khposAiRates, khposAiCostMicroUsd } from "@/lib/khpos/ops/ai-budget";

let client: SupabaseClient | null = null;

export async function recordKshcAiUsage(
  feature: "report" | "coach",
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret || !usage) return;
  const inputTokens = Math.max(0, Math.trunc(usage.prompt_tokens ?? 0));
  const outputTokens = Math.max(0, Math.trunc(usage.completion_tokens ?? 0));
  if (!inputTokens && !outputTokens) return;
  try {
    client ??= createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const rates = khposAiRates(model);
    const { error } = await client.from("kaec_ai_usage_events").insert({
      product: "kshc",
      feature,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_micro_usd: rates ? khposAiCostMicroUsd(inputTokens, outputTokens, rates) : null,
    });
    if (error) console.warn("[kshc][ai_usage] ledger unavailable", error.code);
  } catch (error) {
    console.warn("[kshc][ai_usage] ledger failed", error instanceof Error ? error.name : "unknown");
  }
}
