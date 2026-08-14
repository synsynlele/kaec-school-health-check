import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function expectContains(path, needles) {
  const content = read(path);
  for (const needle of needles) {
    if (!content.includes(needle)) {
      throw new Error(`${path} is missing required partner-access contract: ${needle}`);
    }
  }
}

function expectNotContains(path, needles) {
  const content = read(path);
  for (const needle of needles) {
    if (content.includes(needle)) {
      throw new Error(`${path} contains forbidden partner-access behavior: ${needle}`);
    }
  }
}

const migration =
  "supabase/migrations/20260814225329_partner_access_entitlement_gate.sql";

expectContains(migration, [
  "partner_status text not null default 'pending'",
  "partner_entitlements text[] not null default array['khpos_core']::text[]",
  "'pending'::text,'suspended'::text,'ended'::text",
  "khpos_guard_active_membership_by_partner",
  "KHP-OS membership cannot be active until the institution partnership is active.",
  "khpos_sync_memberships_for_partner_status",
  "'partnership_requested'",
  "khpos_get_partner_registry_server",
  "khpos_manage_partner_server",
  "p_action='approve'",
  "p_action='suspend'",
  "p_action='reactivate'",
  "p_action='end'",
  "revoke execute on function public.khpos_get_partner_registry_server(uuid) from public, anon, authenticated",
  "grant execute on function public.khpos_get_partner_registry_server(uuid) to service_role",
  "revoke execute on function public.khpos_manage_partner_server(uuid,uuid,text,text) from public, anon, authenticated",
  "grant execute on function public.khpos_manage_partner_server(uuid,uuid,text,text) to service_role",
]);

expectNotContains(migration, [
  "values (v_organisation_id, p_user_id, 'executive', 'active')",
]);

expectContains(
  "supabase/migrations/20260814230238_partner_access_approved_by_index.sql",
  ["organisations_partner_approved_by_idx", "partner_approved_by"],
);

expectContains("src/components/site/Header.tsx", [
  'href="/account"',
  "Sign in",
  "Create account",
  "Start Free Assessment",
]);

expectContains("src/components/khpos/ReportActivationCard.tsx", [
  "Request KHP-OS Partnership",
  "Partnership approval required",
  "No automatic KHP-OS access",
]);
expectNotContains("src/components/khpos/ReportActivationCard.tsx", [
  ">Activate KHP-OS<",
]);

expectContains("src/components/khpos/ActivationFlow.tsx", [
  "requestPartnership",
  "/khpos/partnership/${body.organisationId}",
  "Creating an account does not automatically activate KHP-OS.",
  "KAEC-NG approves access",
]);
expectNotContains("src/components/khpos/ActivationFlow.tsx", [
  "router.replace(`/khpos/${body.organisationId}`)",
]);

expectContains("src/lib/khpos/workspace.ts", [
  "partner_status",
  'organisation.partner_status !== "active"',
  "active KAEC-NG partnership",
  "active school membership",
]);

expectContains("src/lib/khpos/partnership.ts", [
  '"pending" | "active" | "suspended" | "ended"',
  '"approve" | "suspend" | "reactivate" | "end"',
  '"khpos_core"',
  "getUserPartnerships",
  "getPartnerRegistry",
  "managePartner",
  'user.aal !== "aal2"',
]);

expectContains("src/app/api/account/route.ts", [
  "verifyKhposAccessToken",
  "getUserPartnerships",
  '"Cache-Control": "private, no-store"',
]);
expectContains("src/app/api/khpos/partnership/[id]/route.ts", [
  "verifyKhposAccessToken",
  "getUserPartnership",
]);
expectContains("src/app/api/khpos/admin/partners/route.ts", [
  "getPartnerRegistry",
  "managePartner",
]);
expectContains("src/app/api/khpos/claim/[id]/route.ts", [
  "Sign in before requesting KHP-OS partnership.",
  "partnership request failed",
]);

expectContains("src/components/account/AccountAccess.tsx", [
  "Creating an account does",
  "not",
  "grant KHP-OS access",
  'item.partnerStatus === "active"',
  "Open KHP-OS",
]);
expectContains("src/components/khpos/PartnershipStatusWorkspace.tsx", [
  "KHP-OS access:",
  'partnership.partnerStatus === "active"',
  "Partnership request received",
]);
expectContains("src/components/khpos/PartnerRegistryWorkspace.tsx", [
  "School Partnership Registry",
  "Accounts are open. KHP-OS is not.",
  "approve",
  "suspend",
  "reactivate",
  "end",
  "Administrator MFA (AAL2) is required.",
]);

expectContains("src/app/khpos/page.tsx", [
  "Account access and KHP-OS access are intentionally different.",
  'href="/khpos/admin/partnerships"',
  'href="/account"',
]);

expectContains("scripts/test-core.mjs", ["scripts/validate-partner-access.mjs"]);

console.log("KHP-OS Partner Access Governance structural checks passed.");
