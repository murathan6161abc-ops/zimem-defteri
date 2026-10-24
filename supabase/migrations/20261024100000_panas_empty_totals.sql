-- D-Zimem — PANAS bölümünü atlayan gönderimde toplam 0 değil, boş (NULL) olmalı
-- ============================================================================
-- 2.5.1 ve öncesi, PANAS'ı atlayan katılımcı için toplamı 0 yazıyordu. Geçerli bir
-- PANAS toplamı en az 5 olduğundan bu 0'lar araştırma ortalamalarını aşağı çekiyordu.
--   1) Mevcut kayıtlar düzeltilir: madde puanı olmayan satırın toplamı NULL olur.
--   2) Tetikleyici, telefonlarda kalan eski sürümlerden gelecek gönderimleri de
--      aynı kurala uydurur.
-- ============================================================================

update public.survey_submissions
set panas_neg_total = null
where panas_neg_scores is null
  and panas_neg_total is not null;

update public.survey_submissions
set panas_pos_total = null
where panas_pos_scores is null
  and panas_pos_total is not null;

create or replace function private.clear_missing_panas_totals()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.panas_neg_scores is null then
    new.panas_neg_total := null;
  end if;
  if new.panas_pos_scores is null then
    new.panas_pos_total := null;
  end if;
  return new;
end
$function$;

revoke all on function private.clear_missing_panas_totals() from public, anon, authenticated;

drop trigger if exists dzimem_clear_missing_panas_totals on public.survey_submissions;
create trigger dzimem_clear_missing_panas_totals
  before insert or update on public.survey_submissions
  for each row execute function private.clear_missing_panas_totals();
