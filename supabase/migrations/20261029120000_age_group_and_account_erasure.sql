-- Araştırma etiği: yaş grubu (18 yaş altı / 18 yaş üstü) ve katılımcının kendi
-- verisini silme hakkı. Doğum tarihi tutulmaz; yalnızca iki gruplu bir bayrak.

alter table public.survey_submissions
  add column if not exists age_group text
  check (age_group is null or age_group in ('minor', 'adult'));

alter table public.who5_measurements
  add column if not exists age_group text
  check (age_group is null or age_group in ('minor', 'adult'));

-- Kullanıcı kendi hesabını ve tüm araştırma verisini siler. Anket, WHO-5 ve
-- cihaz özeti satırları auth.users silinince ON DELETE CASCADE ile gider;
-- esnafın borçları ise SET NULL olurdu (user_id null = örnek borç sayılır),
-- bu yüzden önce açıkça silinir.
create or replace function private.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  account_id uuid := (select auth.uid());
begin
  if account_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.merchant_debts where user_id = account_id;
  delete from auth.users where id = account_id;
end
$function$;

revoke all on function private.delete_my_account() from public, anon;
grant execute on function private.delete_my_account() to authenticated;

create or replace function public.delete_my_account()
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.delete_my_account();
$function$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
