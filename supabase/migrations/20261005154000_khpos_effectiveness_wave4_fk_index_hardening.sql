create index if not exists idx_khpos_standard_releases_published_by
  on public.khpos_standard_releases(published_by)
  where published_by is not null;

create index if not exists idx_khpos_standard_installations_installed_by
  on public.khpos_standard_installations(installed_by)
  where installed_by is not null;

create index if not exists idx_khpos_standard_installations_adopted_by
  on public.khpos_standard_installations(adopted_by)
  where adopted_by is not null;
