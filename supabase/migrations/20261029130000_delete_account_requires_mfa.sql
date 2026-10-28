-- Hesap silme de 2 adımlı doğrulamaya tabi olmalı. delete_my_account SECURITY DEFINER
-- olduğu için tablolardaki "mfa_required" kuralını atlar; 2FA'lı bir hesapta yalnızca
-- şifreyle (aal1) açılmış bir oturum hesabı ve tüm araştırma verisini silebiliyordu.

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
  if not (select private.mfa_satisfied()) then
    raise exception 'MFA required' using errcode = '42501';
  end if;

  delete from public.merchant_debts where user_id = account_id;
  delete from auth.users where id = account_id;
end
$function$;

revoke all on function private.delete_my_account() from public, anon;
grant execute on function private.delete_my_account() to authenticated;
