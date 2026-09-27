-- D-Zimem — Hesap güvenliği: 2 adımlı doğrulama zorunluluğu + kullanıcı adı koruması
-- ============================================================================
-- 1) 2FA (TOTP) açık hesaplar için veri erişimi yalnızca aal2 oturumla mümkündür.
--    Şifre ya da e-posta sıfırlama kodu tek başına aal1 verir → hiçbir tabloya
--    erişemez. Yani şifre sıfırlamak 2FA'yı atlatmaz. Bu kontrol istemcide DEĞİL,
--    burada (RLS "restrictive" politika) uygulanır.
-- 2) Kurtarma e-postası eklenince auth e-postası kullanici@dzimem.app'ten gerçek
--    adrese geçer. Tetikleyiciler o kullanıcı adını sahibine ayırır: başkası aynı
--    adla kayıt olamaz ya da e-postasını o sentetik adrese çeviremez.
-- ============================================================================

-- ─── 1. 2FA zorunluluğu ─────────────────────────────────────────────────────
create or replace function private.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1
      from auth.mfa_factors as factor
      where factor.user_id = (select auth.uid())
        and factor.status = 'verified'
    );
$function$;

revoke all on function private.mfa_satisfied() from public, anon;
grant execute on function private.mfa_satisfied() to authenticated, service_role;

do $mfa$
declare
  target_table text;
begin
  foreach target_table in array array[
    'survey_submissions',
    'device_snapshots',
    'merchant_debts',
    'who5_measurements',
    'scan_jobs'
  ]
  loop
    execute format('drop policy if exists mfa_required on public.%I', target_table);
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated '
      || 'using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()))',
      target_table
    );
  end loop;
end
$mfa$;

-- Ödeme RPC'si SECURITY DEFINER olduğu için RLS'i atlar → kontrolü içine ekle.
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

  if not private.mfa_satisfied() then
    raise exception 'Two-factor verification required' using errcode = '42501';
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

-- ─── 2. Kullanıcı adı koruması ──────────────────────────────────────────────
create table if not exists private.reserved_usernames (
  username text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.reserved_usernames from public, anon, authenticated;

-- Sentetik e-postadan gerçek e-postaya geçişte kullanıcı adını sahibine ayır.
create or replace function private.reserve_username_on_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.email is distinct from new.email
     and old.email like '%@dzimem.app'
     and (new.email is null or new.email not like '%@dzimem.app') then
    insert into private.reserved_usernames (username, user_id)
    values (split_part(old.email, '@', 1), new.id)
    on conflict (username) do nothing;
  end if;
  return new;
end
$function$;

-- Sentetik adres yalnızca (a) yeni kayıtta ayrılmamış bir ad için ya da
-- (b) sahibinin kendi kullanıcı adına geri dönüşü için kullanılabilir.
-- Böylece kimse e-postasını başkasının kullanici@dzimem.app adresine çevirip
-- o kullanıcı adıyla giriş yapamaz.
create or replace function private.guard_synthetic_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  local_part text;
begin
  if new.email is null or new.email not like '%@dzimem.app' then
    return new;
  end if;

  local_part := split_part(new.email, '@', 1);

  if tg_op = 'INSERT' then
    if exists (
      select 1 from private.reserved_usernames as r
      where r.username = local_part
    ) then
      raise exception 'Username is reserved' using errcode = '23505';
    end if;
    return new;
  end if;

  if old.email is distinct from new.email and not exists (
    select 1 from private.reserved_usernames as r
    where r.username = local_part and r.user_id = new.id
  ) then
    raise exception 'Synthetic address is not available' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function private.reserve_username_on_email_change() from public, anon, authenticated;
revoke all on function private.guard_synthetic_email() from public, anon, authenticated;

drop trigger if exists dzimem_reserve_username on auth.users;
create trigger dzimem_reserve_username
  after update of email on auth.users
  for each row execute function private.reserve_username_on_email_change();

drop trigger if exists dzimem_guard_synthetic_email on auth.users;
create trigger dzimem_guard_synthetic_email
  before insert or update of email on auth.users
  for each row execute function private.guard_synthetic_email();
