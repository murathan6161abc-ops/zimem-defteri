-- D-Zimem — Borç türü ve ikonu
-- ============================================================================
-- category (4 araştırma grubu: gida/egitim/fatura/saglik) AYNEN kalır; analizler
-- ve eski uygulama sürümleri onu kullanır. Yeni sütunlar:
--   kind: ayrıntılı tür (bebek, temizlik, giyim, yakacak, ulaşım…)
--   icon: esnafın seçtiği ikon (uygulama yalnızca bilinen ikonları gösterir)
-- Tür ile grup her zaman uyumlu olmalı (ör. yakacak → fatura grubu).
-- Uygulama bu SQL çalıştırılmadan da çalışır; yalnızca tür/ikon sunucuda saklanmaz.
-- ============================================================================

alter table public.merchant_debts
  add column if not exists kind text,
  add column if not exists icon text;

alter table public.merchant_debts
  drop constraint if exists merchant_kind_check,
  add constraint merchant_kind_check check (
    kind is null
    or kind in ('gida', 'bebek', 'temizlik', 'saglik', 'egitim', 'giyim', 'yakacak', 'fatura', 'ulasim', 'diger')
  ),
  drop constraint if exists merchant_kind_group_check,
  add constraint merchant_kind_group_check check (
    kind is null
    or (kind in ('gida', 'bebek', 'temizlik', 'giyim', 'diger') and category = 'gida')
    or (kind = 'saglik' and category = 'saglik')
    or (kind = 'egitim' and category = 'egitim')
    or (kind in ('yakacak', 'fatura', 'ulasim') and category = 'fatura')
  ),
  drop constraint if exists merchant_icon_check,
  add constraint merchant_icon_check check (icon is null or char_length(icon) between 1 and 16);

-- API'nin yeni sütunları hemen görmesi için şema önbelleğini yenile.
notify pgrst, 'reload schema';
