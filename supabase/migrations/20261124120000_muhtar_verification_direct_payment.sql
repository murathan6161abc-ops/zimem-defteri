-- D-Zimem — Muhtar doğrulaması ve esnafa doğrudan gerçek ödeme
-- ============================================================================
-- 1) Muhtar doğrulaması: borcu muhtar yerinde teyit eder, imzalı/mühürlü kâğıt
--    formu doldurur; yönetici formu görüp borcu "verified" (onaylı) ya da
--    "rejected" (reddedildi) olarak işaretler.
--      merchant_debts.verification_status / verified_at → herkes görür (rozet)
--      private.debt_verifications → muhtarlık ve form no; YALNIZCA yönetici görür
-- 2) Gerçek ödeme: PARA UYGULAMADAN GEÇMEZ. Vatandaş onaylı bir borcu üstlenir
--    (debt_pledges), bir ödeme kodu alır, parayı dükkânda ya da esnafın IBAN'ına
--    doğrudan öder. Borç ancak esnaf "parayı aldım" deyince azalır/kapanır.
--      merchant_payment_info → esnafın IBAN'ı; yalnızca sahibi okur, ödeme
--      taahhüdü veren kişiye RPC ile gösterilir
--    Havale yapan kişi "Parayı gönderdim" der (sent_at): esnafın ekranında öne çıkar,
--    artık iptal edilemez ve 7 gün sonra serbest kalmaz.
-- 3) Onaylı borçlar simülasyon ödemesiyle (pay_merchant_debt) KAPATILAMAZ:
--    gerçek bir aile borcu, para ödenmeden "kapandı" görünmesin.
--
-- Gerçek ödeme yalnızca 18 yaş ve üzeri hesaplara açıktır (kayıtta beyan edilen
-- user_metadata.ageGroup = 'adult'). Gerçek ödemeler araştırma verisine
-- (survey_submissions) yazılmaz.
-- Tekrar çalıştırılabilir. Uygulama bu göç çalıştırılmadan da açılır; yalnızca
-- muhtar rozeti ve gerçek ödeme görünmez.
-- ============================================================================

-- ─── 1. Doğrulama durumu ────────────────────────────────────────────────────
alter table public.merchant_debts
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verified_at timestamptz;

alter table public.merchant_debts
  drop constraint if exists merchant_verification_status_check,
  add constraint merchant_verification_status_check
    check (verification_status in ('pending', 'verified', 'rejected'));

comment on column public.merchant_debts.verification_status is
  'Muhtar doğrulaması: pending (bekliyor) | verified (muhtar onaylı) | rejected (reddedildi). Yalnızca yönetici değiştirir.';

