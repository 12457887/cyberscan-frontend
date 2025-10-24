-- Migration: create profiles table
-- Creates a minimal profiles table expected by the frontend

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
	id uuid PRIMARY KEY,
	email text UNIQUE,
	full_name text,
	role text NOT NULL DEFAULT 'client',
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger helper to update updated_at
CREATE OR REPLACE FUNCTION public.profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_updated_at();
