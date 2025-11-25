create table if not exists public.free_scans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  url text not null,
  email text,
  cms_label text,
  risk_level text,
  analyzer_domain text,
  severity_counts jsonb
);

alter table public.free_scans enable row level security;

create policy if not exists free_scans_insert_public
on public.free_scans
for insert
with check (true);

create policy if not exists free_scans_select_admins
on public.free_scans
for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy if not exists free_scans_update_admins
on public.free_scans
for update
using (
  auth.role() = 'authenticated'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
