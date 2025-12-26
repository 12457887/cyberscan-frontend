alter table if exists public.free_scans
  add column if not exists scan_id text,
  add column if not exists mongo_report_id text;
