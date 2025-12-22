alter table if exists public.free_scans
  add column if not exists ip_address text;
