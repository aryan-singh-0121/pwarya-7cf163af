CREATE TABLE public.plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  price_inr integer NOT NULL,
  duration_days integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable by everyone" ON public.plans FOR SELECT USING (true);

INSERT INTO public.plans (code, name, price_inr, duration_days, sort_order) VALUES
  ('d10','10 Days',10,10,1),
  ('m3','3 Months',99,90,2),
  ('m5','5 Months',299,150,3),
  ('y1','1 Year',499,365,4),
  ('life','Lifetime',599,36500,5);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_code text NOT NULL REFERENCES public.plans(code),
  status text NOT NULL DEFAULT 'active',
  access_key text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON public.subscriptions(user_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription read" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  holder_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  utr text NOT NULL,
  plan_code text NOT NULL REFERENCES public.plans(code),
  screenshot_path text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  access_key text,
  decided_at timestamptz,
  purge_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT utr_12_digits CHECK (utr ~ '^[0-9]{12}$')
);
CREATE INDEX payment_requests_status_idx ON public.payment_requests(status);
GRANT SELECT ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payment read" ON public.payment_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  user_agent text,
  ip text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
GRANT SELECT ON public.device_sessions TO authenticated;
GRANT ALL ON public.device_sessions TO service_role;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices read" ON public.device_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  device_id text,
  ip text,
  user_agent text,
  outcome text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_events_email_idx ON public.login_events(email, created_at DESC);
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  phone text,
  reason text NOT NULL,
  device_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'feedback',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback read" ON public.feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own feedback insert" ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  upi_id text NOT NULL DEFAULT '',
  qr_path text NOT NULL DEFAULT '',
  telegram_link text NOT NULL DEFAULT '',
  support_message text NOT NULL DEFAULT 'Need help? Chat with us on Telegram.',
  services_text text NOT NULL DEFAULT '',
  demo_video_url text NOT NULL DEFAULT '',
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  marquee_lines jsonb NOT NULL DEFAULT '["Premium learning, unlocked for members"]'::jsonb,
  content_url text NOT NULL DEFAULT 'https://pwthor.live/study/batches',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable by everyone" ON public.app_settings FOR SELECT USING (true);

INSERT INTO public.app_settings (id, highlights, services_text) VALUES (
  1,
  '["All batches unlocked","Fast HD streaming","Notes & DPP included","24x7 Telegram support","One-device secure login"]'::jsonb,
  'PW ARYA gives members instant access to premium study batches, notes and lectures at a fraction of the cost.'
);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();