-- Fusionner les profils dupliqués (même email, ids différents)
-- Garde le plus ancien, migre les données du plus récent, supprime le doublon

DO $$
DECLARE
  dup RECORD;
  old_id uuid;
  new_id uuid;
BEGIN
  -- Parcourir chaque email en double
  FOR dup IN
    SELECT email
    FROM public.profiles
    GROUP BY email
    HAVING COUNT(*) > 1
  LOOP
    -- Identifier le plus ancien (à garder) et le plus récent (doublon)
    SELECT id INTO old_id
    FROM public.profiles
    WHERE email = dup.email
    ORDER BY created_at ASC
    LIMIT 1;

    SELECT id INTO new_id
    FROM public.profiles
    WHERE email = dup.email
      AND id <> old_id
    LIMIT 1;

    RAISE NOTICE 'Merging email=% old_id=% new_id=%', dup.email, old_id, new_id;

    -- Migrer credits vers l'ancien id (si le nouveau en a)
    UPDATE public.credits SET user_id = old_id WHERE user_id = new_id;

    -- Migrer subscriptions vers l'ancien id
    UPDATE public.subscriptions SET user_id = old_id WHERE user_id = new_id;

    -- Migrer scans si la table existe
    BEGIN
      UPDATE public.scans SET user_id = old_id WHERE user_id = new_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Supprimer le profil doublon
    DELETE FROM public.profiles WHERE id = new_id;

  END LOOP;
END;
$$;

-- Mettre à jour la vue admin pour dédupliquer par email (sécurité supplémentaire)
CREATE OR REPLACE VIEW public.admin_user_view AS
SELECT DISTINCT ON (p.email)
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
) c ON true
ORDER BY p.email, p.created_at ASC;

GRANT SELECT ON public.admin_user_view TO authenticated;
