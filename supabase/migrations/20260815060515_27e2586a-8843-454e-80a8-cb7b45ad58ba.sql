ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS video_popup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_popup_url text NOT NULL DEFAULT '';