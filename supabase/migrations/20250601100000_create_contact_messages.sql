create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text,
  email text not null,
  message text not null
);

alter table public.contact_messages enable row level security;

create policy if not exists contact_messages_insert_public
on public.contact_messages
for insert
with check (true);

create policy if not exists contact_messages_select_admins
on public.contact_messages
for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);
