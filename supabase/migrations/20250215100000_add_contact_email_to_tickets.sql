-- Ajoute un email de contact spécifique pour les tickets
ALTER TABLE IF EXISTS public.tickets
    ADD COLUMN IF NOT EXISTS contact_email text;

COMMENT ON COLUMN public.tickets.contact_email IS
    'Email de contact fourni lors de la création du ticket de support';
