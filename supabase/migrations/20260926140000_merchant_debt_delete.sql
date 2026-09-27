-- D-Zimem — Esnafın kendi açık borcunu silebilmesi
-- ============================================================================
-- Önceden "Sil" butonu borcu yalnızca cihaz ekranından kaldırıyordu; tabloda
-- DELETE yetkisi olmadığı için borç havuzda kalıyor, bağışçılar ödemeye devam
-- edebiliyor ve esnaf yeniden giriş yapınca geri geliyordu.
--
-- Kural: yalnızca borcu ekleyen hesap, yalnızca KAPANMAMIŞ ve örnek olmayan
-- borcu silebilir. (2FA açık hesaplarda "mfa_required" restrictive politikası
-- silme için de aal2 ister.)
-- ============================================================================

grant delete on table public.merchant_debts to authenticated;

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
  );
