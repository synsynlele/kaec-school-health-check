import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

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

assert.equal(
  issueAttentionAction({ ...basic, status: "resolved", isOwner: false, isGuardianReviewer: true }, false),
  "verify",
  "independent school Guardian can verify a Custodian issue",
);
assert.equal(
  issueAttentionAction({ ...basic, status: "verified", isOwner: false, isGuardianReviewer: true }, false),
  "close",
);
assert.equal(
  issueAttentionAction({ ...basic, status: "resolved", isOwner: true, isGuardianReviewer: true }, false),
  null,
  "a second title never authorises self-verification",
);

// Exercise the exact new migration's privileged reviewer predicate in isolated PG.
const migration = fs.readFileSync(
  "supabase/migrations/20261012190000_independent_issue_review.sql",
  "utf8",
);
assert.match(migration, /revoke all on function khpos_private\.ops_issue_can_independent_guardian/);
assert.match(migration, /'isGuardianReviewer',v\.is_guardian_reviewer/);
assert.match(migration, /v_is_guardian_reviewer/);
const helperSQL = migration.match(/create or replace function khpos_private\.ops_issue_can_independent_guardian[\s\S]*?\$check\$;/i)?.[0];
assert.ok(helperSQL, "reviewer function must exist in migration");

const db = new PGlite();
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const org=id(1), otherOrg=id(2), campus=id(3), otherCampus=id(4);
const custodian=id(10), independent=id(11), outside=id(12);
const custRole=id(20), guardianRole=id(21), wrongGuardianRole=id(22);
const custAssignment=id(30), guardAssignment=id(31), outsideAssignment=id(32);
const issueId=id(40);
await db.exec(`
  create schema khpos_private;
  create schema auth;
  create role anon; create role authenticated; create role service_role;
  create table public.organisation_memberships (
    organisation_id uuid, user_id uuid, status text
  );
  create table public.khpos_ops_roles (
    id uuid primary key, organisation_id uuid, code text, status text
  );
  create table public.khpos_ops_role_assignments (
    id uuid primary key, role_id uuid, user_id uuid, status text,
    campus_id uuid, unit_id uuid
  );
  create table public.khpos_ops_issues (
    id uuid primary key, organisation_id uuid, owner_assignment_id uuid,
    sensitivity text, status text, campus_id uuid, unit_id uuid
  );
  create function khpos_private.ops_hpd_has_membership(p_actor uuid,p_org uuid)
  returns boolean language sql stable as $q$
    select exists(select 1 from public.organisation_memberships
      where user_id=p_actor and organisation_id=p_org and status='active');
  $q$;
`);
await db.exec(helperSQL);
// Compile both complete replaced RPCs; catch missing SQL terminators before production.
const serverFunctions = [
  ...migration.matchAll(/CREATE OR REPLACE FUNCTION public\.khpos_ops_(?:get_issues_server|issue_action_server)[\s\S]*?\$function\$;/g),
].map((match) => match[0]);
assert.equal(serverFunctions.length, 2, "both issue RPCs must end with valid SQL terminators");
for (const definition of serverFunctions) await db.exec(definition);
const query=async (actor)=> (await db.query(
  "select khpos_private.ops_issue_can_independent_guardian($1,$2,$3) allowed",
  [actor,org,issueId],
)).rows[0].allowed;
await db.query("insert into public.organisation_memberships values($1,$2,'active'),($1,$3,'active'),($4,$5,'active')",
  [org,custodian,independent,otherOrg,outside]);
await db.query("insert into public.khpos_ops_roles values($1,$2,'SCHOOL_CUSTODIAN','active'),($3,$2,'SCHOOL_GUARDIAN','active'),($4,$5,'SCHOOL_GUARDIAN','active')",
  [custRole,org,guardianRole,wrongGuardianRole,otherOrg]);
await db.query("insert into public.khpos_ops_role_assignments values($1,$2,$3,'active',null,null),($4,$5,$6,'active',$7,null),($8,$9,$10,'active',null,null)",
  [custAssignment,custRole,custodian,guardAssignment,guardianRole,independent,campus,outsideAssignment,wrongGuardianRole,outside]);
await db.query("insert into public.khpos_ops_issues values($1,$2,$3,'standard','resolved',$4,null)",
  [issueId,org,custAssignment,campus]);
assert.equal(await query(independent), true, "same school/campus active independent Guardian");
assert.equal(await query(custodian), false, "Custodian cannot verify own resolution");
await db.query(
  "insert into public.khpos_ops_role_assignments values($1,$2,$3,'active',null,null)",
  [id(33),guardianRole,custodian],
);
assert.equal(await query(custodian), false, "same person with Guardian and Custodian titles cannot verify own issue");
assert.equal(await query(outside), false, "other school cannot verify");
await db.query("update public.khpos_ops_issues set campus_id=$1 where id=$2",[otherCampus,issueId]);
assert.equal(await query(independent), false, "campus-restricted Guardian cannot review other campus");
await db.query("update public.khpos_ops_issues set campus_id=$1,status='open' where id=$2",[campus,issueId]);
assert.equal(await query(independent), false, "no authority over unfinished issue");
await db.query("update public.khpos_ops_issues set status='verified' where id=$1",[issueId]);
assert.equal(await query(independent), true, "same independent reviewer can close after verification");
await db.query("update public.organisation_memberships set status='inactive' where user_id=$1",[independent]);
assert.equal(await query(independent), false, "revoked membership cannot review");
await db.close();

console.log("KHP-OS attention lifecycle: state transitions, reviewer boundaries and notification refresh contracts passed.");
