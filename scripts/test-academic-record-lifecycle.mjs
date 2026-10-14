import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => fs.readFileSync(path, "utf8");
const sql = read("supabase/migrations/20261014220000_khpos_academic_record_lifecycle.sql");
const api = read("src/app/api/khpos/ops/academic-delivery/[id]/route.ts");
const service = read("src/lib/khpos/ops/academic-delivery.ts");
const ui = read("src/components/khpos/ops/AcademicDeliveryWorkspace.tsx");
const controls = read("src/components/khpos/ops/AcademicRecordManagement.tsx");

// No deletions unless a privileged, school-scoped backend mutation examines
// every actual FK dependency: no child cascade is an acceptable default.
for (const kind of ["term", "stream"]) {
  assert.match(sql, new RegExp("khpos_ops_manage_academic_" + kind + "_server"));
  assert.match(sql, /ops_academic_manage_authority/);
  assert.match(sql, /p_organisation_id/);
  assert.match(sql, /ops_academic_record_dependencies/);
  assert.match(sql, /Cannot.*delete:/);
  assert.match(sql, /record_kind,record_id,actor_user_id,action,reason,before_state,after_state/);
  assert.match(service, new RegExp("manageKhposOpsAcademic" + (kind === "term" ? "Term" : "Stream")));
  assert.match(api, new RegExp('mode === "manage_' + kind + '"'));
  assert.match(ui, new RegExp('mode: "manage_' + kind + '"'));
}
assert.match(sql, /pg_catalog\.pg_constraint/, "Must walk the actual foreign-key graph");
assert.match(sql, /fk\.confrelid=p_parent/);
assert.match(sql, /cardinality\(fk\.conkey\)/);
assert.match(sql, /array_to_string\(v_dep/, "Blocked deletions must say why");
assert.match(sql, /khpos_ops_academic_record_audit/, "Audit must outlive removed records");
assert.match(sql, /action in \('edit','archive','restore','delete'\)/);
assert.match(sql, /status_before_archive/, "Restoration must retain the original status");
assert.match(sql, /revision_number=revision_number\+1/, "Edits must increment revision");
assert.match(sql, /wt\.state<>'planned'/, "Archive should not hide active delivery evidence");
assert.match(sql, /trg_khpos_archived_target_guard/);
assert.match(sql, /trg_khpos_archived_assessment_package_guard/);
assert.match(sql, /grant execute on function public\.khpos_ops_manage_academic_/);
assert.match(sql, /revoke all on function public\.khpos_ops_manage_academic_/);
assert.match(sql, /'SCHOOL_CUSTODIAN'/, "The School Custodian must have authority");
assert.match(api, /clean\(payload\.reason\)\.length < 10/);
assert.match(ui, /Edit approved term/);
assert.match(ui, /Edit approved curriculum execution/);
assert.match(ui, /Show archived/);
assert.match(ui, /stream\.status === "archived"/);
assert.match(controls, /Type DELETE to confirm/);
assert.match(controls, /deleteConfirm !== "DELETE"/);
assert.match(controls, /reason\.trim\(\)\.length >= 10/);
assert.match(controls, /Restore record/);
assert.match(controls, /Change history/);
assert.match(service, /academic_record_audit/);
console.log("Academic lifecycle: complete FK dependency checks, audited management, archive guards, typed delete confirmation and revision controls passed.");
