-- Complete Vision Custodian inheritance for direct academic observation actor assignment.

create or replace function public.khpos_ops_create_academic_observation_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_stream_id uuid,
  p_target_id uuid,
  p_observation_type text,
  p_observed_at timestamptz,
  p_strengths text,
  p_improvement_area text default null,
  p_required_action text default null,
  p_action_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_observer_assignment uuid;
  v_teacher_user uuid;
  v_id uuid;
  v_followup text;
begin
  if not khpos_private.ops_academic_can_monitor(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic monitoring authority can record teaching observations.';
  end if;

  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=p_stream_id and organisation_id=p_organisation_id;

  if v_stream.id is null then raise exception 'Academic delivery stream not found.'; end if;

  select user_id into v_teacher_user
  from public.khpos_ops_role_assignments
  where id=v_stream.teacher_assignment_id;

  if v_teacher_user=p_actor_user_id then
    raise exception 'A teacher cannot record an institutional observation of their own teaching.';
  end if;

  if p_observation_type not in ('micro','development','qa') then
    raise exception 'Observation type must be micro, development or qa.';
  end if;

  if nullif(btrim(coalesce(p_strengths,'')),'') is null then
    raise exception 'Teaching observation requires specific observed strengths/evidence.';
  end if;

  if nullif(btrim(coalesce(p_required_action,'')),'') is not null
     and p_action_due_date is null then
    raise exception 'Required observation action must have a due date.';
  end if;

  if p_target_id is not null
     and not exists(
       select 1 from public.khpos_ops_academic_weekly_targets wt
       where wt.id=p_target_id and wt.stream_id=v_stream.id
     ) then
    raise exception 'Observation target does not belong to this delivery stream.';
  end if;

  select a.id into v_observer_assignment
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.user_id=p_actor_user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SECTIONAL_PROMOTER')
  order by r.role_level,a.primary_assignment desc,a.created_at
  limit 1;

  v_followup := case
    when nullif(btrim(coalesce(p_required_action,'')),'') is null
    then 'none' else 'open' end;

  insert into public.khpos_ops_academic_observations(
    organisation_id,stream_id,target_id,observed_teacher_assignment_id,
    observer_assignment_id,observer_user_id,observation_type,observed_at,
    strengths,improvement_area,required_action,action_due_date,
    follow_up_status
  ) values (
    p_organisation_id,v_stream.id,p_target_id,v_stream.teacher_assignment_id,
    v_observer_assignment,p_actor_user_id,p_observation_type,
    coalesce(p_observed_at,now()),left(btrim(p_strengths),6000),
    left(nullif(btrim(coalesce(p_improvement_area,'')),''),6000),
    left(nullif(btrim(coalesce(p_required_action,'')),''),6000),
    p_action_due_date,v_followup
  )
  returning id into v_id;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,observation_id,
    actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,v_stream.id,p_target_id,v_id,p_actor_user_id,
    'teaching_observation_recorded',v_followup,left(btrim(p_strengths),4000)
  );

  return v_id;
end;
$$;
