REVOKE SELECT ON public.app_settings FROM anon, authenticated;
GRANT SELECT (id, upi_id, qr_path, telegram_link, support_message, services_text, demo_video_url, video_popup_enabled, video_popup_url, highlights, marquee_lines, updated_at) ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;