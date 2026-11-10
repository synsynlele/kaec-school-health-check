import assert from "node:assert/strict";
import fs from "node:fs";

const read=p=>fs.readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261110233000_khpos_gate_visitor_kiosk.sql");
const api=read("src/app/api/khpos/visitor-kiosk/route.ts");
const deskApi=read("src/app/api/khpos/ops/visitors/[id]/route.ts");
const service=read("src/lib/khpos/ops/visitors.ts");
const tablet=read("src/components/khpos/VisitorKiosk.tsx");
const desk=read("src/components/khpos/ops/GateVisitorsWorkspace.tsx");
const nav=read("src/components/khpos/SchoolWorkspaceNav.tsx");
const availability=read("src/components/khpos/ops/AvailabilityWorkspace.tsx");
const availabilityApi=read("src/app/api/khpos/ops/availability/[id]/route.ts");

// No direct browser-facing access to any visitor records or device secrets.
for (const table of [
  "khpos_gate_pairing_codes","khpos_gate_devices","khpos_gate_visitor_visits",
  "khpos_gate_visit_events","khpos_gate_kiosk_rate_events",
]) {
  assert(sql.includes("public."+table),"Visitor table is missing: "+table);
}
assert.equal((sql.match(/enable row level security;/g)||[]).length,5,"Every public gate table needs RLS");
assert.match(sql,/from public, anon, authenticated;/i,"Unauthenticated callers have no direct database grants");
assert.match(sql,/to service_role;/,"Only server-side service calls can access gate tables");
assert(!sql.includes("grant select on public.khpos_gate_visitor_visits to anon"),
  "Never let anonymous tablets read the visitor register");
assert.match(sql,/create trigger khpos_gate_visitor_status_audit/,"Audits must be transactionally consistent");
assert.match(sql,/after insert or update of status/,"All visitor status changes are audited");

// Activation is one-use, time-limited, campus-scoped, and pairing occurs only
// from a verified school leadership account.
assert.match(service,/SCHOOL_CUSTODIAN/);
assert.match(service,/SCHOOL_GUARDIAN/);
assert.match(service,/SCHOOL_CARE_OPERATIONS_OFFICER/);
assert.match(service,/organisation_memberships/);
assert.match(service,/khpos_ops_role_assignments/);
assert.match(service,/allowedCampus\(scope,campusId\)/);
assert.match(service,/is\("redeemed_at",null\)/,"Pair codes must be redeemed once");
assert.match(service,/gt\("expires_at",now\)/,"Pairing codes must expire");
assert.match(service,/randomBytes\(32\)/,"Kiosk auth requires cryptographically random device secret");
assert.match(service,/digest\("kiosk:"\+raw\)/,"No raw device secret in database");
assert.match(service,/revoked_at/,"An authorised leader must be able to revoke a tablet");

// Kiosk cookie is isolated from school APIs, never accessible to JavaScript.
assert.match(api,/httpOnly:true/);
assert.match(api,/sameSite:"strict"/);
assert.match(api,/path:"\/api\/khpos\/visitor-kiosk"/);
assert.match(api,/origin!==request.nextUrl.origin/,"Reject cross-origin kiosk requests");
assert.match(api,/validKiosk/);
assert.match(api,/await kioskCheckIn\(token/);
assert.match(api,/await kioskCheckOut\(token/);
assert(!api.includes("gateDesk("),"Visitors must never retrieve the management register");
assert.match(deskApi,/verifyKhposAccessToken/,"Staff registration requires valid authentication");
assert.match(deskApi,/gateVisitAction/,"Only authenticated staff can approve admission");

// Visitor self-submission is NOT proof of entering campus.
assert.match(service,/status:"awaiting_admission"/);
assert.match(service,/\\.eq\\("status","on_campus"\\)/);
assert.match(service,/\\"status\\",expected/);
assert.match(service,/quota\(device.id,"check_in"/);
assert.match(service,/quota\(device.id,"check_out"/);
assert.match(sql,/constraint khpos_gate_visit_flow check/);
assert.match(sql,/visitor_name text not null/);
assert.match(sql,/phone text check \(phone is null/,"Phone collection must remain optional");

// Shared tablet cannot accidentally expose staff session or recent visit names.
assert.match(tablet,/staffSession===true/);
assert.match(tablet,/auth.signOut\(\)/);
assert.match(tablet,/autoComplete="off"/);
assert.match(tablet,/setReceipt\(null\)/);
assert.match(tablet,/30_000/,"Guest details and receipt must auto-clear from shared tablet");
assert(!tablet.includes("GateDeskData"),"Tablet must not embed the staff register");
assert.match(desk,/visitor_name/);
assert.match(desk,/Admit visitor/);
assert.match(desk,/Record departure/);
assert.match(desk,/Revoke device/);
assert.match(nav,/suffix: "\/visitors"/);
assert.match(nav,/operation\("\/visitors"\)/);

// Temporary outing reuses Leave & Cover approval, never creates a second
// staff availability authority or a fake end-of-day attendance check-out.
assert.match(availability,/temporary_outing/);
assert.match(availability,/KHPOS_TEMPORARY_OUTING/);
assert.match(availability,/caseType: caseType === "temporary_outing" \? "planned_leave"/);
assert.match(availabilityApi,/Temporary outings require a reason/);
assert.match(availabilityApi,/timeZone: "Africa\/Lagos"/);
assert(!service.includes("khpos_ops_staff_day_presence"),
  "Visitor operations must not modify staff school-day sign-ins");
console.log("KHP-OS visitor kiosk security, scoped admission, audit and temporary-outing contracts passed.");
