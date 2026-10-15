import type { KhposPresenceWorkspace, KhposPresencePeriod } from "@/lib/khpos/ops/presence";

export type AttendanceStepKind = "school_in" | "school_out" | "class_in" | "class_out";
export type AttendanceStepStatus = "done" | "due" | "upcoming" | "blocked" | "missed";

export interface AttendanceStep {
  id: string;
  kind: AttendanceStepKind;
  title: string;
  instruction: string;
  actionLabel: string;
  status: AttendanceStepStatus;
  dueAt: string | null;
  recordedAt: string | null;
  periodId: string | null;
  classLabel: string | null;
  schedule: string | null;
  urgent: boolean;
}

const LAGOS = "Africa/Lagos";
const HALF_HOUR = 30 * 60_000;

export function lagosLocalDay(nowMs: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function schoolClockMs(localDay: string, clock: string): number {
  // Nigeria has a fixed UTC+01:00 offset; attendance timestamps are already
  // recorded in Africa/Lagos in the existing O74 database functions.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDay) || !/^\d{2}:\d{2}$/.test(clock)) return Number.NaN;
  return Date.parse(`${localDay}T${clock}:00+01:00`);
}

function isToday(localDay: string, weekday: number) {
  const utcDay = new Date(`${localDay}T12:00:00Z`).getUTCDay();
  return (utcDay === 0 ? 7 : utcDay) === weekday;
}

function stamp(nowMs: number, target: number): string {
  return Number.isFinite(target) ? new Date(target).toISOString() : new Date(nowMs).toISOString();
}

export function attendanceSteps(
  presence: KhposPresenceWorkspace,
  nowMs: number,
): AttendanceStep[] {
  if (!presence.pilotEnabled || !presence.staff ||
      !presence.localDay || lagosLocalDay(nowMs) !== presence.localDay) return [];

  const today = presence.localDay;
  const myPeriods = presence.periods
    .filter((period) => period.teacherUserId === presence.userId && period.termActive &&
      isToday(today, period.weekday))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const weekdays = new Date(`${today}T12:00:00Z`).getUTCDay();
  const schoolDay = weekdays >= 1 && weekdays <= 5 || myPeriods.length > 0;
  if (!schoolDay && !presence.todayPresence) return [];

  const at = (clock: string) => schoolClockMs(today, clock);
  const starts = myPeriods.map((p) => at(p.start)).filter(Number.isFinite);
  const ends = myPeriods.map((p) => at(p.end)).filter(Number.isFinite);
  const schoolStart = starts.length ? Math.min(...starts) - HALF_HOUR : at("08:00");
  const schoolEnd = Math.max(at("16:00"), ...(ends.length ? ends : [at("16:00")]));
  const arrival = presence.todayPresence;
  const checkedIn = Boolean(arrival?.in);
  const checkedOut = Boolean(arrival?.out);
  const ongoing = myPeriods.some((period) => period.session && !period.session.out);

  const result: AttendanceStep[] = [];
  result.push({
    id: `attendance:school-in:${today}`,
    kind: "school_in",
    title: "School check-in",
    instruction: checkedIn ? "Your arrival time has been saved." :
      "When you arrive at school, record your arrival. This does not mark a class as taught.",
    actionLabel: checkedIn ? "Arrival recorded" : "Record school arrival",
    status: checkedIn ? "done" : nowMs >= schoolStart ? "due" : "upcoming",
    dueAt: stamp(nowMs, schoolStart),
    recordedAt: arrival?.in ?? null,
    periodId: null, classLabel: null, schedule: null,
    urgent: !checkedIn && nowMs >= schoolStart + HALF_HOUR,
  });

  for (const period of myPeriods) {
    const label = `${period.subject} · ${period.class}`;
    const start = at(period.start), end = at(period.end);
    const session = period.session;
    const checkedClassIn = Boolean(session?.in);
    const checkedClassOut = Boolean(session?.out);
    let inStatus: AttendanceStepStatus;
    if (checkedClassIn) inStatus = "done";
    else if (nowMs > end + HALF_HOUR) inStatus = "missed";
    else if (nowMs < start - HALF_HOUR) inStatus = "upcoming";
    else if (checkedOut || !checkedIn) inStatus = "blocked";
    else inStatus = "due";
    result.push({
      id: `attendance:class-in:${today}:${period.id}`,
      kind: "class_in",
      title: `Class check-in · ${label}`,
      instruction: checkedClassIn ? "The time you started this class is saved." :
        inStatus === "missed" ? "The class check-in time has passed. Tell your School Guardian." :
        inStatus === "blocked" ? "Record your school arrival before starting this class." :
        "When you begin this scheduled class, record the actual starting time.",
      actionLabel: checkedClassIn ? "Class start recorded" : "Start this class",
      status: inStatus, dueAt: stamp(nowMs, start - HALF_HOUR),
      recordedAt: session?.in ?? null, periodId: period.id,
      classLabel: label, schedule: `${period.start}–${period.end}`,
      urgent: inStatus === "due" && nowMs > start + 10 * 60_000,
    });

    let outStatus: AttendanceStepStatus;
    if (checkedClassOut) outStatus = "done";
    else if (!checkedClassIn) outStatus = "blocked";
    else if (nowMs >= end) outStatus = "due";
    else outStatus = "upcoming";
    result.push({
      id: `attendance:class-out:${today}:${period.id}`,
      kind: "class_out",
      title: `Class check-out · ${label}`,
      instruction: checkedClassOut ? "The class finish time and lesson outcome are saved." :
        !checkedClassIn ? "Record the class start before you can finish the class." :
        "When the class ends, record your finish time, what you taught and the lesson outcome.",
      actionLabel: checkedClassOut ? "Class finish recorded" : "Finish class and record lesson",
      status: outStatus, dueAt: stamp(nowMs, end),
      recordedAt: session?.out ?? null, periodId: period.id,
      classLabel: label, schedule: `${period.start}–${period.end}`,
      urgent: outStatus === "due" && nowMs > end + 10 * 60_000,
    });
  }

  const schoolOutStatus: AttendanceStepStatus = checkedOut ? "done" :
    !checkedIn || ongoing ? "blocked" : nowMs >= schoolEnd ? "due" : "upcoming";
  result.push({
    id: `attendance:school-out:${today}`,
    kind: "school_out", title: "School check-out",
    instruction: checkedOut ? "Your departure time has been saved." :
      ongoing ? "Finish the class that is still in progress before leaving school." :
      !checkedIn ? "Record your school arrival first." :
      "Before you leave school, record your departure. Finish any open class first.",
    actionLabel: checkedOut ? "Departure recorded" : "Record school departure",
    status: schoolOutStatus, dueAt: stamp(nowMs, schoolEnd),
    recordedAt: arrival?.out ?? null, periodId: null, classLabel: null, schedule: null,
    urgent: schoolOutStatus === "due" && nowMs > schoolEnd + HALF_HOUR,
  });
  return result;
}

export function dueAttendanceSteps(steps: AttendanceStep[]) {
  return steps.filter((step) => step.status === "due");
}
