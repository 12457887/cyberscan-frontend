-- Migration: create get_admin_stats RPC
-- Returns total users, total scans, active subscriptions placeholder (0), recent scans and recent users as JSON

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE(
  totalUsers integer,
  totalScans integer,
  activeSubscriptions integer,
  recentScans json,
  recentUsers json
) LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT COUNT(*) FROM public.profiles) AS totalUsers,
    (SELECT COUNT(*) FROM public.scans) AS totalScans,
    0 AS activeSubscriptions,
    (SELECT json_agg(r) FROM (SELECT id, site_name, status, created_at FROM public.scans ORDER BY created_at DESC LIMIT 10) r) AS recentScans,
    (SELECT json_agg(u) FROM (SELECT id, email, full_name, role, created_at FROM public.profiles ORDER BY created_at DESC LIMIT 5) u) AS recentUsers;
$$;
