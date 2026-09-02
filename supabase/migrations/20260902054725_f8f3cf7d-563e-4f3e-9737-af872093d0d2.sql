alter table public.app_settings
  add column if not exists content_headers text not null default '',
  add column if not exists content_proxy_url text not null default '';