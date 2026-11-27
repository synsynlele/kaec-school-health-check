-- A promoter assigned to a section works in that section. A campus-only
-- assignment covers that campus. An unscoped assignment grants no scheduling.
create or replace function khpos_private.sectional_can_schedule(p_actor uuid,p_org uuid,p_campus uuid,p_unit uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor and a.status='active' and r.status='active'
      and r.organisation_id=p_org and r.code='SECTIONAL_PROMOTER'
      and (a.campus_id is not null or a.unit_id is not null)
      and (a.unit_id is null or a.unit_id=p_unit)
      and (a.campus_id is null or a.campus_id=p_campus)
      and a.start_date <= (now() at time zone 'Africa/Lagos')::date
      and (a.end_date is null or a.end_date >= (now() at time zone 'Africa/Lagos')::date)
  );
$$;

do $migration$
declare
  source text;
  updated text;
begin
  source := pg_get_functiondef('public.khpos_ops_presence_workspace_server(uuid,uuid)'::regprocedure);
  updated := replace(source, $old$    'sectionalScheduleStreamIds',$old$, $new$
    'lessonScheduleStreamIds',coalesce((select jsonb_agg(s.id)
      from public.khpos_ops_academic_delivery_streams s
      where s.organisation_id=p_org and s.campus_id is not null and s.status in ('approved','active')
        and (khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
          or khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id))),'[]'::jsonb),
    'assessmentScheduleStreamIds',coalesce((select jsonb_agg(s.id)
      from public.khpos_ops_academic_delivery_streams s
      where s.organisation_id=p_org and s.status in ('approved','active')
        and (khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
          or khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id))),'[]'::jsonb),
    'observationStreamIds',coalesce((select jsonb_agg(s.id)
      from public.khpos_ops_academic_delivery_streams s
      join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
      where s.organisation_id=p_org and s.status='active' and a.status='active' and a.user_id<>p_actor
        and (khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR'])
          or khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id))),'[]'::jsonb),
    'sectionalScheduleStreamIds',$new$);
  if updated=source then raise exception 'Scheduling scope response not found'; end if;
  source := updated;
  updated := replace(source,
    $old$khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_role_codes)$old$,
    $new$(khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,array_remove(v_role_codes,'SECTIONAL_PROMOTER'))
          or khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id))$new$);
  if updated=source then raise exception 'Teaching visibility scope not found'; end if;
  execute updated;

  source := pg_get_functiondef('public.khpos_ops_presence_action_server(uuid,uuid,text,jsonb)'::regprocedure);
  updated := replace(source,
    $old$if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER'])$old$,
    $new$if not (khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR'])
      or khpos_private.sectional_can_schedule(p_actor,p_org,v_stream.campus_id,v_stream.unit_id))$new$);
  if updated=source then raise exception 'Classroom observation scope not found'; end if;
  execute updated;
end;
$migration$;
