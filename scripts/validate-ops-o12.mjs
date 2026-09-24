import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(
      "Operations O12 contract failed: " + context + " is missing " + expected,
    );
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/academic-delivery"', "school workspace navigation");
requireText(nav, 'label: "Academic Delivery"', "school workspace navigation");
requireText(nav, 'suffix: "/staff-transition"', "O11 navigation continuity");

const page = read("src/app/khpos/[organisationId]/academic-delivery/page.tsx");
requireText(page, "AcademicDeliveryWorkspace", "O12 route");
requireText(page, "UUID_RE", "O12 route validation");

const api = read("src/app/api/khpos/ops/academic-delivery/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsAcademicDelivery",
  "createKhposOpsAcademicTerm",
  "createKhposOpsAcademicStream",
  "updateKhposOpsAcademicStreamAssignment",
  "addKhposOpsAcademicTarget",
  "actOnKhposOpsAcademicTarget",
  "verifyKhposOpsAcademicTarget",
  "actOnKhposOpsAcademicDebt",
  "reassignKhposOpsAcademicDebt",
  "escalateKhposOpsAcademicDebt",
  "createKhposOpsAcademicObservation",
  "actOnKhposOpsAcademicObservation",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O12 academic-delivery API");
}

const service = read("src/lib/khpos/ops/academic-delivery.ts");
for (const expected of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "khpos_ops_get_academic_delivery_server",
  "khpos_ops_create_academic_term_server",
  "khpos_ops_academic_term_action_server",
  "khpos_ops_create_academic_stream_server",
  "khpos_ops_academic_stream_action_server",
  "khpos_ops_update_academic_stream_assignment_server",
  "khpos_ops_add_academic_target_server",
  "khpos_ops_academic_target_action_server",
  "khpos_ops_verify_academic_target_server",
  "khpos_ops_academic_debt_action_server",
  "khpos_ops_reassign_academic_debt_server",
  "khpos_ops_escalate_academic_debt_server",
  "khpos_ops_create_academic_observation_server",
  "khpos_ops_academic_observation_action_server",
]) {
  requireText(service, expected, "O12 academic-delivery service");
}

const workspace = read("src/components/khpos/ops/AcademicDeliveryWorkspace.tsx");
for (const expected of [
  "Operations · O12",
  "Academic Planning & Delivery",
  "Planned is not Delivered",
  "Delivered is not Verified",
  "Technology boundary",
  "KSI Learning Intelligence",
  "is not a teacher ranking",
  "automatic discipline",
  "Academic debt",
]) {
  requireText(workspace, expected, "O12 workspace");
}

const migrationPath =
  "supabase/migrations/20260924172000_khpos_ops_o12_academic_delivery.sql";
const migration = read(migrationPath).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_academic_terms",
  "create table if not exists public.khpos_ops_academic_delivery_streams",
  "create table if not exists public.khpos_ops_academic_weekly_targets",
  "create table if not exists public.khpos_ops_academic_debt",
  "create table if not exists public.khpos_ops_academic_observations",
  "create table if not exists public.khpos_ops_academic_events",
  "khpos_ops_get_academic_delivery_server",
  "khpos_ops_create_academic_term_server",
  "khpos_ops_create_academic_stream_server",
  "khpos_ops_update_academic_stream_assignment_server",
  "khpos_ops_add_academic_target_server",
  "khpos_ops_academic_target_action_server",
  "khpos_ops_verify_academic_target_server",
  "khpos_ops_academic_debt_action_server",
  "khpos_ops_reassign_academic_debt_server",
  "khpos_ops_escalate_academic_debt_server",
  "khpos_ops_create_academic_observation_server",
  "khpos_ops_academic_observation_action_server",
  "approve at least one curriculum delivery stream before activating the term",
  "add at least one approved-scheme weekly target before stream approval",
  "mark the target ready before starting delivery",
  "the delivering teacher cannot verify their own delivery",
  "the recovery owner cannot verify their own recovery evidence",
  "weekly target dates must fall within the academic term",
  "this delivery already has a verification decision",
  "academic recovery owner must be an active teacher assignment",
  "delivery_stream_assignment_updated",
  "academic_debt_owner_reassigned",
  "category,severity,sensitivity,title,description,status",
  "academic_execution",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O12 migration");
}

const seed = read("supabase/seeds/khpos_ops_o12_academic_delivery.sql").toLowerCase();
for (const expected of [
  "acd-p01",
  "acd-p03",
  "acd-001",
  "acd-002",
  "acd-003",
  "acd-004",
  "acd-005",
  "acd-006",
  "acd-007",
  "acd-008",
  "acd-009",
  "acd-t01",
  "acd-t02",
  "acd-t03",
  "acd-t04",
  "acd-t05",
  "planned is not delivered; delivered is not verified",
  "do not copy full ksi lesson content into khp-os",
  "do not rebuild the school timetable in khp-os",
  "academic debt closes only after recovery evidence",
  "never publish teacher rankings from observation records",
  "no hidden teacher ranking from observations",
  "ops_o12_academic_delivery_bootstrapped",
  "seededterms',0",
  "seededstreams',0",
  "seededtargets',0",
  "seededdebt',0",
]) {
  requireText(seed, expected, "KNS O12 policy/process/tool seed");
}

for (const path of [
  "supabase/migrations/20260924141440_khpos_ops_o7_people.sql",
  "supabase/migrations/20260924154826_khpos_ops_o10_accountability.sql",
  "supabase/migrations/20260924163528_khpos_ops_o11_progression_exit.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_academic_weekly_targets")) {
    throw new Error(
      "Operations O12 contract failed: historical migration " +
        path +
        " must remain independent from O12.",
    );
  }
}

console.log(
  "KHP-OS Operations O12 academic planning-delivery contracts validated.",
);
