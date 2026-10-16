REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone, updated_at) ON public.profiles TO authenticated;