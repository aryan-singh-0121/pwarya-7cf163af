CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  target_type text NOT NULL DEFAULT '',
  target_id text,
  email text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS deny_reason text,
  ADD COLUMN IF NOT EXISTS proof_deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS payment_requests_utr_idx ON public.payment_requests (utr);