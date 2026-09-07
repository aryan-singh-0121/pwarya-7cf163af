create table if not exists public.app_content_config (
  id integer primary key default 1,
  content_url text not null default 'https://pwthor.live/study/batches',
  content_headers text not null default '',
  content_proxy_url text not null default '',
  updated_at timestamptz not null default now()
);
grant all on public.app_content_config to service_role;
alter table public.app_content_config enable row level security;
create policy "content config is backend only" on public.app_content_config
  as restrictive for all to anon, authenticated using (false) with check (false);

insert into public.app_content_config (id, content_url, content_headers, content_proxy_url)
select 1, content_url, content_headers, content_proxy_url from public.app_settings where id = 1
on conflict (id) do nothing;

alter table public.app_settings drop column if exists content_url;
alter table public.app_settings drop column if exists content_headers;
alter table public.app_settings drop column if exists content_proxy_url;