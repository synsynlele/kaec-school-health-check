import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type ExtendedWorkspace = "events" | "parent-journeys" | "network-pulse";
const readFunctions = {
  events: "khpos_ops_get_events_server",
  "parent-journeys": "khpos_ops_get_parent_journeys_server",
  "network-pulse": "khpos_ops_network_pulse_server",
} as const;
const actions = {
  events: { rpc: "khpos_ops_event_action_server", modes: ["create", "plan", "submit", "approve", "return", "start", "complete", "review", "cancel"] },
  "parent-journeys": { rpc: "khpos_ops_parent_journey_action_server", modes: ["record", "advance", "complete", "lost"] },
} as const;

function service() {
  if (!url || !key) throw new Error("School operations are not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function readExtendedWorkspace(type: ExtendedWorkspace, actor: string, org: string): Promise<unknown> {
  const { data, error } = await service().rpc(readFunctions[type], { p_actor: actor, p_org: org });
  if (error) throw new Error(error.message);
  return data;
}

export async function actOnExtendedWorkspace(type: "events" | "parent-journeys", actor: string, org: string, mode: string, input: Record<string, unknown>): Promise<unknown> {
  if (!(actions[type].modes as readonly string[]).includes(mode)) throw new Error("Unsupported action.");
  const { data, error } = await service().rpc(actions[type].rpc, { p_actor: actor, p_org: org, p_mode: mode, p_input: input });
  if (error) throw new Error(error.message);
  return data;
}
