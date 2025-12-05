-- Adjust refund_requests FK to rely on profiles instead of auth.users
-- This avoids foreign key violations for legacy invoices whose Supabase auth user was removed.

ALTER TABLE public.refund_requests
  DROP CONSTRAINT IF EXISTS refund_requests_user_id_fkey;

ALTER TABLE public.refund_requests
  ADD CONSTRAINT refund_requests_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles (id)
  ON DELETE CASCADE;
