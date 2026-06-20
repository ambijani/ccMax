create table user_cpp_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_program text not null,
  cpp_override numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, reward_program)
);

alter table user_cpp_overrides enable row level security;

create policy "Users manage own cpp overrides" on user_cpp_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
