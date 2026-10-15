create table merchant_classification_cache (
  merchant_key text primary key,
  category text not null,
  confidence text not null,
  ambiguous boolean not null,
  alternative_categories text[] not null default '{}',
  reasoning text not null,
  created_at timestamptz not null default now()
);

alter table merchant_classification_cache enable row level security;

-- Shared reference data, not user-owned — only the security-definer
-- functions below may read/write it, so a client can't poison another
-- user's classification cache via a direct table write.
create policy "No direct access" on merchant_classification_cache for all using (false);

create or replace function get_merchant_classification_cache(p_merchant_key text)
returns table (
  category text,
  confidence text,
  ambiguous boolean,
  alternative_categories text[],
  reasoning text
)
language sql
security definer
set search_path = public
as $$
  select category, confidence, ambiguous, alternative_categories, reasoning
  from merchant_classification_cache
  where merchant_key = p_merchant_key;
$$;

create or replace function set_merchant_classification_cache(
  p_merchant_key text,
  p_category text,
  p_confidence text,
  p_ambiguous boolean,
  p_alternative_categories text[],
  p_reasoning text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into merchant_classification_cache
    (merchant_key, category, confidence, ambiguous, alternative_categories, reasoning)
  values
    (p_merchant_key, p_category, p_confidence, p_ambiguous, p_alternative_categories, p_reasoning)
  on conflict (merchant_key) do update
    set category = excluded.category,
        confidence = excluded.confidence,
        ambiguous = excluded.ambiguous,
        alternative_categories = excluded.alternative_categories,
        reasoning = excluded.reasoning,
        created_at = now();
end;
$$;

grant execute on function get_merchant_classification_cache(text) to authenticated;
grant execute on function set_merchant_classification_cache(text, text, text, boolean, text[], text) to authenticated;
