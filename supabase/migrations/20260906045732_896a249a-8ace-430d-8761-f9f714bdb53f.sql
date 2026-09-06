ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS instagram_link text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_popup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_message text NOT NULL DEFAULT 'Follow us on Instagram for updates and free resources.';

GRANT SELECT (instagram_link, instagram_popup_enabled, instagram_message) ON public.app_settings TO anon;
GRANT SELECT (instagram_link, instagram_popup_enabled, instagram_message) ON public.app_settings TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_switch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_device_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_motivation_at timestamptz,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'normal';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'admin';

GRANT DELETE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "own notifications delete" ON public.notifications;
CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);