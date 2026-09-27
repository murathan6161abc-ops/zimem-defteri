-- D-Zimem 2.1 - canonical schema and authorization model.
--
-- This migration upgrades the original device-based prototype to Supabase Auth
-- ownership. It is intentionally safe for both the existing project and a new
-- empty project. Client applications receive only the privileges they need.

create extension if not exists pgcrypto with schema extensions;

-- Retire the two tables used by the static prototype. The production app uses
-- Supabase Auth, merchant_debts, and the research tables below.
drop table if exists public.debts cascade;
drop table if exists public.users cascade;

create table if not exists public.survey_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  display_name text,
  city text,
  debt_id text not null,
  debt_title text not null,
  debt_category text not null,
  debt_amount integer not null,
  debt_urgency smallint not null,
  debt_added_by text,
  pre_huzur smallint,
  pre_emotion text,
  pre_emotion_value smallint,
  pre_likert smallint,
  post_huzur smallint,
  post_emotion text,
  post_emotion_value smallint,
  post_likert smallint,
  will_repeat text,
  panas_neg_scores jsonb,
  panas_pos_scores jsonb,
  panas_neg_total integer,
  panas_pos_total integer,
  xp_gained integer not null default 0,
  app_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.device_snapshots (
  user_id uuid primary key,
  display_name text,
  role text,
  city text,
  total_xp integer not null default 0,
  debts_paid integer not null default 0,
  total_donated integer not null default 0,
  streak integer not null default 0,
  last_seen timestamptz not null default now(),
  first_seen timestamptz not null default now()
);

create table if not exists public.merchant_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  merchant_name text,
  city text,
  title text not null,
  description text,
  category text not null,
  amount integer not null,
  urgency smallint not null,
  closed boolean not null default false,
  closed_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.who5_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scores jsonb not null,
  total integer not null,
  created_at timestamptz not null default now()
);

-- Upgrade the old column name in-place when this migration runs against the
-- existing project.
do $migration$
declare
  target_table text;
begin
  foreach target_table in array array[
    'survey_submissions',
    'device_snapshots',
    'merchant_debts',
    'who5_measurements'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'device_id'
    ) and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'user_id'
    ) then
      execute format(
        'alter table public.%I rename column device_id to user_id',
        target_table
      );
    end if;
  end loop;
end
$migration$;

-- Columns introduced after the first prototype release.
alter table public.survey_submissions
  add column if not exists post_huzur smallint,
  add column if not exists panas_neg_scores jsonb,
  add column if not exists panas_pos_scores jsonb,
  add column if not exists panas_neg_total integer,
  add column if not exists panas_pos_total integer;

alter table public.merchant_debts
  add column if not exists is_sample boolean not null default false;

alter table public.survey_submissions alter column user_id set not null;
alter table public.device_snapshots alter column user_id set not null;
alter table public.who5_measurements alter column user_id set not null;
alter table public.merchant_debts alter column user_id drop not null;

-- The prototype accepted random device UUIDs before Supabase Auth was added.
-- Keep those historical merchant rows, but detach their non-account identifier
-- before adding the Auth foreign key. They remain readable as system history.
update public.merchant_debts as debt
set user_id = null
where debt.user_id is not null
  and not exists (
    select 1
    from auth.users as account
    where account.id = debt.user_id
  );

-- Replace inherited prototype checks with one named, reviewable set.
do $checks$
declare
  item record;
begin
  for item in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in (
        'public.survey_submissions'::regclass,
        'public.device_snapshots'::regclass,
        'public.merchant_debts'::regclass,
        'public.who5_measurements'::regclass
      )
  loop
    execute format('alter table %s drop constraint %I', item.table_name, item.conname);
  end loop;
end
$checks$;

