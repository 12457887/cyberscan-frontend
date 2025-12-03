-- Ajoute la gestion des pieces jointes dans les tickets de support
ALTER TABLE IF EXISTS public.tickets
    ADD COLUMN IF NOT EXISTS attachment_url text;

COMMENT ON COLUMN public.tickets.attachment_url IS
    'URL publique vers la piece jointe du ticket';

ALTER TABLE IF EXISTS public.tickets
    ADD COLUMN IF NOT EXISTS attachment_name text;

COMMENT ON COLUMN public.tickets.attachment_name IS
    'Nom original du fichier joint envoye par l utilisateur';
