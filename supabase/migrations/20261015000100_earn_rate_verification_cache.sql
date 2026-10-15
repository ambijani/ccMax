create table earn_rate_verification_cache (
  merchant_key text not null,
  card_name text not null,
  category text not null,
  source_text_hash text not null,
  qualifies boolean not null,
  note text not null,
  created_at timestamptz not null default now(),
  primary key (merchant_key, card_name, category, source_text_hash)
);

alter table earn_rate_verification_cache enable row level security;

-- Shared reference data, not user-owned — only the security-definer
-- functions below may read/write it.
create policy "No direct access" on earn_rate_verification_cache for all using (false);

create or replace function get_earn_rate_verification_cache(
  p_merchant_key text,
  p_card_name text,
  p_category text,
  p_source_text_hash text
)
returns table (
  qualifies boolean,
  note text
)
language sql
security definer
set search_path = public
as $$
  select qualifies, note
  from earn_rate_verification_cache
  where merchant_key = p_merchant_key
    and card_name = p_card_name
    and category = p_category
    and source_text_hash = p_source_text_hash;
$$;

create or replace function set_earn_rate_verification_cache(
  p_merchant_key text,
  p_card_name text,
  p_category text,
  p_source_text_hash text,
  p_qualifies boolean,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into earn_rate_verification_cache
    (merchant_key, card_name, category, source_text_hash, qualifies, note)
  values
    (p_merchant_key, p_card_name, p_category, p_source_text_hash, p_qualifies, p_note)
  on conflict (merchant_key, card_name, category, source_text_hash) do update
    set qualifies = excluded.qualifies,
        note = excluded.note,
        created_at = now();
end;
$$;

grant execute on function get_earn_rate_verification_cache(text, text, text, text) to authenticated;
grant execute on function set_earn_rate_verification_cache(text, text, text, text, boolean, text) to authenticated;
