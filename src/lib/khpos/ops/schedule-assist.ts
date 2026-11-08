/**
 * Schedule + coverage assistant. Computes only explainable exceptions from
 * already-visible authorised records, with zero LLM/API calls.
 * Never assigns staff, publishes schedules, or assumes qualifications.
 */
import type { KhposPresencePeriod } from "@/lib/khpos/ops/presence";
import type { KhposOpsAvailabilityCase, KhposOpsAvailabilityWorkspace, KhposOpsCoverageCandidate } from "@/lib/khpos/ops/availability";

export interface ScheduleCollision {
  id:string; kind:"teacher"|"class"|"room"; first:string; second:string;
  day:number; detail:string;
}
function minutes(time:string):number {
  const match=time.match(/^(\d{1,2}):(\d{2})/);
  return match?Number(match[1])*60+Number(match[2]):-1;
}
function intersects(a0:number,a1:number,b0:number,b1:number){return a0<b1&&b0<a1;}
export function findScheduleCollisions(periods:readonly KhposPresencePeriod[]):ScheduleCollision[] {
  const active=periods.filter(x=>x.termActive&&minutes(x.start)>=0&&minutes(x.end)>minutes(x.start)).slice(0,320);
  const collisions:ScheduleCollision[]=[];
  const seen=new Set<string>();
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i],b=active[j];
    if(a.id===b.id||a.weekday!==b.weekday||a.campusId!==b.campusId)continue;
    if(!intersects(minutes(a.start),minutes(a.end),minutes(b.start),minutes(b.end)))continue;
    let kind:ScheduleCollision["kind"]|null=null;
    if(a.teacherUserId&&a.teacherUserId===b.teacherUserId)kind="teacher";
    else if(a.class&&a.class===b.class)kind="class";
    else if(a.room&&a.room===b.room)kind="room";
    if(!kind)continue;
    const id=[a.id,b.id].sort().join(":");
    if(seen.has(id))continue;seen.add(id);
    collisions.push({
      id,kind,first:a.id,second:b.id,day:a.weekday,
      detail:`${a.class} ${a.subject} (${a.start}–${a.end}) overlaps ${b.class} ${b.subject} (${b.start}–${b.end}) for the same ${kind}.`,
    });
    if(collisions.length>=20)return collisions;
  }
  return collisions;
}
function unavailableDuring(candidateId:string, target:KhposOpsAvailabilityCase, cases:readonly KhposOpsAvailabilityCase[]){
  const from=Date.parse(target.startAt),to=Date.parse(target.endAt);
  if(!Number.isFinite(from)||!Number.isFinite(to))return true;
  return cases.some(c=>c.staffId===candidateId&&c.id!==target.id &&
    !["cancelled","declined","returned","closed"].includes(c.status) &&
    intersects(from,to,Date.parse(c.startAt),Date.parse(c.endAt)));
}
export function proposeCoverageCandidates(
  availabilityCase:KhposOpsAvailabilityCase,
  workspace:Pick<KhposOpsAvailabilityWorkspace,"cases"|"coverageCandidates">,
):KhposOpsCoverageCandidate[]{
  if(!availabilityCase.coverageRequired||availabilityCase.coverageConfirmed||
    !["pending_approval","coverage_required","approved","active"].includes(availabilityCase.status))return [];
  return workspace.coverageCandidates
    .filter(c=>c.staffId!==availabilityCase.staffId)
    .filter(c=>!unavailableDuring(c.staffId,availabilityCase,workspace.cases))
    .sort((a,b)=>{
      const as=Number(a.campusName===availabilityCase.campusName)*2 +
        Number(a.roleTitle===availabilityCase.roleTitle);
      const bs=Number(b.campusName===availabilityCase.campusName)*2 +
        Number(b.roleTitle===availabilityCase.roleTitle);
      return bs-as || a.displayName.localeCompare(b.displayName);
    }).slice(0,3);
}
export interface ExamCollision { id:string; reason:string;firstTitle:string;secondTitle:string }
export function findExamCollisions(entries:readonly {
  id:string;title:string;class_label:string;starts_at:string;ends_at:string;
  invigilators?:readonly string[];
}[]):ExamCollision[]{
  const output:ExamCollision[]=[];
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const a=entries[i],b=entries[j];
    const as=Date.parse(a.starts_at),ae=Date.parse(a.ends_at);
    const bs=Date.parse(b.starts_at),be=Date.parse(b.ends_at);
    if(![as,ae,bs,be].every(Number.isFinite)||!intersects(as,ae,bs,be))continue;
    const sameClass=Boolean(a.class_label&&a.class_label===b.class_label);
    const common=(a.invigilators??[]).filter(id=>b.invigilators?.includes(id));
    if(!sameClass&&!common.length)continue;
    output.push({id:a.id+":"+b.id,
      reason:sameClass?"Overlapping assessments for the same class.":"One invigilator is listed for overlapping assessments.",
      firstTitle:a.title,secondTitle:b.title});
    if(output.length>=20)return output;
  }
  return output;
}
