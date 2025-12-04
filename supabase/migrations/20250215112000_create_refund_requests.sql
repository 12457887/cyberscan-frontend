-- Table to store refund requests awaiting admin review
CREATE TABLE IF NOT EXISTS public.refund_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    invoice_id uuid NULL,
    invoice_number text NULL,
    stripe_invoice_id text NULL,
    stripe_payment_intent_id text NULL,
    stripe_charge_id text NULL,
    stripe_checkout_session_id text NULL,
    amount_cents integer NULL,
    currency text NULL,
    reason text NULL,
    status text NOT NULL DEFAULT 'pending',
    admin_id uuid NULL,
    decision_reason text NULL,
    stripe_refund_id text NULL,
    decided_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.refund_requests IS 'Stores customer refund requests awaiting admin approval.';

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY refund_requests_insert_own
    ON public.refund_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY refund_requests_select_own
    ON public.refund_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_refund_requests_timestamp ON public.refund_requests;
CREATE TRIGGER set_refund_requests_timestamp
BEFORE UPDATE ON public.refund_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp();

CREATE INDEX IF NOT EXISTS refund_requests_user_idx ON public.refund_requests(user_id);
CREATE INDEX IF NOT EXISTS refund_requests_status_idx ON public.refund_requests(status);
