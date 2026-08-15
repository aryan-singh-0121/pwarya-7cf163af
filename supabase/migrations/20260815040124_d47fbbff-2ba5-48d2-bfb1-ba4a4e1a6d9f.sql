-- 1) Admin/system-only tables: no client access at all.
REVOKE ALL ON public.audit_logs FROM anon, authenticated;
REVOKE ALL ON public.login_events FROM anon, authenticated;
REVOKE ALL ON public.security_alerts FROM anon, authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT ALL ON public.login_events TO service_role;
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit logs are backend only" ON public.audit_logs;
CREATE POLICY "audit logs are backend only" ON public.audit_logs
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "login events are backend only" ON public.login_events;
CREATE POLICY "login events are backend only" ON public.login_events
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "security alerts are backend only" ON public.security_alerts;
CREATE POLICY "security alerts are backend only" ON public.security_alerts
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 2) Owner-readable tables: writes are backend-only (service role bypasses RLS).
REVOKE INSERT, UPDATE, DELETE ON public.device_sessions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_requests FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
REVOKE ALL ON public.device_sessions FROM anon;
REVOKE ALL ON public.payment_requests FROM anon;
REVOKE ALL ON public.subscriptions FROM anon;
GRANT SELECT ON public.device_sessions TO authenticated;
GRANT SELECT ON public.payment_requests TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.device_sessions TO service_role;
GRANT ALL ON public.payment_requests TO service_role;
GRANT ALL ON public.subscriptions TO service_role;

DROP POLICY IF EXISTS "device sessions are read only for members" ON public.device_sessions;
CREATE POLICY "device sessions are read only for members" ON public.device_sessions
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (auth.uid() = user_id) WITH CHECK (false);
DROP POLICY IF EXISTS "payment requests are read only for members" ON public.payment_requests;
CREATE POLICY "payment requests are read only for members" ON public.payment_requests
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (auth.uid() = user_id) WITH CHECK (false);
DROP POLICY IF EXISTS "subscriptions are read only for members" ON public.subscriptions;
CREATE POLICY "subscriptions are read only for members" ON public.subscriptions
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (auth.uid() = user_id) WITH CHECK (false);

-- 3) Private storage buckets: backend only, plus own-screenshot read.
DROP POLICY IF EXISTS "private buckets are backend only" ON storage.objects;
CREATE POLICY "private buckets are backend only" ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (
    bucket_id NOT IN ('payment-proofs', 'site-assets')
    OR (
      bucket_id = 'payment-proofs'
      AND EXISTS (
        SELECT 1 FROM public.payment_requests pr
        WHERE pr.screenshot_path = storage.objects.name
          AND pr.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (bucket_id NOT IN ('payment-proofs', 'site-assets'));

DROP POLICY IF EXISTS "members read own payment proof" ON storage.objects;
CREATE POLICY "members read own payment proof" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.payment_requests pr
      WHERE pr.screenshot_path = storage.objects.name
        AND pr.user_id = auth.uid()
    )
  );