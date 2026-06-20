create table card_promos (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  title text not null,
  description text not null,
  merchant_keywords text[],
  value_cents bigint,
  value_percent numeric,
  terms text,
  source_text text,
  source_url text,
  expires_at timestamptz,
  discovered_at timestamptz not null default now()
);

create index card_promos_card_id_idx on card_promos(card_id);

alter table card_promos enable row level security;

create policy "Users manage own card_promos" on card_promos
  for all using (
    exists (select 1 from cards where cards.id = card_promos.card_id and cards.user_id = auth.uid())
  )
  with check (
    exists (select 1 from cards where cards.id = card_promos.card_id and cards.user_id = auth.uid())
  );
