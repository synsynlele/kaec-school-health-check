-- Publishing takes effect immediately; future dated drafts remain in review until their effective date.
create or replace function public.khpos_ops_policy_effective_gate()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='active' and new.effective_date>current_date then
    raise exception 'A future effective date cannot be published yet. Set the effective date to today or return on that date.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_khpos_ops_policy_effective_gate on public.khpos_ops_policy_versions;
create trigger trg_khpos_ops_policy_effective_gate
before insert or update on public.khpos_ops_policy_versions
for each row execute function public.khpos_ops_policy_effective_gate();
