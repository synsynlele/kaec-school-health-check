import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const required = [
  "src/lib/supabase/client.ts",
  "src/lib/khpos/auth.ts",
  "src/lib/khpos/workspace.ts",
  "src/components/khpos/ActivationFlow.tsx",
  "src/components/khpos/CommandCentre.tsx",
  "src/components/khpos/ReportActivationCard.tsx",
  "src/app/activate/[id]/page.tsx",
  "src/app/auth/callback/page.tsx",
  "src/app/khpos/[organisationId]/page.tsx",
  "src/app/api/khpos/workspace/[id]/route.ts",
  "supabase/migrations/20260814171842_stage1c_server_mediated_claim.sql",
];
for (const file of required) assert.ok(existsSync(file), `${file} must exist`);

const activation = readFileSync("src/components/khpos/ActivationFlow.tsx", "utf8");
assert.match(activation, /provider:\s*"google"/);
assert.match(activation, /Continue with Google/);
assert.match(activation, /signInWithOtp/);
assert.match(activation, /createEmailLinkSupabaseClient/);
assert.ok(activation.indexOf("Continue with Google") < activation.indexOf("Email fallback"), "Google must be the primary visible auth path");
assert.match(activation, /\/auth\/callback\?next=/);
assert.match(activation, /\/api\/khpos\/claim\/\$\{assessmentId\}/);

const client = readFileSync("src/lib/supabase/client.ts", "utf8");
assert.match(client, /flowType: "pkce"/);
assert.match(client, /flowType: "implicit"/);

const callback = readFileSync("src/app/auth/callback/page.tsx", "utf8");
assert.match(callback, /exchangeCodeForSession/);
assert.match(callback, /setSession/);

const auth = readFileSync("src/lib/khpos/auth.ts", "utf8");
assert.match(auth, /\/auth\/v1\/user/);
assert.match(auth, /email_confirmed_at/);

const claim = readFileSync("src/lib/khpos/claim.ts", "utf8");
assert.match(claim, /claim_kshc_assessment_server/);
assert.doesNotMatch(claim, /Authorization:\s*`Bearer \$\{accessToken\}`/);

const migration = readFileSync("supabase/migrations/20260814171842_stage1c_server_mediated_claim.sql", "utf8");
assert.match(migration, /claim_kshc_assessment_server/);
assert.match(migration, /email_confirmed_at is not null/i);
assert.match(migration, /grant execute .* to service_role/i);
assert.match(migration, /drop function if exists public\.claim_kshc_assessment\(uuid\)/i);

const workspace = readFileSync("src/lib/khpos/workspace.ts", "utf8");
assert.match(workspace, /organisation_memberships\?/);
assert.match(workspace, /user_id=eq/);
assert.match(workspace, /status=eq\.active/);

const actions = readFileSync("src/components/report/ActionsBar.tsx", "utf8");
assert.match(actions, /Activate KHP-OS/);
assert.match(actions, /\/activate\/\$\{assessmentId\}/);

console.log("KHP-OS Stage 1C structural validation passed: Google-first activation and secure workspace bridge are present.");
