-- Credit Card Optimizer initial schema

create extension if not exists "pgcrypto";

create type reward_type as enum ('cash_back', 'points', 'miles');
create type cap_period as enum ('quarterly', 'annual');

create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  issuer text not null,
  network text not null,
  reward_type reward_type not null,
  reward_program text not null,
  base_earn_rate numeric not null default 1.0,
  terms_url text,
  created_at timestamptz not null default now()
);

create table card_categories (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  category text not null,
  earn_rate numeric not null,
  cap_amount_cents bigint,
  cap_period cap_period,
  cap_spent_cents bigint not null default 0,
  source_text text,
  source_url text,
  created_at timestamptz not null default now()
);

create table points_valuations (
  id uuid primary key default gen_random_uuid(),
  reward_program text not null unique,
  cpp_conservative numeric,
  cpp_optimistic numeric,
  cpp_community numeric,
  valuation_notes text,
  sources jsonb not null default '[]'::jsonb,
  last_updated timestamptz not null default now()
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_name text not null,
  category text not null,
  amount_cents bigint not null,
  card_used_id uuid references cards(id),
  created_at timestamptz not null default now()
);

create index card_categories_card_id_idx on card_categories(card_id);
create index cards_user_id_idx on cards(user_id);
create index purchases_user_id_idx on purchases(user_id);

-- Row level security: users only see their own cards/purchases.
alter table cards enable row level security;
alter table card_categories enable row level security;
alter table purchases enable row level security;
alter table points_valuations enable row level security;

create policy "Users manage own cards" on cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own card_categories" on card_categories
  for all using (
    exists (select 1 from cards where cards.id = card_categories.card_id and cards.user_id = auth.uid())
  )
  with check (
    exists (select 1 from cards where cards.id = card_categories.card_id and cards.user_id = auth.uid())
  );

create policy "Users manage own purchases" on purchases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Points valuations are shared reference data, readable by any authenticated user.
create policy "Authenticated users can read points_valuations" on points_valuations
  for select using (auth.role() = 'authenticated');
