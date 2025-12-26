-- Logs subscription changes to preserve history across renewals, cancellations, and refunds.
CREATE TABLE IF NOT EXISTS public.subscription_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid NULL REFERENCES public.subscriptions (id) ON DELETE SET NULL,
    user_id uuid NOT NULL,
    plan_type text NULL,
    status text NULL,
    credits_limit integer NULL,
    started_at timestamptz NULL,
    expires_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.subscription_history IS 'Audit log of subscription changes.';

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_history_select_own
    ON public.subscription_history
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS subscription_history_user_idx
    ON public.subscription_history(user_id);

CREATE OR REPLACE FUNCTION public.log_subscription_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.subscription_history (
      subscription_id,
      user_id,
      plan_type,
      status,
      credits_limit,
      started_at,
      expires_at
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.plan_type,
      NEW.status,
      NEW.credits_limit,
      NEW.started_at,
      NEW.expires_at
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.plan_type IS DISTINCT FROM OLD.plan_type
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.credits_limit IS DISTINCT FROM OLD.credits_limit
      OR NEW.started_at IS DISTINCT FROM OLD.started_at
      OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      INSERT INTO public.subscription_history (
        subscription_id,
        user_id,
        plan_type,
        status,
        credits_limit,
        started_at,
        expires_at
      ) VALUES (
        NEW.id,
        NEW.user_id,
        NEW.plan_type,
        NEW.status,
        NEW.credits_limit,
        NEW.started_at,
        NEW.expires_at
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_subscription_history ON public.subscriptions;
CREATE TRIGGER set_subscription_history
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.log_subscription_history();
