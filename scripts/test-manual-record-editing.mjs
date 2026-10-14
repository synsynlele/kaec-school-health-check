import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const sql = read("supabase/migrations/20261014191500_khpos_edit_academic_drafts.sql");
const api = read("src/app/api/khpos/ops/academic-delivery/[id]/route.ts");
const service = read("src/lib/khpos/ops/academic-delivery.ts");
const academic = read("src/components/khpos/ops/AcademicDeliveryWorkspace.tsx");
const library = read("src/components/khpos/ops/InstitutionalLibrary.tsx");
const policy = read("src/components/khpos/ops/PolicyGovernance.tsx");
const process = read("src/components/khpos/ops/ProcessGovernance.tsx");

// All mutations use authenticated server routes and independently checked,
// school-scoped, privileged database functions.
for (const name of ["term", "stream"]) {
  assert.match(sql, new RegExp("khpos_ops_update_academic_draft_" + name + "_server"));
  assert.match(sql, /ops_academic_has_membership/);
  assert.match(sql, /ops_academic_can_plan/);
  assert.match(sql, /status<>'draft'/);
  assert.match(sql, /insert into public\.khpos_ops_academic_events/);
  assert.match(sql, /grant execute on function public\.khpos_ops_update_academic_draft_/);
  assert.match(api, new RegExp('mode === "update_' + name + '"'));
  assert.match(service, new RegExp("updateKhposOpsAcademicDraft" + (name === "term" ? "Term" : "Stream")));
}
assert.match(sql, /week_number>v_weeks/, "Saving must not invalidate existing weekly targets");
assert.match(sql, /existing weekly targets/, "Explain the blocked reduction");
assert.match(sql, /before',v_before,'after'/, "Term and stream changes must record before/after");
assert.match(sql, /from public,anon,authenticated/, "Only the server role may invoke edits");

// The teacher and school leaders must see an actual Edit action which reuses
// the existing record instead of creating a duplicate.
assert.match(academic, /mode: editingTermId \? "update_term" : "create_term"/);
assert.match(academic, /mode: editingStreamId \? "update_stream" : "create_stream"/);
assert.match(academic, /Save term changes/);
assert.match(academic, /Save teaching stream changes/);
assert.match(academic, /Edit teaching stream draft/);
assert.match(academic, /term\.status === "draft"/);
assert.match(academic, /stream\.status === "draft"/);

// Approved content must go through the versioned policy/process governance
// engine rather than direct mutation of the published document.
assert.match(library, /initialEditId=\{initialEditId\}/);
assert.match(library, /Edit \/ create approved revision/);
assert.match(library, /Edit \/ complete draft/);
assert.match(policy, /initialEditId/);
assert.match(process, /initialEditId/);
assert.match(policy, /current\.author_id === userId/);
assert.match(process, /current\.author_id === userId/);
assert.match(policy, /Approve and publish/);
assert.match(process, /Approve and publish/);
console.log("Manual editing: school isolation, draft-only mutations, audit trail, direct edit entry and published revision safeguards passed.");
