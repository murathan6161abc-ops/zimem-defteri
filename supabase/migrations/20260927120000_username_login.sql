-- D-Zimem — Kurtarma e-postası eklemiş hesaplarda kullanıcı adıyla da giriş
-- ============================================================================
-- Kullanıcı-adı hesabına kurtarma e-postası eklenince auth e-postası gerçek
-- adrese geçer; Supabase girişi e-posta ister. Bu fonksiyon kullanıcı adını
-- e-postaya çevirir — AMA e-postayı YALNIZCA şifre doğruysa döndürür:
--   * yanlış şifre / olmayan kullanıcı adı → null (kimin e-postası olduğu sızmaz)
--   * kullanıcı adı başına 15 dk'da 5, IP başına 30 hatalı deneme → HTTP 429
--   * olmayan kullanıcı adında da bcrypt çalıştırılır (süre farkından bilgi sızmaz)
-- Dönen e-postayla istemci normal Supabase girişini yapar; 2FA vb. aynen geçerli.
-- ============================================================================

create table if not exists private.login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_username on private.login_attempts (username, created_at desc);
create index if not exists idx_login_attempts_ip on private.login_attempts (ip, created_at desc);

revoke all on table private.login_attempts from public, anon, authenticated;

-- Tetikleyiciden (20260926130000) önce e-posta eklemiş hesapları da kaydet.
insert into private.reserved_usernames (username, user_id)
select lower(account.raw_user_meta_data ->> 'username'), account.id
from auth.users as account
where account.email not like '%@dzimem.app'
  and lower(account.raw_user_meta_data ->> 'username') ~ '^[a-z0-9_]{3,20}$'
  and not exists (
    select 1 from auth.users as other
    where other.email = lower(account.raw_user_meta_data ->> 'username') || '@dzimem.app'
  )
on conflict (username) do nothing;

create or replace function public.resolve_login_email(p_username text, p_password text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_headers jsonb;
  v_ip text := '';
  v_email text;
  v_hash text;
begin
  if v_username !~ '^[a-z0-9_]{3,20}$'
     or p_password is null
     or char_length(p_password) not between 6 and 200 then
    return null;
  end if;

  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
    v_ip := btrim(split_part(coalesce(
      v_headers ->> 'cf-connecting-ip',
      v_headers ->> 'x-real-ip',
      v_headers ->> 'x-forwarded-for',
      ''
    ), ',', 1));
  exception when others then
    v_ip := '';
  end;

  delete from private.login_attempts where created_at < now() - interval '1 day';

  if (
    select count(*) from private.login_attempts as attempt
    where attempt.username = v_username and attempt.created_at > now() - interval '15 minutes'
  ) >= 5
  or (
    v_ip <> '' and (
      select count(*) from private.login_attempts as attempt
      where attempt.ip = v_ip and attempt.created_at > now() - interval '15 minutes'
    ) >= 30
  ) then
    raise exception 'Too many login attempts' using errcode = 'PT429';
  end if;

  select account.email, account.encrypted_password
  into v_email, v_hash
  from private.reserved_usernames as reserved
  join auth.users as account on account.id = reserved.user_id
  where reserved.username = v_username;

  if v_hash is null or v_hash = '' then
    -- Süre eşitleme: olmayan kullanıcı adı da bir bcrypt kadar sürsün.
    perform extensions.crypt(p_password, extensions.gen_salt('bf', 10));
    insert into private.login_attempts (username, ip) values (v_username, nullif(v_ip, ''));
    return null;
  end if;

  if extensions.crypt(p_password, v_hash) = v_hash then
    return v_email;
  end if;

  insert into private.login_attempts (username, ip) values (v_username, nullif(v_ip, ''));
  return null;
end
$function$;

revoke all on function public.resolve_login_email(text, text) from public;
grant execute on function public.resolve_login_email(text, text) to anon, authenticated;
