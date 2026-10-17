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
const act = async (actor, org, input) =>
  (
    await q("select khpos_learning_section_action_server($1,$2,$3) as id", [
      actor,
      org,
      input,
    ])
  )[0].id;
const feed = async (actor, org) =>
  (
    await q("select khpos_learning_sections_server($1,$2) as data", [
      actor,
      org,
    ])
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
    "update public.khpos_ops_units set unit_type='academic_section';",
  );
  await db.exec(
    "create table public.khpos_ops_academic_delivery_streams(id uuid primary key,organisation_id uuid,unit_id uuid,status text);",
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261017181306_school_learning_sections.sql",
      "utf8",
    ),
  );
  const input = {
    campusId: campus,
    name: "Preschool",
    stage: "preschool",
    status: "active",
  };
  await assert.rejects(act(teacher, school, input), /cannot manage/);
  await assert.rejects(act(promoter, school, input), /cannot manage/);
  await assert.rejects(
    act(guardian, school, { ...input, campusId: campus2 }),
    /cannot manage/,
  );
  await assert.rejects(act(owner, otherSchool, input), /membership/);
  const stages = [
    "preschool",
    "lower_primary",
    "upper_primary",
    "junior_secondary",
    "senior_secondary",
    "other",
  ];
  for (const stage of stages)
    await act(owner, school, {
      ...input,
      stage,
      name:
        stage === "other"
          ? "Creche / school-defined"
          : stage.replaceAll("_", " "),
    });
  let list = (await feed(teacher, school)).items;
  assert.equal(
    list.length,
    8,
    "six new sections plus original academic units from fixture",
  );
  assert.equal(list.filter((s) => s.stage !== "other").length, 5);
  assert.equal(
    list.every((s) => !s.canManage),
    true,
    "teachers can see section names but cannot configure them",
  );
  await assert.rejects(
    act(owner, school, { ...input, name: "PRESCHOOL" }),
    /already exists/,
  );
  const preschool = list.find((s) => s.stage === "preschool");
  const changes = {
    id: preschool.id,
    updatedAt: preschool.updatedAt,
    campusId: campus,
    name: "Early Years",
    stage: "preschool",
    status: "active",
    note: "Use the campus section name.",
  };
  await act(guardian, school, changes);
  await assert.rejects(act(guardian, school, changes), /changed/);
  const edited = (await feed(owner, school)).items.find(
    (s) => s.id === preschool.id,
  );
  assert.equal(edited.name, "Early Years");
  assert.equal(edited.id, preschool.id);
  await assert.rejects(
    act(owner, school, {
      ...changes,
      updatedAt: edited.updatedAt,
      campusId: campus2,
    }),
    /cannot move campus/,
  );
  await q("update khpos_ops_role_assignments set unit_id=$1 where user_id=$2", [
    preschool.id,
    teacher,
  ]);
  await assert.rejects(
    act(owner, school, {
      ...changes,
      updatedAt: edited.updatedAt,
      status: "inactive",
    }),
    /Reassign active/,
  );
  await q("update khpos_ops_role_assignments set unit_id=$1 where user_id=$2", [
    unit,
    teacher,
  ]);
  await q(
    "insert into khpos_ops_academic_delivery_streams values($1,$2,$3,'active')",
    [id(700), school, preschool.id],
  );
  await assert.rejects(
    act(owner, school, {
      ...changes,
      updatedAt: edited.updatedAt,
      status: "inactive",
    }),
    /Reassign active/,
  );
  await q(
    "update khpos_ops_academic_delivery_streams set status='closed' where id=$1",
    [id(700)],
  );
  await act(owner, school, {
    ...changes,
    updatedAt: edited.updatedAt,
    status: "inactive",
  });
  const disabled = (await feed(owner, school)).items.find(
    (s) => s.id === preschool.id,
  );
  assert.equal(disabled.status, "inactive");
  await act(owner, school, {
    ...changes,
    updatedAt: disabled.updatedAt,
    status: "active",
    note: "Restore early years section.",
  });
  assert.equal(
    (await feed(outsider, otherSchool)).items.length,
    0,
    "no independent-school section leakage",
  );
  assert.equal(
    (
      await q(
        "select has_function_privilege('authenticated','public.khpos_learning_section_action_server(uuid,uuid,jsonb)','execute') as allowed",
      )
    )[0].allowed,
    false,
  );
  assert.ok(
    (
      await q(
        "select count(*)::int as n from khpos_ops_audit_events where event_type='learning_section_saved'",
      )
    )[0].n >= 9,
  );
  console.log(
    "Learning sections: all stages/custom labels, scoped management, school isolation, duplicate prevention, stale writes, protected deactivation, restore/history and RPC isolation passed.",
  );
} finally {
  await db.close();
}
