import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260814194219_stage7_ksi_integration.sql", import.meta.url), "utf8");
const cryptoFix = readFileSync(new URL("../supabase/migrations/20260814194338_stage7_ksi_integration_crypto_fix.sql", import.meta.url), "utf8");
const atomic = readFileSync(new URL("../supabase/migrations/20260814194428_stage7_ksi_atomic_pairing.sql", import.meta.url), "utf8");
const integration = readFileSync(new URL("../src/lib/khpos/ksi-integration.ts", import.meta.url), "utf8");
const receiver = readFileSync(new URL("../src/app/api/khpos/integrations/ksi/receive/route.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/khpos/integrations/ksi/[id]/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/components/khpos/LearningIntelligenceWorkspace.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/khpos/[organisationId]/learning-intelligence/page.tsx", import.meta.url), "utf8");

assert.match(migration, /create table if not exists public\.khpos_integrations/);
assert.match(migration, /create table if not exists public\.khpos_ksi_signal_snapshots/);
assert.match(migration, /revoke all privileges on table public\.khpos_integrations from public, anon, authenticated/);
assert.match(migration, /connector_token_hash/);
assert.match(migration, /pairing_token_hash/);
assert.match(migration, /window_end - window_start <= interval '180 days'/);
assert.doesNotMatch(migration, /update\s+public\.khpos_(priorities|reassessments)/i);
assert.doesNotMatch(cryptoFix, /update\s+public\.khpos_(priorities|reassessments)/i);
assert.doesNotMatch(atomic, /update\s+public\.khpos_(priorities|reassessments)/i);
assert.match(cryptoFix, /extensions\.gen_random_bytes/);
assert.match(cryptoFix, /extensions\.digest/);
assert.match(atomic, /khpos_pair_ksi_with_signal_server/);
assert.match(atomic, /khpos_accept_ksi_pairing_server/);
assert.match(atomic, /khpos_ingest_ksi_signal_server/);

assert.match(integration, /KHPOS_KSI_CONTRACT_VERSION = "1\.0"/);
assert.match(integration, /#code=/);
assert.match(integration, /fidelityCheckCount < 3/);
assert.match(integration, /assessmentCount < 3/);
assert.match(integration, /diagnosisCount < 3/);
assert.match(integration, /confirmedInterventionCount < 2/);
assert.match(integration, /khpos_pair_ksi_with_signal_server/);
assert.match(receiver, /content-length/);
assert.match(receiver, /16_384/);
assert.match(receiver, /z\.discriminatedUnion/);
assert.match(receiver, /pairKsiAndStoreInitialSignal/);
assert.match(receiver, /ingestKsiSignal/);
assert.doesNotMatch(receiver, /student|teacher.*rank/i);
assert.match(route, /verifyKhposAccessToken/);
assert.match(route, /createKhposKsiPairing/);
assert.match(ui, /KSI context does not resolve KSHC priorities/);
assert.match(ui, /No student records, teacher rankings/);
assert.match(page, /LearningIntelligenceWorkspace/);

console.log("KHP-OS Stage 7 KSI integration validation passed: hashed token pairing, atomic bounded signal ingestion, privacy controls, governed signal states and reassessment authority boundary are present.");