alter table public.survey_submissions
  drop constraint if exists survey_submissions_user_id_fkey,
  add constraint survey_submissions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint survey_debt_id_check
    check (char_length(debt_id) between 1 and 100),
  add constraint survey_debt_title_check
    check (char_length(debt_title) between 1 and 120),
  add constraint survey_category_check
    check (debt_category in ('gida', 'egitim', 'fatura', 'saglik')),
  add constraint survey_amount_check
    check (debt_amount between 1 and 100000),
  add constraint survey_urgency_check
    check (debt_urgency between 1 and 3),
  add constraint survey_pre_huzur_check
    check (pre_huzur is null or pre_huzur between 1 and 10),
  add constraint survey_post_huzur_check
    check (post_huzur is null or post_huzur between 1 and 10),
  add constraint survey_pre_emotion_check
    check (pre_emotion is null or pre_emotion in ('merak', 'sorumluluk', 'huzur', 'heyecan')),
  add constraint survey_post_emotion_check
    check (post_emotion is null or post_emotion in ('mutlu', 'dingin', 'hafiflemis', 'gururlu')),
  add constraint survey_pre_emotion_value_check
    check (pre_emotion_value is null or pre_emotion_value between 1 and 4),
  add constraint survey_post_emotion_value_check
    check (post_emotion_value is null or post_emotion_value between 1 and 4),
  add constraint survey_pre_likert_check
    check (pre_likert is null or pre_likert between 1 and 5),
  add constraint survey_post_likert_check
    check (post_likert is null or post_likert between 1 and 5),
  add constraint survey_will_repeat_check
    check (will_repeat is null or will_repeat in ('evet', 'belki', 'bilmiyorum')),
  add constraint survey_panas_neg_total_check
    check (panas_neg_total is null or panas_neg_total between 0 and 25),
  add constraint survey_panas_pos_total_check
    check (panas_pos_total is null or panas_pos_total between 0 and 25),
  add constraint survey_xp_check
    check (xp_gained between 0 and 1000),
  add constraint survey_display_name_check
    check (display_name is null or char_length(display_name) between 1 and 80),
  add constraint survey_city_check
    check (city is null or char_length(city) between 1 and 80);

alter table public.device_snapshots
  drop constraint if exists device_snapshots_user_id_fkey,
  add constraint device_snapshots_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint snapshot_display_name_check
    check (display_name is null or char_length(display_name) between 1 and 80),
  add constraint snapshot_role_check
    check (role is null or role in ('vatandas', 'esnaf')),
  add constraint snapshot_city_check
    check (city is null or char_length(city) between 1 and 80),
  add constraint snapshot_xp_check
    check (total_xp between 0 and 1000000),
  add constraint snapshot_debts_paid_check
    check (debts_paid between 0 and 100000),
  add constraint snapshot_total_donated_check
    check (total_donated between 0 and 100000000),
  add constraint snapshot_streak_check
    check (streak between 0 and 3650);

alter table public.merchant_debts
  drop constraint if exists merchant_debts_user_id_fkey,
  add constraint merchant_debts_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null,
  add constraint merchant_title_check
    check (char_length(title) between 3 and 100),
  add constraint merchant_description_check
    check (description is null or char_length(description) between 3 and 500),
  add constraint merchant_name_check
    check (merchant_name is null or char_length(merchant_name) between 2 and 80),
  add constraint merchant_city_check
    check (city is null or char_length(city) between 1 and 80),
  add constraint merchant_category_check
    check (category in ('gida', 'egitim', 'fatura', 'saglik')),
  add constraint merchant_amount_check
    check (amount between 0 and 100000),
  add constraint merchant_urgency_check
    check (urgency between 1 and 3),
  add constraint merchant_state_check
    check (
      (closed = false and amount > 0 and closed_at is null)
      or (closed = true and amount = 0 and closed_at is not null)
    );

alter table public.who5_measurements
  drop constraint if exists who5_measurements_user_id_fkey,
  add constraint who5_measurements_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint who5_scores_check
    check (jsonb_typeof(scores) = 'object'),
  add constraint who5_total_check
    check (total between 0 and 100);

