create table api_rate_limits (
  user_id uuid not null,
  route text not null,
  window_start timestamptz not null default now(),
  request_count int not null default 0,
  primary key (user_id, route)
);

alter table api_rate_limits enable row level security;

-- No direct table access for any role — only the security-definer function
-- below may read/write it, so a compromised client can't reset its own limit.
create policy "No direct access" on api_rate_limits for all using (false);

create or replace function check_rate_limit(
  p_user_id uuid,
  p_route text,
  p_window_seconds int,
  p_limit int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into api_rate_limits (user_id, route, window_start, request_count)
  values (p_user_id, p_route, now(), 1)
  on conflict (user_id, route) do update
    set request_count = case
        when api_rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
          then 1
        else api_rate_limits.request_count + 1
      end,
      window_start = case
        when api_rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
          then now()
        else api_rate_limits.window_start
      end
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function check_rate_limit(uuid, text, int, int) to authenticated;
