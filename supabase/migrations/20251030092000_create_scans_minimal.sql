-- Migration: create minimal scans table expected by frontend and backend

CREATE TABLE IF NOT EXISTS public.scans (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
	site_name text,
	site_url text,
	scan_type text DEFAULT 'light',
	status text DEFAULT 'pending',
	risk_level text,
	vulnerabilities_count integer DEFAULT 0,
	mongo_report_id text,
	backend_scan_id text,
	started_at timestamptz,
	completed_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON public.scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON public.scans(status);
