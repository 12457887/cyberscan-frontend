-- Migration: create vulnerabilities table

CREATE TABLE IF NOT EXISTS public.vulnerabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES public.scans(id) ON DELETE CASCADE,
  severity text NOT NULL,
  count integer DEFAULT 1,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vuln_scan_id ON public.vulnerabilities(scan_id);
