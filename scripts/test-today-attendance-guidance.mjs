import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Run the production pure TypeScript decision logic, not a duplicated test implementation.
const source = fs.readFileSync("src/lib/khpos/ops/attendance-guidance.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = await import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));
const { attendanceSteps, dueAttendanceSteps, lagosLocalDay, calendarPauses, calendarPauseForDay, nextRegularLessonDay, missedClassCheckouts } = mod;
const now = (time) => Date.parse("2026-10-15T" + time + ":00+01:00");
const period = {
  id:"00000000-0000-0000-0000-000000000021", streamId:"stream",
  weekday:4, start:"08:00", end:"09:00", room:"Room 1", campusId:"campus",
  class:"JSS 1", subject:"Mathematics", teacher:"Teacher One",
  teacherUserId:"teacher1", termActive:true, session:null,
};
const base = {
  localDay:"2026-10-15", userId:"teacher1", canManage:false,
  canEnablePilot:false, pilotEnabled:true, canEnableHqls:false, hqlsEnabled:false,
  staff:{ id:"staff1", name:"Teacher One", campusId:"campus" },
  campuses:[{id:"campus",name:"Igando"}], todayPresence:null, periods:[period],
  observations:[], teamPresence:[], openClassSessions:[], openSchoolAttendance:[],
};
const result = (snapshot, ms) => attendanceSteps(snapshot, ms);
const find = (steps,kind) => steps.find(x => x.kind===kind);
assert.equal(lagosLocalDay(now("07:40")), "2026-10-15");
assert.equal(lagosLocalDay(Date.parse("2026-10-14T23:30:00Z")), "2026-10-15");
assert.deepEqual(result({...base,pilotEnabled:false},now("08:00")),[]);
assert.deepEqual(result({...base,staff:null},now("08:00")),[]);
assert.deepEqual(result({...base,localDay:"2026-10-14"},now("08:00")),[]);
let x=result(base,now("07:00"));
assert.equal(find(x,"school_in").status,"upcoming");
assert.equal(find(x,"class_in").status,"upcoming");
x=result(base,now("07:50"));
assert.equal(find(x,"school_in").status,"due");
assert.equal(find(x,"class_in").status,"blocked");
assert.deepEqual(dueAttendanceSteps(x).map(y=>y.kind),["school_in"]);
const arrival={id:"arrival",campusId:"campus",in:new Date(now("07:40")).toISOString(),out:null,administrativelyClosed:false};
x=result({...base,todayPresence:arrival},now("07:50"));
assert.equal(find(x,"school_in").status,"done");
assert.equal(find(x,"class_in").status,"due");
assert.equal(find(x,"class_out").status,"blocked");
assert.equal(dueAttendanceSteps(x).length,1);
assert.match(find(x,"class_in").id,/attendance:class-in:2026-10-15:/);
x=result({...base,todayPresence:arrival},now("09:31"));
assert.equal(find(x,"class_in").status,"missed");
assert.equal(dueAttendanceSteps(x).filter(y=>y.kind==="class_in").length,0);
const session={id:"lesson",in:new Date(now("07:58")).toISOString(),out:null,outcome:null,topic:null,administrativelyClosed:false};
x=result({...base,todayPresence:arrival,periods:[{...period,session}]},now("09:15"));
assert.equal(find(x,"class_in").status,"done");
assert.equal(find(x,"class_out").status,"due");
assert.equal(find(x,"class_out").urgent,false);
assert.equal(dueAttendanceSteps(x).some(step => step.kind === "class_out"), false);
const nextPeriod = { ...period, id: "next-lesson", start: "09:30", end: "10:30" };
x=result({...base,todayPresence:arrival,periods:[{...period,session},nextPeriod]},now("09:30"));
assert.equal(find(x,"class_out").urgent,true);
assert.equal(dueAttendanceSteps(x).some(step => step.kind === "class_out"), true);
const nextStart = x.find(step => step.kind === "class_in" && step.periodId === nextPeriod.id);
assert.equal(nextStart.status, "blocked");
assert.equal(nextStart.previousClass.id, period.id);
assert.equal(find(x,"school_out").previousClass.id, period.id);
assert.deepEqual(missedClassCheckouts({
  ...base, openClassSessions: [{ date: "2026-10-14" }, { date: base.localDay }],
}), [{ date: "2026-10-14" }]);
assert.equal(find(x,"school_out").status,"blocked");
const complete={...session,out:new Date(now("09:20")).toISOString(),outcome:"completed",topic:"Fractions"};
x=result({...base,todayPresence:arrival,periods:[{...period,session:complete}]},now("16:40"));
assert.equal(find(x,"class_out").status,"done");
assert.equal(find(x,"school_out").status,"due");
assert.equal(dueAttendanceSteps(x).length,1);
const departed={...arrival,out:new Date(now("16:45")).toISOString()};
x=result({...base,todayPresence:departed,periods:[{...period,session:complete}]},now("16:50"));
assert.equal(dueAttendanceSteps(x).length,0);
assert.equal(x.filter(t=>t.status==="done").length,4);
const leaders=result({...base,periods:[{...period,teacherUserId:"another-teacher"}]},now("08:10"));
assert.equal(leaders.filter(t=>t.kind.startsWith("class")).length,0);
assert.equal(find(leaders,"school_in").status,"ready");
assert.equal(find(leaders,"school_in").dueAt,null);
assert.deepEqual(dueAttendanceSteps(leaders),[], "Do not push school arrival reminders without a known timetable");
const otherDay=result({...base,localDay:"2026-10-14"},now("07:50"));
assert.equal(otherDay.length,0);
const night=result({...base,localDay:"2026-10-16"},Date.parse("2026-10-15T23:30:00Z"));
assert.equal(night.filter(t=>t.kind.startsWith("class")).length,0);
const todayUI=fs.readFileSync("src/components/khpos/ops/TodayAttendanceCard.tsx","utf8");
const attendanceUI=fs.readFileSync("src/components/khpos/ops/TeacherPresenceWorkspace.tsx","utf8");
const today=fs.readFileSync("src/components/khpos/ops/MyWorkWorkspace.tsx","utf8");
const notifications=fs.readFileSync("src/lib/khpos/notifications.ts","utf8");
const schedule=fs.readFileSync("supabase/migrations/20261015083000_khpos_attendance_reminder_schedule.sql","utf8");
for(const text of ["School check-in","School check-out","Class check-in","Class check-out","Recorded:","School date:","school owner","Enable device alerts"]) {
  assert.ok((todayUI + source).includes(text),"Today missing clear instruction: "+text);
}
assert.match(today,/TodayAttendanceCard organisationId=/);
assert.match(todayUI,/mode: kind/);
assert.match(todayUI,/announceKhposActivityChanged/);
assert.match(attendanceUI,/id=\{"class-" \+ p\.id\}/);
assert.match(attendanceUI,/new URLSearchParams\(window\.location\.search\)/);
assert.match(attendanceUI,/announceKhposActivityChanged/);
assert.match(notifications,/getPresenceWorkspace/);
assert.match(notifications,/dueAttendanceSteps/);
assert.match(notifications,/catch\(\(\) => \[\] as KhposAlert\[\]\)/);
assert.match(schedule,/cron\.alter_job/);
assert.match(schedule,/\*\/30 5-16 \* \* 1-6/);
assert.doesNotMatch(schedule,/cron\.unschedule|drop table|delete from/i);
// Sunday after a published Friday-ending midterm is NOT another midterm day.
// The weekly timetable may still display occurrences from the preceding week,
// so the UI must identify them as historical and show next regular slots.
const november={
  ...base,
  localDay:"2026-11-08",
  calendarClosures:[{
    campus_id:null,kind:"closure",title:"Mid-Term Break",
    start_day:"2026-11-01",end_day:"2026-11-06",
  }],
};
assert.equal(calendarPauseForDay(november,"campus","2026-11-02",true)?.title,"Mid-Term Break");
assert.equal(calendarPauses(november,"campus","2026-11-06",true),true);
assert.equal(calendarPauses(november,"campus","2026-11-08",true),false);
assert.equal(calendarPauses(november,"campus","2026-11-09",true),false);
assert.equal(nextRegularLessonDay("2026-11-08",1),"2026-11-09");
assert.equal(nextRegularLessonDay("2026-11-08",5),"2026-11-13");
assert.equal(nextRegularLessonDay("2026-11-09",1),"2026-11-16");
assert.equal(nextRegularLessonDay("2026-11-08",8),null);
assert.equal(nextRegularLessonDay("not-a-day",1),null);
assert.equal(calendarPauseForDay({...november,calendarClosures:[
  {campus_id:"other",kind:"no_lessons",title:"Other campus",start_day:"2026-11-08",end_day:"2026-11-09"}]},
  "campus","2026-11-09",true),null);
const presenceSource=fs.readFileSync("src/lib/khpos/ops/presence.ts","utf8");
assert.match(presenceSource,/select\("campus_id,kind,title,start_day,end_day"\)/);
assert.match(attendanceUI,/Showing attendance status for/);
assert.match(attendanceUI,/The break has ended\. Next regular class slot/);
assert.match(attendanceUI,/breakEnded/);
assert.match(attendanceUI,/nextRegularLessonDay\(data\.localDay,p\.weekday\)/);

console.log("Today attendance and reminders: scheduled windows, duplicate/completed suppression, assigned-teacher privacy, Lagos date boundary, correct action links, and conservative scheduler verified.");
