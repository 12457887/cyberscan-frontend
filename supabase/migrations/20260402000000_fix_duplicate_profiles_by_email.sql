-- Supprimer les profils dupliqués par email
-- Garder celui qui a le created_at le plus ancien (le premier compte créé)
-- et supprimer les doublons plus récents

-- 1. Identifier les doublons
-- (même email, plusieurs lignes → garder la plus ancienne)

DELETE FROM public.credits
WHERE user_id IN (
  SELECT id FROM public.profiles p
  WHERE p.email IN (
    SELECT email FROM public.profiles
    GROUP BY email HAVING COUNT(*) > 1
  )
  AND p.created_at > (
    SELECT MIN(created_at) FROM public.profiles p2 WHERE p2.email = p.email
  )
);

DELETE FROM public.subscriptions
WHERE user_id IN (
  SELECT id FROM public.profiles p
  WHERE p.email IN (
    SELECT email FROM public.profiles
    GROUP BY email HAVING COUNT(*) > 1
  )
  AND p.created_at > (
    SELECT MIN(created_at) FROM public.profiles p2 WHERE p2.email = p.email
  )
);

DELETE FROM public.profiles
WHERE email IN (
  SELECT email FROM public.profiles
  GROUP BY email HAVING COUNT(*) > 1
)
AND created_at > (
  SELECT MIN(created_at) FROM public.profiles p2 WHERE p2.email = profiles.email
);
