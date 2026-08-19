CREATE TABLE public.reader_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  kind text not null,
  detail text,
  user_agent text,
  created_at timestamptz not null default now()
);
GRANT ALL ON public.reader_events TO service_role;
ALTER TABLE public.reader_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX reader_events_created_idx ON public.reader_events (created_at DESC);