-- Esnaf borç eklerken durumu kendisi "verified" yazamasın. (Tabloya UPDATE yetkisi
-- zaten yok; değişiklik yalnızca aşağıdaki yönetici RPC'siyle yapılır.)
create or replace function private.force_pending_verification()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  -- SQL Editor / service_role (auth.uid() yok) ve yönetici serbest.
  if (select auth.uid()) is not null
     and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin' then
    new.verification_status := 'pending';
    new.verified_at := null;
  end if;
  return new;
end
$function$;

revoke all on function private.force_pending_verification() from public, anon, authenticated;

drop trigger if exists dzimem_force_pending_verification on public.merchant_debts;
create trigger dzimem_force_pending_verification
  before insert on public.merchant_debts
  for each row execute function private.force_pending_verification();

-- Muhtarlık ve form numarası: borçlunun mahallesini daraltabileceği için ayrı,
-- yalnızca yöneticinin okuyabildiği tabloda.
create table if not exists private.debt_verifications (
  debt_id uuid primary key references public.merchant_debts(id) on delete cascade,
  status text not null check (status in ('verified', 'rejected')),
  reference text not null check (char_length(reference) between 3 and 160),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now()
);

revoke all on table private.debt_verifications from public, anon, authenticated;

-- ─── 2. Esnafın ödeme bilgisi (IBAN) ────────────────────────────────────────
create table if not exists public.merchant_payment_info (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  iban text not null check (iban ~ '^TR[0-9]{24}$'),
  account_holder text not null check (char_length(account_holder) between 2 and 80),
  updated_at timestamptz not null default now()
);

alter table public.merchant_payment_info enable row level security;

drop policy if exists payment_info_owner on public.merchant_payment_info;
create policy payment_info_owner
  on public.merchant_payment_info
  for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists mfa_required on public.merchant_payment_info;
create policy mfa_required
  on public.merchant_payment_info
  as restrictive
  for all
  to authenticated
  using ((select private.mfa_satisfied()))
  with check ((select private.mfa_satisfied()));

revoke all on table public.merchant_payment_info from anon, authenticated;
grant select, insert, update, delete on table public.merchant_payment_info to authenticated;
grant all on table public.merchant_payment_info to service_role;

-- ─── 3. Ödeme taahhütleri ───────────────────────────────────────────────────
create table if not exists public.debt_pledges (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.merchant_debts(id) on delete cascade,
  -- Ödeyen hesabını silerse kayıt kalır (esnafın defteri için), kimlik silinir.
  payer_id uuid references auth.users(id) on delete set null,
  amount integer not null check (amount between 1 and 100000),
  code text not null unique check (code ~ '^DZ-[A-Z0-9]{6}$'),
  method text not null check (method in ('dukkan', 'havale')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  -- Ödeyen "Parayı gönderdim" dediği an (yalnızca havale).
  sent_at timestamptz,
  resolved_at timestamptz
);

-- Bu dosyanın ilk sürümünü çalıştırmış veritabanı için.
alter table public.debt_pledges add column if not exists sent_at timestamptz;

create index if not exists debt_pledges_debt_status_idx on public.debt_pledges (debt_id, status);
create index if not exists debt_pledges_payer_idx on public.debt_pledges (payer_id, created_at desc);

alter table public.debt_pledges enable row level security;

-- Ödeyen kendi taahhüdünü, esnaf kendi borçlarına gelenleri, yönetici hepsini görür.
drop policy if exists pledge_select_party on public.debt_pledges;
create policy pledge_select_party
  on public.debt_pledges
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      payer_id = (select auth.uid())
      or exists (
        select 1 from public.merchant_debts as debt
        where debt.id = debt_pledges.debt_id and debt.user_id = (select auth.uid())
      )
      or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
    )
  );

drop policy if exists mfa_required on public.debt_pledges;
create policy mfa_required
  on public.debt_pledges
  as restrictive
  for all
  to authenticated
  using ((select private.mfa_satisfied()))
  with check ((select private.mfa_satisfied()));

-- Yazma yalnızca RPC'lerle.
revoke all on table public.debt_pledges from anon, authenticated;
grant select on table public.debt_pledges to authenticated;
grant all on table public.debt_pledges to service_role;

-- Esnaf yeni taahhüdü anında görsün.
alter table public.debt_pledges replica identity full;
do $realtime$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'debt_pledges'
  ) then
    alter publication supabase_realtime add table public.debt_pledges;
  end if;
exception
  when undefined_object then null; -- yayın yoksa (yerel test) atla
end
$realtime$;

-- Bekleyen taahhüt 7 gün sonra borcun "ayrılmış" tutarından düşülür (esnaf yine
-- de onaylayabilir). "Gönderdim" denmiş havale süresiz ayrılmış kalır: para yolda
-- olabilir, aynı borca ikinci kez para gitmesin.
create or replace function private.reserved_pledge_amount(p_debt_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(sum(pledge.amount), 0)::integer
  from public.debt_pledges as pledge
  where pledge.debt_id = p_debt_id
    and pledge.status = 'pending'
    and (pledge.sent_at is not null or pledge.created_at > now() - interval '7 days');
$function$;

revoke all on function private.reserved_pledge_amount(uuid) from public, anon, authenticated;

-- Bekleyen ödemesi olan borç silinemez: bağışçı parayı göndermiş olabilir. Esnaf önce
-- ödemeyi "aldım" ya da "almadım" diye sonuçlandırır.
create or replace function private.has_pending_pledges(p_debt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.debt_pledges as pledge
    where pledge.debt_id = p_debt_id and pledge.status = 'pending'
  );
$function$;

revoke all on function private.has_pending_pledges(uuid) from public, anon;
grant execute on function private.has_pending_pledges(uuid) to authenticated, service_role;

drop policy if exists merchant_delete_owner on public.merchant_debts;
create policy merchant_delete_owner
  on public.merchant_debts
  for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and closed = false
    and is_sample = false
    and not private.has_pending_pledges(id)
  );

-- ─── 4. Simülasyon ödemesi onaylı borçları kapatamaz ───────────────────────
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
  where debt.id = p_debt_id
    and debt.closed = false
    and debt.verification_status = 'pending'
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

