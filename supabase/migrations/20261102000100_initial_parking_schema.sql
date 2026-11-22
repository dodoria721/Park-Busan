-- Review this file and the target Supabase project before running `supabase db push`.
create extension if not exists pgcrypto;

create table public.parking_lots (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  address text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_public boolean not null default true,
  total_spaces integer check (total_spaces >= 0),
  operating_hours text,
  live_status text not null default 'unknown' check (live_status in ('available', 'full', 'unknown')),
  live_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fee_policies (
  id uuid primary key default gen_random_uuid(),
  parking_lot_id uuid not null references public.parking_lots(id) on delete cascade,
  base_minutes integer not null check (base_minutes > 0),
  base_fee_won integer not null check (base_fee_won >= 0),
  additional_minutes integer check (additional_minutes > 0),
  additional_fee_won integer check (additional_fee_won >= 0),
  daily_max_fee_won integer check (daily_max_fee_won >= 0),
  notes text,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_read integer not null default 0 check (records_read >= 0),
  records_written integer not null default 0 check (records_written >= 0),
  error_message text
);

create table public.source_mappings (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_record_id text not null,
  parking_lot_id uuid not null references public.parking_lots(id) on delete cascade,
  import_run_id uuid references public.import_runs(id) on delete set null,
  source_payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  unique (source_name, source_record_id)
);

create index parking_lots_location_idx on public.parking_lots(latitude, longitude);
create index fee_policies_parking_lot_idx on public.fee_policies(parking_lot_id);
create index source_mappings_parking_lot_idx on public.source_mappings(parking_lot_id);

alter table public.parking_lots enable row level security;
alter table public.fee_policies enable row level security;
alter table public.source_mappings enable row level security;
alter table public.import_runs enable row level security;

-- No anon/authenticated policies are created. The API server uses the service role,
-- which bypasses RLS. Add narrowly scoped read policies only after the access model is approved.
