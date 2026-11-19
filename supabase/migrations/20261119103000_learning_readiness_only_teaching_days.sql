-- KHP-OS: teacher daily learning readiness follows active published timetable.
-- No historical attendance or submitted work is edited.
CREATE OR REPLACE FUNCTION public.khpos_ops_materialize_due_work_server(p_actor_user_id uuid, p_organisation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_member_role text;
  v_created integer := 0;
  r record;
  a record;
  v_local_date date;
  v_occurrence_date date;
  v_occurrence_key text;
  v_due_at timestamptz;
  v_last_day integer;
begin
  select m.role into v_member_role
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_member_role is null then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  for a in
    select ra.*
    from public.khpos_ops_role_assignments ra
    join public.khpos_ops_roles role on role.id=ra.role_id
    where ra.user_id=p_actor_user_id
      and ra.status='active'
      and role.organisation_id=p_organisation_id
      and role.status='active'
  loop
    for r in
      select rr.*
      from public.khpos_ops_recurring_rules rr
      where rr.organisation_id=p_organisation_id
        and rr.owner_role_id=a.role_id
        and rr.status='active'
        and rr.cadence <> 'manual'
        and (rr.campus_id is null or rr.campus_id=a.campus_id)
        and (rr.unit_id is null or rr.unit_id=a.unit_id)
    loop
      v_local_date := (now() at time zone r.timezone)::date;
      if v_local_date < r.start_date or (r.end_date is not null and v_local_date > r.end_date) then
        continue;
      end if;

      if r.cadence='daily' then
        if extract(isodow from v_local_date)::integer <> all(r.weekdays) then
          continue;
        end if;
        v_occurrence_date := v_local_date;
        v_occurrence_key := 'D:' || to_char(v_occurrence_date,'YYYY-MM-DD');
      elsif r.cadence='weekly' then
        v_occurrence_date := (date_trunc('week',v_local_date::timestamp)::date + (r.weekday-1));
        if v_occurrence_date > v_local_date then
          continue;
        end if;
        v_occurrence_key := 'W:' || to_char(v_occurrence_date,'IYYY-IW');
      elsif r.cadence='monthly' then
        v_last_day := extract(day from (date_trunc('month',v_local_date::timestamp) + interval '1 month - 1 day'))::integer;
        v_occurrence_date := make_date(
          extract(year from v_local_date)::integer,
          extract(month from v_local_date)::integer,
          least(r.day_of_month,v_last_day)
        );
        if v_occurrence_date > v_local_date then
          continue;
        end if;
        v_occurrence_key := 'M:' || to_char(v_occurrence_date,'YYYY-MM');
      else
        continue;
      end if;

      if v_occurrence_date < r.start_date or (r.end_date is not null and v_occurrence_date > r.end_date) then
        continue;
      end if;

      if r.calendar_day_mode <> 'scheduled' and khpos_private.school_plan_blocks(
        p_organisation_id,coalesce(r.campus_id,a.campus_id),v_occurrence_date,r.calendar_day_mode='teaching'
      ) then continue; end if;

      -- Only ask a Teacher to complete Daily Learning Readiness on a day
      -- when that exact active teaching assignment has an active timetabled class.
      -- The weekly timetable is the source of truth; do not generate a false
      -- overdue obligation for teachers with no lessons that day.
      if r.code = 'RCR-ACD-004-TEACHER' and not exists (
        select 1
        from public.khpos_ops_class_periods period
        join public.khpos_ops_academic_delivery_streams stream
          on stream.id = period.stream_id
         and stream.organisation_id = p_organisation_id
        where period.organisation_id = p_organisation_id
          and period.is_active = true
          and stream.status = 'active'
          and stream.teacher_assignment_id = a.id
          and period.weekday = extract(isodow from v_occurrence_date)::integer
      ) then
        -- Only cancel an unstarted, automatically generated task for today.
        -- Never rewrite completed work or historical teaching evidence.
        update public.khpos_ops_work_items work
        set status = 'cancelled', updated_at = now()
        where work.organisation_id = p_organisation_id
          and work.recurring_rule_id = r.id
          and work.owner_assignment_id = a.id
          and work.occurrence_key = v_occurrence_key
          and work.status = 'pending';
        continue;
      end if;

      v_due_at := case
        when r.due_time is null then (v_occurrence_date::timestamp + time '23:59') at time zone r.timezone
        else (v_occurrence_date::timestamp + r.due_time) at time zone r.timezone
      end;

      insert into public.khpos_ops_work_items(
        organisation_id,campus_id,unit_id,process_id,recurring_rule_id,
        owner_assignment_id,checklist_template_id,occurrence_key,title,description,
        status,priority,due_at,evidence_required,verification_required,created_by
      ) values (
        p_organisation_id,coalesce(r.campus_id,a.campus_id),coalesce(r.unit_id,a.unit_id),
        r.process_id,r.id,a.id,r.checklist_template_id,v_occurrence_key,r.title,r.description,
        'pending',r.priority,v_due_at,r.evidence_required,r.verification_required,p_actor_user_id
      )
      on conflict (recurring_rule_id,owner_assignment_id,occurrence_key)
        where recurring_rule_id is not null and occurrence_key is not null
      do nothing;

      if found then v_created := v_created + 1; end if;
    end loop;
  end loop;

  return v_created;
end;
$function$

