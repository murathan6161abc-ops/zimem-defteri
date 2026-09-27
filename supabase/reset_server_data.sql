-- D-Zimem — sunucu tarafı veri sıfırlama
-- ============================================================================
-- DİKKAT: Bu script TÜM hesapları ve TÜM araştırma verisini kalıcı olarak siler.
-- Geri alınamaz. Çalıştırmadan önce gerekirse admin panelinden CSV/JSON yedeği al.
--
-- Nerede çalıştırılır: Supabase Dashboard → SQL Editor (tek seferde tamamı).
-- Şema/RLS/RPC tanımlarına DOKUNMAZ; yalnızca veriyi temizler.
-- ============================================================================

begin;

-- 1) Tüm hesaplar. survey_submissions, device_snapshots ve who5_measurements
--    auth.users'a "on delete cascade" ile bağlı olduğu için bu satır o üç
--    tablodaki tüm kullanıcı verisini de temizler.
delete from auth.users;

-- 2) Borç havuzu: hem kullanıcı/esnaf kayıtları hem eski örnekler.
--    (merchant_debts "on delete set null" kullandığı için 1. adımda silinmez.)
delete from public.merchant_debts;

-- 3) Demo borçlarını migration'daki kanonik hâliyle yeniden ekle.
insert into public.merchant_debts (
  user_id, merchant_name, city, title, description, category, amount, urgency, is_sample
)
values
  (null, 'D-Zimem', 'İstanbul', 'Mahalle bakkalı veresiye borcu', 'Temel gıda alışverişinden kalan anonim borç.', 'gida',    480, 3, true),
  (null, 'D-Zimem', 'Ankara',   'Öğrenci kırtasiye borcu',        'Bir öğrencinin okul malzemeleri için kalan borcu.', 'egitim',  320, 2, true),
  (null, 'D-Zimem', 'İzmir',    'Elektrik faturası desteği',      'Ödeme güçlüğü yaşayan bir hanenin anonim faturası.', 'fatura',  760, 3, true),
  (null, 'D-Zimem', 'Bursa',    'Eczane ilaç borcu',              'Reçeteli ilaç alımından kalan anonim borç.', 'saglik',  540, 2, true);

commit;

-- 4) Doğrulama — hepsi 0, merchant_debts 4 olmalı.
select
  (select count(*) from auth.users)                as hesaplar,
  (select count(*) from public.survey_submissions) as anketler,
  (select count(*) from public.device_snapshots)   as snapshotlar,
  (select count(*) from public.who5_measurements)  as who5,
  (select count(*) from public.merchant_debts)     as borclar;

-- ============================================================================
-- SIFIRLAMA SONRASI: admin hesabı da silindiği için yeniden oluşturulmalı.
--   1. Uygulamadan "admin" kullanıcı adıyla normal bir kayıt yap.
--   2. supabase/assign_admin.sql.example içeriğini çalıştırıp role=admin ata.
-- ============================================================================