-- ─── 5. Yönetici: muhtar kararını işle ──────────────────────────────────────
create or replace function private.set_debt_verification(
  p_debt_id uuid,
  p_status text,
  p_reference text
)
returns table (id uuid, verification_status text, verified_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  ref text := btrim(coalesce(p_reference, ''));
  decided timestamptz := now();
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if not private.mfa_satisfied() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  if p_status not in ('verified', 'rejected', 'pending') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if p_status <> 'pending' and char_length(ref) not between 3 and 160 then
    raise exception 'Reference required' using errcode = '22023';
  end if;

  -- Örnek borçlar ve sahibi olmayan borçlar gerçek ödemeye açılamaz.
  if p_status = 'verified' and exists (
    select 1 from public.merchant_debts as debt
    where debt.id = p_debt_id and (debt.is_sample or debt.user_id is null)
  ) then
    raise exception 'Sample debts cannot be verified' using errcode = '22023';
  end if;

  update public.merchant_debts as debt
  set verification_status = p_status,
      verified_at = case when p_status = 'verified' then decided else null end
  where debt.id = p_debt_id;

  if not found then
    return;
  end if;

  if p_status = 'pending' then
    delete from private.debt_verifications where debt_id = p_debt_id;
  else
    insert into private.debt_verifications (debt_id, status, reference, decided_by, decided_at)
    values (p_debt_id, p_status, ref, (select auth.uid()), decided)
    on conflict (debt_id) do update
      set status = excluded.status,
          reference = excluded.reference,
          decided_by = excluded.decided_by,
          decided_at = excluded.decided_at;
  end if;

  -- Onayı kalkan borçtaki bekleyen taahhütler iptal edilir.
  if p_status <> 'verified' then
    update public.debt_pledges as pledge
    set status = 'cancelled', resolved_at = decided
    where pledge.debt_id = p_debt_id and pledge.status = 'pending';
  end if;

  return query
  select debt.id, debt.verification_status, debt.verified_at
  from public.merchant_debts as debt
  where debt.id = p_debt_id;
end
$function$;

revoke all on function private.set_debt_verification(uuid, text, text) from public, anon;
grant execute on function private.set_debt_verification(uuid, text, text) to authenticated, service_role;

create or replace function public.set_debt_verification(
  p_debt_id uuid,
  p_status text,
  p_reference text
)
returns table (id uuid, verification_status text, verified_at timestamptz)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.set_debt_verification(p_debt_id, p_status, p_reference);
$function$;

revoke all on function public.set_debt_verification(uuid, text, text) from public, anon;
grant execute on function public.set_debt_verification(uuid, text, text) to authenticated, service_role;

-- Yönetici: muhtarlık / form no kayıtlarını oku.
create or replace function private.list_debt_verifications()
returns table (debt_id uuid, status text, reference text, decided_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if not private.mfa_satisfied() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  return query
  select v.debt_id, v.status, v.reference, v.decided_at
  from private.debt_verifications as v
  order by v.decided_at desc;
end
$function$;

revoke all on function private.list_debt_verifications() from public, anon;
grant execute on function private.list_debt_verifications() to authenticated, service_role;

create or replace function public.list_debt_verifications()
returns table (debt_id uuid, status text, reference text, decided_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.list_debt_verifications();
$function$;

revoke all on function public.list_debt_verifications() from public, anon;
grant execute on function public.list_debt_verifications() to authenticated, service_role;

-- ─── 6. Vatandaş: ödeme taahhüdü oluştur ────────────────────────────────────
create or replace function private.create_debt_pledge(
  p_debt_id uuid,
  p_amount integer,
  p_method text
)
returns table (
  id uuid,
  code text,
  amount integer,
  method text,
  status text,
  created_at timestamptz,
  merchant_name text,
  city text,
  iban text,
  account_holder text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  payer uuid := (select auth.uid());
  debt_row public.merchant_debts%rowtype;
  info public.merchant_payment_info%rowtype;
  available integer;
  new_code text;
  new_id uuid;
  new_created timestamptz;
begin
  if payer is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not private.mfa_satisfied() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt()) -> 'user_metadata' ->> 'ageGroup', '') <> 'adult' then
    raise exception 'adult_only' using errcode = '42501';
  end if;
  if p_method not in ('dukkan', 'havale') then
    raise exception 'Invalid method' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    raise exception 'Invalid payment amount' using errcode = '22023';
  end if;

  select * into debt_row
  from public.merchant_debts as debt
  where debt.id = p_debt_id
  for update;

  if not found
     or debt_row.closed
     or debt_row.verification_status <> 'verified'
     or debt_row.is_sample
     or debt_row.user_id is null then
    raise exception 'not_payable' using errcode = 'P0001';
  end if;
  if debt_row.user_id = payer then
    raise exception 'own_debt' using errcode = 'P0001';
  end if;

  -- Kötüye kullanıma karşı: bir kişinin aynı anda en çok 3 bekleyen taahhüdü olur.
  if (
    select count(*) from public.debt_pledges as pledge
    where pledge.payer_id = payer and pledge.status = 'pending'
      and (pledge.sent_at is not null or pledge.created_at > now() - interval '7 days')
  ) >= 3 then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;

  available := debt_row.amount - private.reserved_pledge_amount(p_debt_id);
  if p_amount > available then
    raise exception 'amount_exceeds_available:%', greatest(available, 0) using errcode = 'P0001';
  end if;

  select * into info from public.merchant_payment_info as pi where pi.user_id = debt_row.user_id;
  if p_method = 'havale' and not found then
    raise exception 'no_iban' using errcode = 'P0001';
  end if;

  loop
    -- 6 onaltılık karakter (0-9, A-F): 16 milyon olasılık, uzantı gerektirmez.
    new_code := 'DZ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.debt_pledges as pledge where pledge.code = new_code);
  end loop;

  insert into public.debt_pledges (debt_id, payer_id, amount, code, method)
  values (p_debt_id, payer, p_amount, new_code, p_method)
  returning debt_pledges.id, debt_pledges.created_at into new_id, new_created;

  return query
  select
    new_id,
    new_code,
    p_amount,
    p_method,
    'pending'::text,
    new_created,
    debt_row.merchant_name,
    debt_row.city,
    case when p_method = 'havale' then info.iban else null end,
    case when p_method = 'havale' then info.account_holder else null end;
end
$function$;

revoke all on function private.create_debt_pledge(uuid, integer, text) from public, anon;
grant execute on function private.create_debt_pledge(uuid, integer, text) to authenticated, service_role;

create or replace function public.create_debt_pledge(
  p_debt_id uuid,
  p_amount integer,
  p_method text
)
returns table (
  id uuid,
  code text,
  amount integer,
  method text,
  status text,
  created_at timestamptz,
  merchant_name text,
  city text,
  iban text,
  account_holder text
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.create_debt_pledge(p_debt_id, p_amount, p_method);
$function$;

revoke all on function public.create_debt_pledge(uuid, integer, text) from public, anon;
grant execute on function public.create_debt_pledge(uuid, integer, text) to authenticated, service_role;

-- Havale için IBAN'ı yeniden göster (ödeyen, kendi bekleyen taahhüdü için).
create or replace function private.pledge_payment_details(p_pledge_id uuid)
returns table (iban text, account_holder text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not private.mfa_satisfied() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  return query
  select info.iban, info.account_holder
  from public.debt_pledges as pledge
  join public.merchant_debts as debt on debt.id = pledge.debt_id
  join public.merchant_payment_info as info on info.user_id = debt.user_id
  where pledge.id = p_pledge_id
    and pledge.payer_id = (select auth.uid())
    and pledge.status = 'pending'
    and pledge.method = 'havale';
end
$function$;

revoke all on function private.pledge_payment_details(uuid) from public, anon;
grant execute on function private.pledge_payment_details(uuid) to authenticated, service_role;

create or replace function public.pledge_payment_details(p_pledge_id uuid)
returns table (iban text, account_holder text)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.pledge_payment_details(p_pledge_id);
$function$;

revoke all on function public.pledge_payment_details(uuid) from public, anon;
grant execute on function public.pledge_payment_details(uuid) to authenticated, service_role;

-- ─── 7. Vatandaş: bekleyen taahhüdünü iptal et ──────────────────────────────
create or replace function private.cancel_debt_pledge(p_pledge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not private.mfa_satisfied() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  -- "Gönderdim" denmiş ödeme iptal edilemez: para esnafa ulaşmış olabilir.
  update public.debt_pledges as pledge
  set status = 'cancelled', resolved_at = now()
  where pledge.id = p_pledge_id
    and pledge.payer_id = (select auth.uid())
    and pledge.status = 'pending'
    and pledge.sent_at is null;
  return found;
end
$function$;

revoke all on function private.cancel_debt_pledge(uuid) from public, anon;
grant execute on function private.cancel_debt_pledge(uuid) to authenticated, service_role;

create or replace function public.cancel_debt_pledge(p_pledge_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.cancel_debt_pledge(p_pledge_id);
$function$;

revoke all on function public.cancel_debt_pledge(uuid) from public, anon;
grant execute on function public.cancel_debt_pledge(uuid) to authenticated, service_role;

-- ─── 7b. Vatandaş: "Parayı gönderdim" (havale) ─────────────────────────────
create or replace function private.mark_pledge_sent(p_pledge_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  marked timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not private.mfa_satisfied() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  update public.debt_pledges as pledge
  set sent_at = coalesce(pledge.sent_at, now())
  where pledge.id = p_pledge_id
    and pledge.payer_id = (select auth.uid())
    and pledge.status = 'pending'
    and pledge.method = 'havale'
  returning pledge.sent_at into marked;
  return marked;
end
$function$;

revoke all on function private.mark_pledge_sent(uuid) from public, anon;
grant execute on function private.mark_pledge_sent(uuid) to authenticated, service_role;

create or replace function public.mark_pledge_sent(p_pledge_id uuid)
returns timestamptz
language sql
security invoker
set search_path = ''
as $function$
  select private.mark_pledge_sent(p_pledge_id);
$function$;

revoke all on function public.mark_pledge_sent(uuid) from public, anon;
grant execute on function public.mark_pledge_sent(uuid) to authenticated, service_role;

-- ─── 8. Esnaf: "parayı aldım" / "almadım" ──────────────────────────────────
create or replace function private.resolve_debt_pledge(
  p_pledge_id uuid,
  p_received boolean
)
returns table (
  pledge_id uuid,
  pledge_status text,
  debt_id uuid,
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
  pledge_row public.debt_pledges%rowtype;
  current_amount integer;
  is_closed boolean;
  effective_amount integer := 0;
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
  if p_received is null then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  select pledge.* into pledge_row
  from public.debt_pledges as pledge
  join public.merchant_debts as debt on debt.id = pledge.debt_id
  where pledge.id = p_pledge_id
    and pledge.status = 'pending'
    and debt.user_id = (select auth.uid())
  for update of pledge;

  if not found then
    return;
  end if;

  select debt.amount, debt.closed into current_amount, is_closed
  from public.merchant_debts as debt
  where debt.id = pledge_row.debt_id
  for update;

  if p_received and not is_closed then
    effective_amount := least(pledge_row.amount, current_amount);
    remaining_amount := current_amount - effective_amount;
    payment_closed := remaining_amount = 0;
    payment_closed_at := case when payment_closed then now() else null end;

    update public.merchant_debts as debt
    set amount = remaining_amount,
        closed = payment_closed,
        closed_at = payment_closed_at
    where debt.id = pledge_row.debt_id;
  else
    remaining_amount := current_amount;
    payment_closed := is_closed;
    select debt.closed_at into payment_closed_at
    from public.merchant_debts as debt where debt.id = pledge_row.debt_id;
  end if;

  update public.debt_pledges as pledge
  set status = case when p_received then 'confirmed' else 'rejected' end,
      resolved_at = now()
  where pledge.id = p_pledge_id;

  -- Borç kapandıysa diğer bekleyen taahhütler iptal: kimse kapanmış borca para yollamasın.
  if payment_closed then
    update public.debt_pledges as pledge
    set status = 'cancelled', resolved_at = now()
    where pledge.debt_id = pledge_row.debt_id and pledge.status = 'pending';
  end if;

  return query
  select
    p_pledge_id,
    case when p_received then 'confirmed' else 'rejected' end,
    pledge_row.debt_id,
    effective_amount,
    remaining_amount,
    payment_closed,
    payment_closed_at;
end
$function$;

revoke all on function private.resolve_debt_pledge(uuid, boolean) from public, anon;
grant execute on function private.resolve_debt_pledge(uuid, boolean) to authenticated, service_role;

create or replace function public.resolve_debt_pledge(
  p_pledge_id uuid,
  p_received boolean
)
returns table (
  pledge_id uuid,
  pledge_status text,
  debt_id uuid,
  paid_amount integer,
  new_amount integer,
  closed boolean,
  closed_at timestamptz
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.resolve_debt_pledge(p_pledge_id, p_received);
$function$;

revoke all on function public.resolve_debt_pledge(uuid, boolean) from public, anon;
grant execute on function public.resolve_debt_pledge(uuid, boolean) to authenticated, service_role;

-- API'nin yeni sütun ve fonksiyonları hemen görmesi için şema önbelleğini yenile.
notify pgrst, 'reload schema';
