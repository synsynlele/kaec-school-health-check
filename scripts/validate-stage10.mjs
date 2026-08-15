import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function expectContains(path, needles) {
  const content = read(path);
  for (const needle of needles) {
    if (!content.includes(needle)) {
      throw new Error(`${path} is missing required Stage 10 contract: ${needle}`);
    }
  }
}

function expectNotContains(path, needles) {
  const content = read(path).toLowerCase();
  for (const needle of needles) {
    if (content.includes(needle.toLowerCase())) {
      throw new Error(`${path} contains forbidden legacy positioning: ${needle}`);
    }
  }
}

const migration =
  "supabase/migrations/20260814215444_stage10_platform_governance_production_readiness.sql";

expectContains(migration, [
  "platform_role text not null default 'portfolio_admin'",
  "'super_admin','portfolio_admin','support_reviewer'",
  "khpos_platform_audit_events",
  "khpos_get_admin_console_server",
  "khpos_manage_platform_admin_server",
  "A short governance reason of at least 12 characters is required.",
  "A Super Admin cannot suspend their own active session.",
  "KHP-OS must retain at least one active Super Admin.",
  "adminChangesRequireMfaAal2',true",
  "schoolMembershipSeparate',true",
  "publicRankingEnabled',false",
  "revoke execute on function public.khpos_get_admin_console_server(uuid) from public, anon, authenticated",
  "grant execute on function public.khpos_get_admin_console_server(uuid) to service_role",
  "grant execute on function public.khpos_manage_platform_admin_server(uuid,text,text,text,text) to service_role",
]);

expectContains("src/lib/khpos/auth.ts", [
  "KhposAuthenticatorAssuranceLevel",
  "assuranceLevelFromVerifiedToken",
  "payload.aal === \"aal2\"",
]);

expectContains("src/lib/khpos/platform-admin.ts", [
  "super_admin",
  "portfolio_admin",
  "support_reviewer",
  "getKhposAdminDashboard",
  "manageKhposPlatformAdmin",
  "user.aal !== \"aal2\"",
  "governanceChangesUnlocked",
]);

expectContains("src/lib/supabase/client.ts", [
  "KHPOS_SUPABASE_PUBLIC_URL_FALLBACK",
  "KHPOS_SUPABASE_PUBLISHABLE_KEY_FALLBACK",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY, which is never exposed here",
]);

expectContains("src/app/api/khpos/admin/route.ts", [
  "bearerTokenFromRequest",
  "verifyKhposAccessToken",
  "getKhposAdminDashboard",
  "manageKhposPlatformAdmin",
  '"Cache-Control": "private, no-store"',
]);

expectContains("src/components/khpos/AdminConsoleWorkspace.tsx", [
  "KHP-OS | KAEC-NG Admin Console",
  "Set up authenticator MFA",
  "Verify MFA",
  "Platform access governance",
  "Platform audit",
  "Platform governance is separate from school authority.",
]);

expectContains("src/components/khpos/SchoolWorkspaceNav.tsx", [
  'href="/khpos/admin"',
  "Admin Console",
]);

expectContains("next.config.ts", [
  'source: "/khpos/:path*"',
  'source: "/api/khpos/:path*"',
  'value: "private, no-store"',
  'value: "DENY"',
]);

expectContains("src/app/page.tsx", [
  "CompanyAbout",
  "CompanyContact",
]);
expectContains("src/components/landing/CompanyPositioning.tsx", [
  "Human Potential Development Company",
  "Discover, Develop and Deploy Potential",
  "KAEC School Health Check (KSHC)",
  "KHP-OS",
]);
expectContains("src/lib/site.ts", [
  'companyName: "KAEC-NG"',
  'companyCategory: "Human Potential Development Company"',
  "Discover, Develop and Deploy Potential",
]);
expectContains("src/app/contact/page.tsx", [
  "Contact KAEC-NG",
  "institutional transformation",
  "Human Potential Development",
  "KHP-OS",
]);
expectContains("src/components/landing/Faq.tsx", [
  "Human Potential Development",
  "institutional transformation",
  "KHP-OS",
]);
expectContains("src/app/layout.tsx", [
  "human potential development",
  "institutional transformation",
  "KHP-OS",
]);
expectContains("src/components/site/ContactForm.tsx", [
  "Discuss institutional transformation",
  "Request capability development",
  "Talk to KAEC-NG about my school",
]);

for (const publicPath of [
  "src/components/landing/CompanyPositioning.tsx",
  "src/components/landing/Faq.tsx",
  "src/app/layout.tsx",
  "src/app/contact/page.tsx",
  "src/components/site/ContactForm.tsx",
  "src/lib/site.ts",
]) {
  expectNotContains(publicPath, [
    "education consultancy",
    "consulting firm",
    "our consultants",
    "senior kaec consultant",
    "book a consultation",
  ]);
}

expectContains("scripts/test-core.mjs", ["scripts/validate-stage10.mjs"]);

console.log("Stage 10 Platform Governance & Production Readiness structural checks passed.");
