-- D-Zimem — PANAS'ın iki alt ölçeği de hem ön hem son testte
-- ============================================================================
-- 2.8.0 ve öncesi negatif duyguyu yalnızca ön testte, pozitif duyguyu yalnızca son
-- testte soruyordu; bu yüzden PANAS için ön-son karşılaştırması yapılamıyordu.
-- Mevcut sütunların anlamı değişmez:
--   panas_neg_*  = ön test negatif duygu
--   panas_pos_*  = son test pozitif duygu
-- Eksik iki ölçüm yeni sütunlara yazılır:
--   pre_panas_pos_*  = ön test pozitif duygu
--   post_panas_neg_* = son test negatif duygu
-- Eski gönderimlerde yeni sütunlar boş kalır. Tekrar çalıştırılabilir.
-- Uygulama bu göç çalıştırılmadan da gönderimi kaydeder; yalnızca yeni iki ölçüm
-- saklanmaz (bkz. lib/sync.ts).
-- ============================================================================

alter table public.survey_submissions
  add column if not exists pre_panas_pos_scores jsonb,
  add column if not exists pre_panas_pos_total integer,
  add column if not exists post_panas_neg_scores jsonb,
  add column if not exists post_panas_neg_total integer;

alter table public.survey_submissions
  drop constraint if exists survey_pre_panas_pos_total_check,
  add constraint survey_pre_panas_pos_total_check
    check (pre_panas_pos_total is null or pre_panas_pos_total between 5 and 25),
  drop constraint if exists survey_post_panas_neg_total_check,
  add constraint survey_post_panas_neg_total_check
    check (post_panas_neg_total is null or post_panas_neg_total between 5 and 25);

comment on column public.survey_submissions.panas_neg_total is 'PANAS negatif duygu, ön test (5-25); bölüm atlandıysa NULL';
comment on column public.survey_submissions.panas_pos_total is 'PANAS pozitif duygu, son test (5-25); bölüm atlandıysa NULL';
comment on column public.survey_submissions.pre_panas_pos_total is 'PANAS pozitif duygu, ön test (5-25); bölüm atlandıysa NULL';
comment on column public.survey_submissions.post_panas_neg_total is 'PANAS negatif duygu, son test (5-25); bölüm atlandıysa NULL';

-- Madde puanı olmayan alt ölçeğin toplamı 0 değil NULL olur (20261024100000 ile aynı
-- kural, yeni sütunlar dahil).
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
  if new.pre_panas_pos_scores is null then
    new.pre_panas_pos_total := null;
  end if;
  if new.post_panas_neg_scores is null then
    new.post_panas_neg_total := null;
  end if;
  return new;
end
$function$;

revoke all on function private.clear_missing_panas_totals() from public, anon, authenticated;

drop trigger if exists dzimem_clear_missing_panas_totals on public.survey_submissions;
create trigger dzimem_clear_missing_panas_totals
  before insert or update on public.survey_submissions
  for each row execute function private.clear_missing_panas_totals();

-- API'nin yeni sütunları hemen görmesi için şema önbelleğini yenile.
notify pgrst, 'reload schema';
