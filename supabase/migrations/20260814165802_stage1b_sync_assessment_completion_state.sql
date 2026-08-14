create or replace function public.sync_kshc_assessment_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.completed_at is not null then
    new.status := 'completed';
  elsif new.status = 'completed' then
    new.status := 'in_progress';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_kshc_assessment_status on public.assessments;
create trigger trg_sync_kshc_assessment_status
before insert or update of completed_at, status on public.assessments
for each row execute function public.sync_kshc_assessment_status();

revoke all on function public.sync_kshc_assessment_status() from public, anon, authenticated;
comment on function public.sync_kshc_assessment_status() is 'Compatibility trigger: existing KSHC code writes completed_at; KHP-OS status follows deterministically without requiring a legacy storage rewrite.';
