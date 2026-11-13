create or replace function khpos_private.sectional_can_schedule(p_actor uuid,p_org uuid,p_campus uuid,p_unit uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor and a.status='active' and r.status='active'
      and r.organisation_id=p_org and r.code='SECTIONAL_PROMOTER'
      and a.unit_id=p_unit and (a.campus_id is null or a.campus_id=p_campus)
      and a.start_date <= (now() at time zone 'Africa/Lagos')::date
      and (a.end_date is null or a.end_date >= (now() at time zone 'Africa/Lagos')::date)
  );
$$;
revoke all on function khpos_private.sectional_can_schedule(uuid,uuid,uuid,uuid) from public,anon,authenticated;

-- Sectional Promoters can create drafts in their assigned sections.
-- The existing stream approval and activation functions keep their current gates.
do $migration$
declare
  source text;
  updated text;
begin
  source := pg_get_functiondef('public.khpos_ops_create_academic_stream_server(uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,text,text,text,text,integer)'::regprocedure);
  updated := replace(source,
    $old$    raise exception 'Only academic planning authority can create curriculum delivery streams.';$old$,
    $new$    if not khpos_private.ops_academic_has_membership(p_actor_user_id,p_organisation_id)
      or not khpos_private.sectional_can_schedule(p_actor_user_id,p_organisation_id,p_campus_id,p_unit_id)
      or not exists (
        select 1 from public.khpos_ops_units u
        where u.id=p_unit_id and u.organisation_id=p_organisation_id and u.status='active'
          and u.campus_id is not distinct from p_campus_id
      )
      or not exists (
        select 1 from public.khpos_ops_academic_terms t
        where t.id=p_term_id and t.organisation_id=p_organisation_id
          and (t.campus_id is null or t.campus_id=p_campus_id)
      )
      or not exists (
        select 1 from public.khpos_ops_role_assignments a
        where a.id=p_teacher_assignment_id
          and a.start_date <= (now() at time zone 'Africa/Lagos')::date
          and (a.end_date is null or a.end_date >= (now() at time zone 'Africa/Lagos')::date)
          and (a.campus_id is null or a.campus_id=p_campus_id)
          and (a.unit_id is null or a.unit_id=p_unit_id)
      )
    then
      raise exception 'Only academic planning authority or an assigned Sectional Promoter can create a subject stream for this section.';
    end if;$new$);
  if updated=source then raise exception 'Subject stream creation gate not found'; end if;
  execute updated;

  source := pg_get_functiondef('public.khpos_ops_get_academic_delivery_server(uuid,uuid)'::regprocedure);
  updated := replace(source,
    $old$'teacherAssignments',v_teacher_assignments,$old$,
    $new$'teacherAssignments',v_teacher_assignments,
    'sectionalStreamUnitIds',coalesce((
      select jsonb_agg(u.id)
      from public.khpos_ops_units u
      where u.organisation_id=p_organisation_id and u.status='active'
        and khpos_private.sectional_can_schedule(p_actor_user_id,p_organisation_id,u.campus_id,u.id)
    ),'[]'::jsonb),$new$);
  if updated=source then raise exception 'Academic workspace stream scope not found'; end if;
  execute updated;
end;
$migration$;
