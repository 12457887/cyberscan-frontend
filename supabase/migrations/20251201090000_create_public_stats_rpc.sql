-- Adds a public RPC to expose aggregate stats for the landing page footer

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS TABLE(
  total_scans bigint,
  total_sites bigint
) LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(*)::bigint AS total_scans,
    COUNT(DISTINCT NULLIF(TRIM(COALESCE(site_url, site_name, '')), ''))::bigint AS total_sites
  FROM public.scans;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats TO anon, authenticated;
