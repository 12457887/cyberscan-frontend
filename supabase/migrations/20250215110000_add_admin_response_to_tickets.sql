-- Ajoute des champs pour les réponses admin sur les tickets
alter table if exists public.tickets
  add column if not exists admin_response text,
  add column if not exists admin_response_at timestamptz,
  add column if not exists admin_response_by uuid references public.profiles (id) on delete set null;

comment on column public.tickets.admin_response is 'Réponse fournie par un administrateur';
comment on column public.tickets.admin_response_at is 'Date de la dernière réponse administrateur';
comment on column public.tickets.admin_response_by is 'Profil administrateur ayant répondu';
