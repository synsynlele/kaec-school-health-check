import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/lib/khpos/ops/attention-rules.ts", "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(transpiled, { exports });
const { needsOwnerWorkAction, issueAttentionAction, decisionAttentionActions } = exports;

for (const status of ["pending", "in_progress", "blocked"]) {
  assert.equal(needsOwnerWorkAction(status), true, status);
}
for (const status of ["awaiting_verification", "completed", "cancelled"]) {
  assert.equal(needsOwnerWorkAction(status), false, status);
}

const basic = {
  status: "in_action",
  severity: "P2",
  isOwner: true,
  isReporter: false,
  isDirectManager: false,
  isEscalationRecipient: false,
};
assert.equal(issueAttentionAction(basic, false), "act");
assert.equal(issueAttentionAction({ ...basic, status: "resolved" }, true), null);
assert.equal(issueAttentionAction({ ...basic, status: "verified" }, false), null);
assert.equal(issueAttentionAction({ ...basic, status: "closed" }, false), null);
assert.equal(issueAttentionAction({ ...basic, status: "resolved", isReporter: true }, false), null, "owner cannot self-verify");
assert.equal(issueAttentionAction({ ...basic, status: "resolved", isOwner: false, isReporter: true }, false), "verify");
assert.equal(issueAttentionAction({ ...basic, status: "resolved", isOwner: false, isEscalationRecipient: true }, false), "verify");
assert.equal(issueAttentionAction({ ...basic, status: "verified", isOwner: false, isReporter: true }, false), "close");
assert.equal(issueAttentionAction({ ...basic, status: "assigned", isOwner: false, isReporter: true }, false), null, "reporter should not chase another owner's assigned work");
assert.equal(issueAttentionAction({ ...basic, status: "open", isOwner: false, isReporter: true }, false), "act");
assert.equal(issueAttentionAction({ ...basic, status: "in_action", isOwner: false, isDirectManager: true }, false), null);
assert.equal(issueAttentionAction({ ...basic, status: "in_action", isOwner: false, isDirectManager: true, severity: "P1" }, false), "act");
assert.equal(issueAttentionAction({ ...basic, status: "in_action", isOwner: false, isDirectManager: true }, true), "act");
assert.equal(issueAttentionAction({ ...basic, status: "resolved", isOwner: false }, false), null, "P1 alone grants no review authority");

const pending = { status: "submitted", isAuthority: true, isRequester: false, isImplementationOwner: false, actionRequired: false };
assert.equal(decisionAttentionActions(pending).approval, true);
assert.equal(decisionAttentionActions({ ...pending, isRequester: true }).approval, false, "no self-approval notification");
assert.equal(decisionAttentionActions({ ...pending, status: "approved" }).approval, false);
assert.equal(decisionAttentionActions({ ...pending, status: "returned" }).approval, false);
assert.equal(decisionAttentionActions({ ...pending, status: "approved", isImplementationOwner: true, actionRequired: true }).implementation, true);
assert.equal(decisionAttentionActions({ ...pending, status: "implemented", isImplementationOwner: true, actionRequired: true }).implementation, false);

const attention = fs.readFileSync("src/lib/khpos/ops/attention.ts", "utf8");
assert.match(attention, /needsOwnerWorkAction\(item\.status\)/);
assert.match(attention, /issueAttentionAction\(issue, due\.overdue\)/);
assert.match(attention, /decisionAttentionActions\(decision\)/);
const bell = fs.readFileSync("src/components/khpos/NotificationBell.tsx", "utf8");
assert.match(bell, /KHPOS_ACTIVITY_CHANGED/);
assert.match(bell, /refresh\(true\)/);
for (const screen of ["MyWorkWorkspace", "IssuesWorkspace", "DecisionsWorkspace"]) {
  const content = fs.readFileSync(`src/components/khpos/ops/${screen}.tsx`, "utf8");
  assert.match(content, /announceKhposActivityChanged\(organisationId\)/, screen);
}
console.log("KHP-OS attention lifecycle: state transitions, reviewer boundaries and notification refresh contracts passed.");
