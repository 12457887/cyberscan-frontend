-- Ajoute un numéro de téléphone aux profils

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS phone_number text;

COMMENT ON COLUMN public.profiles.phone_number IS
    'Numéro de téléphone fourni à l’inscription';
