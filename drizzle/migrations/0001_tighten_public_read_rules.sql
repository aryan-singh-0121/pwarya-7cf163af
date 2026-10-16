DROP POLICY IF EXISTS "plans readable by everyone" ON public.plans;
CREATE POLICY "active plans readable by everyone" ON public.plans FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "settings readable by everyone" ON public.app_settings;
CREATE POLICY "site settings row readable by everyone" ON public.app_settings FOR SELECT TO anon, authenticated USING (id = 1);