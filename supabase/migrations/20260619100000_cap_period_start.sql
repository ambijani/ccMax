-- Track when the current cap period started so cap_spent_cents can be reset
-- on quarterly/annual boundaries.
alter table card_categories
  add column cap_period_start timestamptz not null default now();
