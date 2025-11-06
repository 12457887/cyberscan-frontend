-- Ajoute un numéro de téléphone sur les tickets de support
ALTER TABLE IF EXISTS public.tickets
    ADD COLUMN IF NOT EXISTS phone_number text;

COMMENT ON COLUMN public.tickets.phone_number IS
    'Numéro de téléphone fourni lors de la création du ticket de support';
