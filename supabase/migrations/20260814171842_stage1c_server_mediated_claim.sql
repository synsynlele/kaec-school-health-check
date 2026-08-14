create or replace function public.claim_kshc_assessment_server(
  p_assessment_id uuid,
  p_user_id uuid,
  p_verified_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_email text;
  v_assessment public.assessments%rowtype;
  v_school public.schools%rowtype;
  v_organisation_id uuid;
  v_membership_existed boolean := false;
begin
  select lower(trim(u.email))
    into v_auth_email
  from auth.users u
  where u.id = p_user_id
    and u.email_confirmed_at is not null;

  if v_auth_email is null or v_auth_email = '' then
    raise exception 'A verified user is required.';
  end if;

  if v_auth_email <> lower(trim(coalesce(p_verified_email, ''))) then
    raise exception 'Verified user email mismatch.';
  end if;

  select * into v_assessment
  from public.assessments
  where id = p_assessment_id
  for update;

  if not found then
    raise exception 'Assessment not found.';
  end if;

  if not exists (select 1 from public.reports r where r.assessment_id = p_assessment_id) then
    raise exception 'Assessment must have a completed report before activation.';
  end if;

  select * into v_school
  from public.schools s
  where s.id::text = v_assessment.school_id;

  if not found then
    raise exception 'School snapshot not found.';
  end if;

  if lower(trim(v_school.email)) <> v_auth_email then
    raise exception 'The verified email does not match the email used for this assessment.';
  end if;

  if v_assessment.organisation_id is not null then
    v_organisation_id := v_assessment.organisation_id;
  else
    select o.id into v_organisation_id
    from public.organisations o
    join public.organisation_memberships m on m.organisation_id = o.id
    where m.user_id = p_user_id
      and m.status = 'active'
      and lower(trim(o.name)) = lower(trim(v_school.school_name))
    order by o.created_at asc
    limit 1;

    if v_organisation_id is null then
      insert into public.organisations (
        name, organisation_type, country, state, school_type, school_level,
        source_school_snapshot_id, created_by
      ) values (
        v_school.school_name, 'school', v_school.country, v_school.state,
        v_school.school_type, v_school.school_level, v_school.id, p_user_id
      ) returning id into v_organisation_id;
    end if;

    update public.assessments
    set organisation_id = v_organisation_id,
        claimed_at = now(),
        claimed_by = p_user_id
    where id = p_assessment_id;
  end if;

  select exists (
    select 1 from public.organisation_memberships m
    where m.organisation_id = v_organisation_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) into v_membership_existed;

  insert into public.organisation_memberships (organisation_id, user_id, role, status)
  values (v_organisation_id, p_user_id, 'executive', 'active')
  on conflict (organisation_id, user_id)
  do update set status = 'active', updated_at = now();

  if not v_membership_existed or v_assessment.organisation_id is null then
    insert into public.khpos_audit_events (
      organisation_id, actor_user_id, event_type, object_type, object_id, metadata
    ) values (
      v_organisation_id, p_user_id, 'assessment_claimed', 'assessment', p_assessment_id,
      jsonb_build_object('source','kshc','framework_version',v_assessment.framework_version,'auth','server_verified')
    );
  end if;

  return v_organisation_id;
end;
$$;

revoke all on function public.claim_kshc_assessment_server(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_kshc_assessment_server(uuid, uuid, text) to service_role;

revoke all on function public.claim_kshc_assessment(uuid) from public, anon, authenticated, service_role;
drop function if exists public.claim_kshc_assessment(uuid);

comment on function public.claim_kshc_assessment_server(uuid, uuid, text) is
  'Server-mediated KHP-OS activation. The application verifies the Supabase access token first; this function independently verifies the confirmed auth.users email before claiming the completed KSHC assessment.';
