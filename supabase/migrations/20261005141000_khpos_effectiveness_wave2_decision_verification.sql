-- KHP-OS effectiveness wave 2:
-- decision implementation work must be independently verified before a decision
-- can advance from approved to implemented.

create or replace function khpos_private.ops_require_decision_work_verification()
returns trigger
language plpgsql
set search_path=public,khpos_private,pg_temp
as $$
begin
  if new.source_decision_id is not null then
    new.evidence_required := true;
    new.verification_required := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_khpos_ops_require_decision_work_verification
  on public.khpos_ops_work_items;
create trigger trg_khpos_ops_require_decision_work_verification
before insert or update of source_decision_id
on public.khpos_ops_work_items
for each row execute function khpos_private.ops_require_decision_work_verification();

update public.khpos_ops_work_items
set evidence_required=true,
    verification_required=true,
    updated_at=now()
where source_decision_id is not null
  and status not in ('completed','cancelled');

revoke execute on function khpos_private.ops_require_decision_work_verification()
  from public,anon,authenticated;
