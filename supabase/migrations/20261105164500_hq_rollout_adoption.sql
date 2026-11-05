create function public.kaec_hq_rollout_adoption(p_actor uuid, p_engagements uuid[])
returns table (
  engagement_id uuid, staff_total bigint, linked_staff bigint, active_staff bigint,
  onboarding_staff bigint, ready_staff bigint, week_start date, week_end date,
  staff_checkins bigint, completed_lessons bigint
)
language sql stable security definer set search_path = '' as $$
  select e.id, staff.total, staff.linked, staff.active, staff.onboarding, staff.ready,
    dates.start_day, dates.start_day + 6,
    attendance.checkins, lessons.completed
  from public.kaec_hq_school_engagements e
  join public.kaec_hq_members m on m.user_id = p_actor and m.status = 'active'
  join public.organisations o on o.id = e.organisation_id and o.status = 'active'
    and o.partner_status = 'active' and 'khpos_core' = any(o.partner_entitlements)
  cross join lateral (
    select (e.contract_verified_at at time zone 'Africa/Lagos')::date as start_day
  ) dates
  cross join lateral (
    select count(*) as total, count(s.user_id) as linked,
      count(*) filter (where s.status = 'active') as active,
      count(*) filter (where s.status = 'onboarding') as onboarding,
      count(*) filter (where s.status = 'ready') as ready
    from public.khpos_ops_staff s
    where s.organisation_id = e.organisation_id and s.status in ('active','onboarding','ready')
  ) staff
  cross join lateral (
    select count(*) as checkins from public.khpos_ops_staff_day_presence p
    where p.organisation_id = e.organisation_id
      and p.local_day between dates.start_day and dates.start_day + 6
  ) attendance
  cross join lateral (
    select count(*) as completed from public.khpos_ops_class_sessions c
    where c.organisation_id = e.organisation_id
      and c.local_day between dates.start_day and dates.start_day + 6
      and c.checked_out_at is not null and c.outcome = 'completed' and c.closed_by is null
  ) lessons
  where e.id = any(p_engagements) and e.engagement_status in ('setup','active')
    and (m.role in ('vision_custodian','system_steward','alliance_catalyst')
      or (m.role = 'school_pathfinder' and e.representative_user_id = p_actor));
$$;
revoke all on function public.kaec_hq_rollout_adoption(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.kaec_hq_rollout_adoption(uuid,uuid[]) to service_role;