create index if not exists idx_survey_user_created
  on public.survey_submissions (user_id, created_at desc);
create index if not exists idx_survey_created
  on public.survey_submissions (created_at desc);
create index if not exists idx_survey_category
  on public.survey_submissions (debt_category);
create index if not exists idx_snapshot_xp
  on public.device_snapshots (total_xp desc)
  where total_xp > 0;
create index if not exists idx_merchant_open
  on public.merchant_debts (urgency desc, created_at desc)
  where closed = false;
create index if not exists idx_merchant_user_created
  on public.merchant_debts (user_id, created_at desc)
  where user_id is not null;
create index if not exists idx_who5_user_created
  on public.who5_measurements (user_id, created_at desc);

alter table public.survey_submissions enable row level security;
alter table public.device_snapshots enable row level security;
alter table public.merchant_debts enable row level security;
alter table public.who5_measurements enable row level security;

-- Remove every prototype policy, regardless of the name used by an earlier
-- manual setup script.
do $policies$
declare
  item record;
begin
  for item in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'survey_submissions',
        'device_snapshots',
        'merchant_debts',
        'who5_measurements'
      )
  loop
    execute format(
      'drop policy %I on public.%I',
      item.policyname,
      item.tablename
    );
  end loop;
end
$policies$;

create policy survey_select_owner_or_admin
  on public.survey_submissions
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      (select auth.uid()) = user_id
      or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
    )
  );

create policy survey_insert_owner
  on public.survey_submissions
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy snapshot_select_owner_or_admin
  on public.device_snapshots
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      (select auth.uid()) = user_id
      or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
    )
  );

create policy snapshot_insert_owner
  on public.device_snapshots
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy snapshot_update_owner
  on public.device_snapshots
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy merchant_select_authenticated
  on public.merchant_debts
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy merchant_insert_owner
  on public.merchant_debts
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and is_sample = false
    and closed = false
    and amount > 0
  );

create policy who5_select_owner_or_admin
  on public.who5_measurements
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      (select auth.uid()) = user_id
      or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
    )
  );

create policy who5_insert_owner
  on public.who5_measurements
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- Remove the broad default grants that made RLS mistakes catastrophic, then
-- expose only the operations required by the client.
revoke all on table public.survey_submissions from anon, authenticated;
revoke all on table public.device_snapshots from anon, authenticated;
revoke all on table public.merchant_debts from anon, authenticated;
revoke all on table public.who5_measurements from anon, authenticated;

grant select, insert on table public.survey_submissions to authenticated;
grant select, insert, update on table public.device_snapshots to authenticated;
grant select, insert on table public.merchant_debts to authenticated;
grant select, insert on table public.who5_measurements to authenticated;

grant all on table public.survey_submissions to service_role;
grant all on table public.device_snapshots to service_role;
grant all on table public.merchant_debts to service_role;
grant all on table public.who5_measurements to service_role;

-- Atomic payment endpoint. Direct UPDATE access to merchant_debts remains
-- revoked, so a client cannot rewrite titles, ownership, or balances.
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

revoke all on function public.pay_merchant_debt(uuid, integer) from public, anon;
grant execute on function public.pay_merchant_debt(uuid, integer) to authenticated, service_role;

-- A narrow leaderboard endpoint avoids exposing account UUIDs or every snapshot
-- column while still allowing signed-in users to view the public ranking.
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

revoke all on function public.get_leaderboard(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated, service_role;

-- Seed demo content once on a fresh/empty database. Samples are system-owned;
-- users cannot create rows with is_sample=true through the API.
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
where not exists (select 1 from public.merchant_debts);

alter table public.merchant_debts replica identity full;

do $realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'merchant_debts'
  ) then
    alter publication supabase_realtime add table public.merchant_debts;
  end if;
end
$realtime$;
