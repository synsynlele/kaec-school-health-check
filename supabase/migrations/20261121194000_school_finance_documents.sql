insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('khpos-finance-documents','khpos-finance-documents',false,3000000,array['application/pdf','image/jpeg','image/png']);

-- Objects are read and written only through the authenticated server route.
create policy khpos_finance_document_privacy
  on storage.objects as restrictive for all to anon,authenticated
  using (bucket_id <> 'khpos-finance-documents')
  with check (bucket_id <> 'khpos-finance-documents');

create table public.khpos_finance_documents (
  entry_id uuid primary key references public.khpos_finance_entries(id),
  object_path text not null unique,
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now()
);
alter table public.khpos_finance_documents enable row level security;
revoke all on public.khpos_finance_documents from public,anon,authenticated,service_role;

create function public.khpos_finance_document_server(p_actor uuid,p_school uuid,p_campus uuid,p_entry uuid,p_path text default null,p_mime text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  doc public.khpos_finance_documents;
begin
  if p_campus is null then raise exception 'Choose a campus.' using errcode='22023'; end if;
  perform khpos_private.finance_scope(p_actor,p_school,p_campus);
  if not exists(select 1 from public.khpos_finance_entries e where e.id=p_entry and e.campus_id=p_campus and e.school_id=p_school) then
    raise exception 'This transaction was not found in this campus.' using errcode='22023';
  end if;
  if p_path is not null then
    if p_mime not in ('application/pdf','image/jpeg','image/png') or p_mime is null
      or p_path !~ ('^'||p_school::text||'/'||p_campus::text||'/'||p_entry::text||'/[0-9a-f-]{36}$') then
      raise exception 'Choose a supported document.' using errcode='22023';
    end if;
    insert into public.khpos_finance_documents(entry_id,object_path,mime_type,uploaded_by)
      values(p_entry,p_path,p_mime,p_actor) returning * into doc;
    insert into public.khpos_finance_audit(school_id,campus_id,actor_id,action,record_id)
      values(p_school,p_campus,p_actor,'attach supporting document',p_entry);
  else
    select * into doc from public.khpos_finance_documents d where d.entry_id=p_entry;
  end if;
  return jsonb_build_object('path',doc.object_path,'mime',doc.mime_type);
end
$$;
revoke all on function public.khpos_finance_document_server(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.khpos_finance_document_server(uuid,uuid,uuid,uuid,text,text) to service_role;
