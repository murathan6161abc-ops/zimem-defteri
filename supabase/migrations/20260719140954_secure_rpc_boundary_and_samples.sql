-- Keep elevated implementations outside the Data API schema. Public RPC
-- functions below are SECURITY INVOKER wrappers with a narrow signature.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

create or replace function private.pay_merchant_debt(
  p_debt_id uuid,
  p_requested_amount integer
)
returns table (
  id uuid,
  paid_amount integer,
  new_amount integer,
  closed boolean,
  closed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_amount integer;
  effective_amount integer;
  remaining_amount integer;
  payment_closed boolean;
  payment_closed_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_requested_amount is null or p_requested_amount <= 0 or p_requested_amount > 100000 then
    raise exception 'Invalid payment amount' using errcode = '22023';
  end if;

  select debt.amount
  into current_amount
  from public.merchant_debts as debt
  where debt.id = p_debt_id and debt.closed = false
  for update;

  if not found then
    return;
  end if;

  effective_amount := least(p_requested_amount, current_amount);
  remaining_amount := current_amount - effective_amount;
  payment_closed := remaining_amount = 0;
  payment_closed_at := case when payment_closed then now() else null end;

  update public.merchant_debts as debt
  set amount = remaining_amount,
      closed = payment_closed,
      closed_at = payment_closed_at
  where debt.id = p_debt_id;

  return query
  select
    p_debt_id,
    effective_amount,
    remaining_amount,
    payment_closed,
    payment_closed_at;
end
$function$;

revoke all on function private.pay_merchant_debt(uuid, integer) from public, anon;
grant execute on function private.pay_merchant_debt(uuid, integer) to authenticated, service_role;

create or replace function public.pay_merchant_debt(
  p_debt_id uuid,
  p_requested_amount integer
)
returns table (
  id uuid,
  paid_amount integer,
  new_amount integer,
  closed boolean,
  closed_at timestamptz
)
language sql
security invoker
set search_path = ''
as $function$
  select *
  from private.pay_merchant_debt(p_debt_id, p_requested_amount);
$function$;

revoke all on function public.pay_merchant_debt(uuid, integer) from public, anon;
grant execute on function public.pay_merchant_debt(uuid, integer) to authenticated, service_role;

create or replace function private.get_leaderboard(p_limit integer default 10)
returns table (
  participant_id text,
  display_name text,
  city text,
  role text,
  total_xp integer,
  debts_paid integer,
  streak integer,
  is_current boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    substr(md5(snapshot.user_id::text), 1, 12),
    snapshot.display_name,
    snapshot.city,
    snapshot.role,
    snapshot.total_xp,
    snapshot.debts_paid,
    snapshot.streak,
    snapshot.user_id = (select auth.uid())
  from public.device_snapshots as snapshot
  where snapshot.total_xp > 0
  order by snapshot.total_xp desc, snapshot.first_seen asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
end
$function$;

revoke all on function private.get_leaderboard(integer) from public, anon;
grant execute on function private.get_leaderboard(integer) to authenticated, service_role;

create or replace function public.get_leaderboard(p_limit integer default 10)
returns table (
  participant_id text,
  display_name text,
  city text,
  role text,
  total_xp integer,
  debts_paid integer,
  streak integer,
  is_current boolean
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select *
  from private.get_leaderboard(p_limit);
$function$;

revoke all on function public.get_leaderboard(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated, service_role;

-- The existing project contains closed prototype history. Seed demo debts when
-- there is no open balance, rather than only when the whole table is empty.
insert into public.merchant_debts (
  user_id,
  merchant_name,
  city,
  title,
  description,
  category,
  amount,
  urgency,
  is_sample
)
select *
from (
  values
    (null::uuid, 'D-Zimem', 'İstanbul', 'Mahalle bakkalı veresiye borcu', 'Temel gıda alışverişinden kalan anonim borç.', 'gida', 480, 3, true),
    (null::uuid, 'D-Zimem', 'Ankara', 'Öğrenci kırtasiye borcu', 'Bir öğrencinin okul malzemeleri için kalan borcu.', 'egitim', 320, 2, true),
    (null::uuid, 'D-Zimem', 'İzmir', 'Elektrik faturası desteği', 'Ödeme güçlüğü yaşayan bir hanenin anonim faturası.', 'fatura', 760, 3, true),
    (null::uuid, 'D-Zimem', 'Bursa', 'Eczane ilaç borcu', 'Reçeteli ilaç alımından kalan anonim borç.', 'saglik', 540, 2, true)
) as samples(
  user_id,
  merchant_name,
  city,
  title,
  description,
  category,
  amount,
  urgency,
  is_sample
)
where not exists (
  select 1
  from public.merchant_debts
  where closed = false
);

-- Remove indexes left behind by the device-era setup. The canonical composite
-- and partial indexes were created by the previous migration.
drop index if exists public.idx_survey_device;
drop index if exists public.idx_merchant_closed;
drop index if exists public.idx_who5_device;
drop index if exists public.idx_who5_created;
