import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => fs.readFileSync(path, "utf8");
const sql = read("supabase/migrations/20261014220000_khpos_academic_record_lifecycle.sql");
const api = read("src/app/api/khpos/ops/academic-delivery/[id]/route.ts");
const service = read("src/lib/khpos/ops/academic-delivery.ts");
const ui = read("src/components/khpos/ops/AcademicDeliveryWorkspace.tsx");
const controls = read("src/components/khpos/ops/AcademicRecordManagement.tsx");

// The migration is additive. Archive/remove keeps the original school records
// and related evidence; permanent deletion is deliberately NOT supported.
assert.doesNotMatch(sql, /\bdrop\s+(?:table|constraint|trigger)\b/i);
assert.doesNotMatch(sql, /\bdelete\s+from\s+public\./i);
assert.match(sql, /add column if not exists archived_at/);
assert.match(sql, /add column if not exists removed_at/);
assert.match(sql, /status='cancelled'/, "Archived and removed rows must use a valid existing legacy status");
assert.doesNotMatch(sql, /status='archived'/, "Do not use a status not allowed by existing DB CHECK constraints");
for (const kind of ["term", "stream"]) {
  assert.match(sql, new RegExp("khpos_ops_manage_academic_" + kind + "_server"));
  assert.match(sql, /ops_academic_manage_authority/);
  assert.match(sql, /p_organisation_id/);
  assert.match(sql, /record_kind,record_id,actor_user_id,action,reason,before_state,after_state/);
  assert.match(service, new RegExp("manageKhposOpsAcademic" + (kind === "term" ? "Term" : "Stream")));
  assert.match(api, new RegExp('mode === "manage_' + kind + '"'));
  assert.match(ui, new RegExp('mode: "manage_' + kind + '"'));
}
assert.match(sql, /khpos_ops_academic_record_audit/, "Audit must retain original revisions and reason");
assert.match(sql, /action in \('edit','archive','restore','remove'\)/);
assert.match(sql, /status_before_archive/, "Restoration must retain the original status");
assert.match(sql, /revision_number=revision_number\+1/, "Edits must increment revision");
assert.match(sql, /wt\.state<>'planned'/, "An existing target outside the academic term is not overwritten");
assert.match(sql, /'SCHOOL_CUSTODIAN'/, "School Custodian must have authority");
assert.match(api, /clean\(payload\.reason\)\.length < 10/);
assert.match(ui, /Edit approved term/);
assert.match(ui, /Edit approved curriculum execution/);
assert.match(ui, /Show archived and removed/);
assert.match(ui, /\["archived", "removed"\]\.includes\(stream\.status\)/);
assert.match(controls, /Type REMOVE to confirm/);
assert.match(controls, /removeConfirm !== "REMOVE"/);
assert.match(controls, /reason\.trim\(\)\.length >= 10/);
assert.match(controls, /Restore record/);
assert.match(controls, /Removal is reversible, not permanent deletion/);
assert.match(controls, /Change history/);
assert.match(service, /removed_at/);
assert.match(service, /academic_record_audit/);
console.log("Academic lifecycle: non-destructive schema, audited editing, reversible archiving/removal, typed confirmation, permissions and status compatibility passed.");
