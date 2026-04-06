-- Fix duplicate users in admin dashboard
-- 1. Remove duplicate rows in subscriptions/credits (keep most recent per user)
-- 2. Add UNIQUE constraints on user_id
-- 3. Create admin_user_view with LATERAL joins (no duplicates even if old dupes exist)

-- ────────────────────────────────────────────────
-- 1. Clean up existing duplicates
-- ────────────────────────────────────────────────

DELETE FROM public.subscriptions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.subscriptions
  ORDER BY user_id, created_at DESC
);

DELETE FROM public.credits
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.credits
  ORDER BY user_id, created_at DESC
);

-- ────────────────────────────────────────────────
-- 2. Add UNIQUE constraints to prevent future duplicates
-- ────────────────────────────────────────────────

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_unique;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);

ALTER TABLE public.credits
  DROP CONSTRAINT IF EXISTS credits_user_id_unique;
ALTER TABLE public.credits
  ADD CONSTRAINT credits_user_id_unique UNIQUE (user_id);

-- ────────────────────────────────────────────────
-- 3. Create admin_user_view using LATERAL joins
--    LATERAL + LIMIT 1 guarantees one row per user
--    regardless of how many subscription/credit rows exist
-- ────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.admin_user_view AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at,
  s.plan_type,
  s.status,
  s.expires_at,
  COALESCE(c.total_credits, 0) - COALESCE(c.used_credits, 0) AS remaining_credits
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT plan_type, status, expires_at
  FROM public.subscriptions
  WHERE user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT total_credits, used_credits
  FROM public.credits
  WHERE user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) c ON true;

GRANT SELECT ON public.admin_user_view TO authenticated;
