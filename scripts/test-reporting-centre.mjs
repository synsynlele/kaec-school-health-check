import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(),
  id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [
  school,
  otherSchool,
  campus,
  campus2,
  otherCampus,
  unit,
  unit2,
  owner,
  guardian,
  promoter,
  teacher,
  peer,
  outsider,
  admin,
  ownerRole,
  guardRole,
  promoterRole,
  teacherRole,
] = Array.from({ length: 18 }, (_, i) => id(i + 1));
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const act = async (actor, org, mode, input) =>
  (
    await q("select khpos_report_action_server($1,$2,$3,$4) as id", [
      actor,
      org,
      mode,
      input,
    ])
  )[0].id;
const feed = async (actor, org, report = null, status = "", offset = 0) =>
  (
    await q(
      `select khpos_reports_workspace_server($1,$2,'',$3,$4,$5) as data`,
      [actor, org, status, offset, report],
    )
  )[0].data;
try {
  await db.exec(
    "create schema auth; create schema khpos_private; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key);",
  );
  await db.exec(
    fs.readFileSync("scripts/fixtures/staff-positions-schema.sql", "utf8"),
  );
  await db.exec(
    "create table public.khpos_platform_admins(user_id uuid,status text,platform_role text);",
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261016085446_staff_announcements.sql",
      "utf8",
    ),
  );
  for (const o of [school, otherSchool])
    await q(
      "insert into organisations(id,name,status,partner_status) values($1,$2,'active','active')",
      [o, o === school ? "School A" : "School B"],
    );
  for (const u of [owner, guardian, promoter, teacher, peer, outsider, admin]) {
    await q("insert into auth.users values($1)", [u]);
    if (u !== admin)
      await q(
        "insert into organisation_memberships(organisation_id,user_id,status) values($1,$2,'active')",
        [u === outsider ? otherSchool : school, u],
      );
  }
  await q(
    "insert into khpos_platform_admins values($1,'active','super_admin')",
    [admin],
  );
  for (const [c, o] of [
    [campus, school],
    [campus2, school],
    [otherCampus, otherSchool],
  ])
    await q(
      "insert into khpos_ops_campuses(id,organisation_id,name,status) values($1,$2,$3,'active')",
      [c, o, c],
    );
  for (const [u, c] of [
    [unit, campus],
    [unit2, campus],
  ])
    await q(
      "insert into khpos_ops_units(id,organisation_id,campus_id,name,status) values($1,$2,$3,$4,'active')",
      [u, school, c, u],
    );
  for (const [r, code] of [
    [ownerRole, "SCHOOL_CUSTODIAN"],
    [guardRole, "SCHOOL_GUARDIAN"],
    [promoterRole, "SECTIONAL_PROMOTER"],
    [teacherRole, "TEACHER"],
  ])
    await q(
      "insert into khpos_ops_roles(id,organisation_id,code,title,status) values($1,$2,$3,$3,'active')",
      [r, school, code],
    );
  await q(
    "insert into khpos_ops_roles(id,organisation_id,code,title,status) values($1,$2,'TEACHER','Teacher','active')",
    [id(50), otherSchool],
  );
  for (const [u, r, c, s] of [
    [owner, ownerRole, null, null],
    [guardian, guardRole, campus, null],
    [promoter, promoterRole, campus, unit],
    [teacher, teacherRole, campus, unit],
    [peer, teacherRole, campus, unit2],
    [outsider, id(50), otherCampus, null],
  ]) {
    await q(
      "insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,$4,$5,'active')",
      [id(100 + Number(u.slice(-3))), r, u, c, s],
    );
    if (u !== owner)
      await q(
        "insert into khpos_ops_staff(id,organisation_id,user_id,display_name,status,campus_id,unit_id) values($1,$2,$3,$4,'active',$5,$6)",
        [
          id(200 + Number(u.slice(-3))),
          u === outsider ? otherSchool : school,
          u,
          "Staff " + u.slice(-3),
          c,
          s,
        ],
      );
  }
  await db.exec(
    "create table khpos_ops_academic_terms(id uuid primary key,organisation_id uuid,campus_id uuid,start_date date,end_date date,status text);",
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261016155432_reporting_centre.sql",
      "utf8",
    ),
  );
  const date = (
    await q("select (now() at time zone 'Africa/Lagos')::date::text as d")
  )[0].d;
  const fields = [
    { key: "summary", label: "Summary", type: "textarea", required: true },
    { key: "number", label: "Count", type: "number", required: true },
    { key: "confirmed", label: "Confirmed", type: "boolean", required: true },
    {
      key: "choice",
      label: "Choice",
      type: "select",
      required: true,
      options: ["A", "B"],
    },
  ];
  const type = {
    title: "Daily teaching report",
    instructions: "Record results and next actions.",
    ownerRoleId: teacherRole,
    reviewerRoleId: guardRole,
    cadence: "daily",
    startDate: date,
    endDate: "",
    dueDays: 0,
    dueTime: "17:00",
    fields,
    campusId: campus,
    unitId: null,
    intervalDays: 14,
  };
  const answers = {
    summary: "Teaching delivered; next steps agreed.",
    number: 3,
    confirmed: false,
    choice: "A",
  };
  await assert.rejects(
    act(teacher, school, "type_save", type),
    /cannot manage/,
  );
  await assert.rejects(
    act(guardian, school, "type_save", { ...type, campusId: null }),
    /cannot manage/,
  );
  await assert.rejects(
    act(owner, otherSchool, "type_save", type),
    /membership/,
  );
  await assert.rejects(
    act(owner, school, "type_save", { ...type, campusId: otherCampus }),
    /campus/,
  );
  await assert.rejects(
    act(owner, school, "type_save", { ...type, reviewerRoleId: id(50) }),
    /active school roles/,
  );
  const typeId = await act(owner, school, "type_save", type);
  let w = await feed(teacher, school),
    report = w.items[0];
  assert.equal(w.items.length, 1);
  assert.equal(report.canEdit, true);
  assert.equal(report.canReview, false);
  assert.equal((await feed(outsider, otherSchool)).items.length, 0);
  assert.equal(
    (await feed(peer, school)).items.some((r) => r.id === report.id),
    false,
    "peers cannot read another staff report",
  );
  assert.equal(
    (await feed(owner, school)).items.length,
    0,
    "type management does not grant report content access",
  );
  assert.equal(
    (await feed(guardian, school)).items.length,
    2,
    "reviewer sees own scoped staff reports",
  );
  await feed(teacher, school);
  assert.equal(
    (await feed(teacher, school)).items.length,
    1,
    "sync is idempotent",
  );
  const action = async (actor, mode, payload = answers, note = "") => {
    const n = (await feed(actor, school, report.id)).items[0];
    return act(actor, school, mode, {
      id: report.id,
      lockVersion: n?.lock_version,
      payload,
      note,
    });
  };
  await action(teacher, "save", { summary: "Unfinished draft" });
  await assert.rejects(
    act(teacher, school, "save", {
      id: report.id,
      lockVersion: report.lock_version,
      payload: answers,
    }),
    /changed/,
  );
  await assert.rejects(
    action(teacher, "submit", { summary: "Missing required values" }),
    /required field/,
  );
  await assert.rejects(
    action(teacher, "submit", { ...answers, number: "three" }),
    /must be a number/,
  );
  await assert.rejects(
    action(teacher, "submit", { ...answers, choice: "C" }),
    /available option/,
  );
  await action(teacher, "submit");
  assert.equal((await feed(guardian, school, null, "review")).total, 1);
  await assert.rejects(action(teacher, "accept"), /designated reviewer/);
  await assert.rejects(action(teacher, "save"), /draft or returned/);
  await assert.rejects(
    action(teacher, "withdraw", answers, "I do not want to report."),
    /waived by/,
  );
  await assert.rejects(
    action(guardian, "return", answers, ""),
    /correction required/,
  );
  await action(guardian, "return", answers, "Please add next actions.");
  await action(teacher, "submit", {
    ...answers,
    summary: "Added detailed next actions.",
  });
  await action(guardian, "accept", answers, "Reviewed against evidence.");
  assert.equal((await feed(teacher, school, report.id)).items[0].revision, 2);
  assert.equal(
    (await feed(teacher, school, report.id)).history.filter(
      (h) => h.action === "submit",
    ).length,
    2,
  );
  await assert.rejects(
    action(teacher, "withdraw", answers, "Remove accepted record"),
    /waived by/,
  );
  await action(guardian, "return", answers, "One factual correction needed.");
  await action(teacher, "submit");
  await action(guardian, "accept");
  // Existing request schema and deadline survive type edits.
  const newFields = [
    ...fields,
    { key: "next", label: "Next steps", type: "textarea", required: true },
  ];
  await act(owner, school, "type_save", {
    ...type,
    id: typeId,
    version: 1,
    fields: newFields,
    dueDays: 2,
    note: "Add next steps for future reports.",
  });
  assert.equal(
    (await feed(teacher, school, report.id)).items[0].fields.length,
    4,
  );
  await assert.rejects(
    act(owner, school, "type_save", {
      ...type,
      id: typeId,
      version: 2,
      cadence: "weekly",
      note: "Change frequency.",
    }),
    /Create a new/,
  );
  await act(owner, school, "type_status", {
    id: typeId,
    version: 2,
    status: "paused",
    note: "Pause reporting over break.",
  });
  assert.equal(
    (await feed(teacher, school)).types.find((t) => t.id === typeId).status,
    "paused",
  );
  // One-off logs can repeat and drafts can be withdrawn without losing history.
  const logId = await act(owner, school, "type_save", {
    ...type,
    title: "Activity log",
    cadence: "one_off",
  });
  const assignment = id(100 + Number(teacher.slice(-3)));
  const logInput = {
    typeId: logId,
    assignmentId: assignment,
    periodStart: date,
    periodEnd: date,
  };
  const log1 = await act(teacher, school, "create", logInput),
    log2 = await act(teacher, school, "create", logInput);
  assert.notEqual(log1, log2);
  let log = (await feed(teacher, school, log1)).items[0];
  await act(teacher, school, "withdraw", {
    id: log1,
    lockVersion: log.lock_version,
    note: "Duplicate activity log.",
  });
  assert.equal(
    (await feed(teacher, school, log1)).items[0].status,
    "withdrawn",
  );
  // Scope changes immediately remove historical access.
  await q(
    "update khpos_ops_role_assignments set campus_id=$1 where user_id=$2",
    [campus2, guardian],
  );
  assert.equal((await feed(guardian, school)).items.length, 0);
  await q(
    "update khpos_ops_role_assignments set campus_id=$1 where user_id=$2",
    [campus, guardian],
  );
  await q("update khpos_ops_role_assignments set unit_id=$1 where user_id=$2", [
    unit2,
    teacher,
  ]);
  assert.equal((await feed(teacher, school, report.id)).total, 0);
  await q("update khpos_ops_role_assignments set unit_id=$1 where user_id=$2", [
    unit,
    teacher,
  ]);
  // Term periods are real academic dates, not four-month guesses.
  await q(
    "insert into khpos_ops_academic_terms values($1,$2,null,$3::date,$3::date+30,'active')",
    [id(500), school, date],
  );
  const termType = await act(owner, school, "type_save", {
    ...type,
    title: "Termly teaching report",
    cadence: "termly",
  });
  const termReport = (await feed(teacher, school)).items.find(
    (n) => n.type_id === termType,
  );
  assert.equal(termReport.period_start, date);
  assert.equal(termReport.occurrence_key, "term:" + id(500));
  assert.equal(
    (await feed(teacher, school)).items.filter((n) => n.type_id === termType)
      .length,
    1,
  );
  // Every configured cadence produces one current period request, including late joiners.
  for (const cadence of [
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
    "custom_days",
  ]) {
    const tid = await act(owner, school, "type_save", {
      ...type,
      title: cadence + " reporting",
      cadence,
    });
    assert.equal(
      (await feed(teacher, school)).items.filter((n) => n.type_id === tid)
        .length,
      1,
    );
  }
  await q(
    "update khpos_ops_role_assignments set status='inactive' where user_id=$1",
    [peer],
  );
  const lateType = await act(owner, school, "type_save", {
    ...type,
    title: "Late joining weekly report",
    cadence: "weekly",
  });
  await q(
    "update khpos_ops_role_assignments set status='active' where user_id=$1",
    [peer],
  );
  assert.equal(
    (await feed(peer, school)).items.filter((n) => n.type_id === lateType)
      .length,
    1,
  );
  // Pagination and filters operate on the complete authorised result set.
  for (let i = 0; i < 52; i++) await act(teacher, school, "create", logInput);
  const page1 = await feed(teacher, school),
    page2 = await feed(teacher, school, null, "", 50);
  assert.equal(page1.items.length, 50);
  assert.ok(page2.items.length > 0);
  assert.ok(!page1.items.some((n) => page2.items.some((m) => m.id === n.id)));
  const filtered = (
    await q(
      `select khpos_reports_workspace_server($1,$2,'','',0,null,$3,$4::date,$4::date) as data`,
      [teacher, school, logId, date],
    )
  )[0].data;
  assert.equal(filtered.total, 54);
  assert.equal(
    (await feed(owner, school)).types.find((t) => t.id === logId).stats.open,
    53,
  );
  // Same user holding two positions is still barred from self-review.
  await q(
    "insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,$4,null,'active')",
    [id(600), guardRole, teacher, campus],
  );
  const self = (await feed(teacher, school, log2)).items[0];
  assert.equal(self.canReview, false);
  await q(
    "update khpos_ops_role_assignments set status='inactive' where id=$1",
    [id(600)],
  );
  // Deactivating a reviewer is visible as a configuration gap, not a fallback to the founder.
  await q(
    "update khpos_ops_role_assignments set status='inactive' where user_id=$1",
    [guardian],
  );
  assert.equal(
    (await feed(teacher, school, log2)).items[0].reviewerAvailable,
    false,
  );
  await q(
    "update khpos_ops_role_assignments set status='active' where user_id=$1",
    [guardian],
  );
  // Compact feeds contain only counts/action references, never report answers.
  const attention = (
    await q("select khpos_report_attention_server($1,$2) as data", [
      teacher,
      school,
    ])
  )[0].data;
  assert.equal(
    attention.summary.open,
    (await feed(teacher, school)).summary.open,
  );
  assert.ok(
    attention.items.every(
      (n) => !("payload" in n) && !("fields" in n) && !("title" in n),
    ),
  );
  assert.equal(
    (
      await q(
        "select has_function_privilege('authenticated','public.khpos_report_attention_server(uuid,uuid)','execute') as allowed",
      )
    )[0].allowed,
    false,
  );
  // Resume skips paused periods while preserving the original weekly anchor.
  const anchor = (await q("select ($1::date-15)::text as d", [date]))[0].d;
  const anchored = await act(owner, school, "type_save", {
    ...type,
    title: "Anchored weekly report",
    cadence: "weekly",
    startDate: anchor,
  });
  await act(owner, school, "type_status", {
    id: anchored,
    version: 1,
    status: "paused",
    note: "Pause during a break.",
  });
  await act(owner, school, "type_status", {
    id: anchored,
    version: 2,
    status: "active",
    note: "Resume normal reporting.",
  });
  assert.equal(
    (
      await q(
        "select next_date::text as d from khpos_report_types where id=$1",
        [anchored],
      )
    )[0].d,
    (await q("select ($1::date-1)::text as d", [date]))[0].d,
  );
  // No direct anonymous/authenticated table access or impersonatable RPC access.
  for (const table of [
    "khpos_reports",
    "khpos_report_types",
    "khpos_report_events",
  ])
    assert.equal(
      (
        await q(
          `select has_table_privilege('authenticated','${table}','select') as allowed`,
        )
      )[0].allowed,
      false,
    );
  assert.equal(
    (
      await q(
        "select has_function_privilege('authenticated','public.khpos_report_action_server(uuid,uuid,text,jsonb)','execute') as allowed",
      )
    )[0].allowed,
    false,
  );
  await q(
    "update organisation_memberships set status='inactive' where user_id=$1",
    [teacher],
  );
  await assert.rejects(feed(teacher, school), /membership/);
  console.log(
    "Reporting centre: recurring and one-off periods, term dates, school/campus isolation, reviewer-only content, drafts, validation, concurrency, return/resubmit, history, waiver control and RPC isolation passed.",
  );
} finally {
  await db.close();
}
