-- D-Zimem — Veresiye defteri tarama: yerel model (Ollama) için iş kuyruğu
-- ============================================================================
-- Telefon fotoğrafı scan_jobs tablosuna "pending" iş olarak yazar. Yöneticinin
-- bilgisayarında çalışan tarama programı (scripts/scan-worker.mjs) işi alır,
-- fotoğrafı yerel görsel modelle okur, sonucu yazar ve fotoğrafı SİLER.
-- Bilgisayar dışarıya port açmaz; yalnızca Supabase'e bağlanır.
--
-- Roller:
--   esnaf        → kendi işini ekler, okur, bekleyen işini iptal eder (günde 30)
--   scan_worker  → auth.users.raw_app_meta_data.role (sunucu yönetir); işleri
--                  okur, sonuç yazar, eski işleri temizler
-- ============================================================================

-- Gemini sürümünden kalan, artık kullanılmayan tablo.
drop table if exists public.ledger_scans;

create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  mime_type text not null default 'image/jpeg',
  image text,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint scan_jobs_status_check check (status in ('pending', 'processing', 'done', 'failed')),
  constraint scan_jobs_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint scan_jobs_image_check check (image is null or char_length(image) between 100 and 7000000),
  constraint scan_jobs_error_check check (error is null or char_length(error) <= 200)
);

create index if not exists idx_scan_jobs_status_created on public.scan_jobs (status, created_at);
create index if not exists idx_scan_jobs_user_created on public.scan_jobs (user_id, created_at desc);

-- Tarama bilgisayarının "nabzı": uygulama tarama ekranında çevrimiçi/çevrimdışı gösterir.
create table if not exists public.scan_worker_heartbeat (
  id smallint primary key default 1,
  last_seen timestamptz not null default now(),
  model text,
  constraint scan_worker_heartbeat_single check (id = 1),
  constraint scan_worker_heartbeat_model_check check (model is null or char_length(model) <= 80)
);

-- ─── Yardımcı fonksiyonlar ──────────────────────────────────────────────────
create or replace function private.is_scan_worker()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'scan_worker';
$function$;

-- Son 24 saatte en fazla 30 iş. İşler sahibi tarafından silinemez, böylece sayaç sıfırlanamaz.
create or replace function private.scan_quota_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select count(*) < 30
  from public.scan_jobs as job
  where job.user_id = (select auth.uid())
    and job.created_at > now() - interval '24 hours';
$function$;

revoke all on function private.is_scan_worker() from public, anon;
revoke all on function private.scan_quota_ok() from public, anon;
grant execute on function private.is_scan_worker() to authenticated, service_role;
grant execute on function private.scan_quota_ok() to authenticated, service_role;

-- Çevrimiçi kontrolü sunucu saatiyle yapılır (telefon saati yanlış olabilir).
create or replace function public.scan_worker_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'online', coalesce(bool_or(beat.last_seen > now() - interval '60 seconds'), false),
    'model', max(beat.model)
  )
  from public.scan_worker_heartbeat as beat;
$function$;

revoke all on function public.scan_worker_status() from public, anon;
grant execute on function public.scan_worker_status() to authenticated, service_role;

-- Tarama programı nabzı bununla yazar: zaman damgası bilgisayarın saatinden değil
-- sunucunun saatinden gelir. SECURITY INVOKER → aşağıdaki RLS yalnızca işçiye izin verir.
create or replace function public.scan_worker_beat(p_model text)
returns void
language sql
security invoker
set search_path = ''
as $function$
  insert into public.scan_worker_heartbeat (id, last_seen, model)
  values (1, now(), left(p_model, 80))
  on conflict (id) do update
    set last_seen = excluded.last_seen,
        model = excluded.model;
$function$;

revoke all on function public.scan_worker_beat(text) from public, anon;
grant execute on function public.scan_worker_beat(text) to authenticated, service_role;

-- ─── Yetkiler ───────────────────────────────────────────────────────────────
alter table public.scan_jobs enable row level security;
alter table public.scan_worker_heartbeat enable row level security;

revoke all on table public.scan_jobs from anon, authenticated;
revoke all on table public.scan_worker_heartbeat from anon, authenticated;

grant select, insert, delete on table public.scan_jobs to authenticated;
grant update (status, image, result, error, started_at, finished_at) on table public.scan_jobs to authenticated;
grant select, insert, update on table public.scan_worker_heartbeat to authenticated;
grant all on table public.scan_jobs to service_role;
grant all on table public.scan_worker_heartbeat to service_role;

drop policy if exists scan_jobs_insert_owner on public.scan_jobs;
create policy scan_jobs_insert_owner
  on public.scan_jobs
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and status = 'pending'
    and image is not null
    and result is null
    and error is null
    and started_at is null
    and finished_at is null
    -- user_metadata kullanıcıca yazılabilir: yetki sınırı değil, akış kapısı.
    -- Asıl koruma günlük kota ve sonucun yalnızca işçi tarafından yazılabilmesi.
    and coalesce((select auth.jwt()) -> 'user_metadata' ->> 'role', '') = 'esnaf'
    and (select private.scan_quota_ok())
  );

drop policy if exists scan_jobs_select_owner_or_worker on public.scan_jobs;
create policy scan_jobs_select_owner_or_worker
  on public.scan_jobs
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.is_scan_worker())
  );

drop policy if exists scan_jobs_update_worker on public.scan_jobs;
create policy scan_jobs_update_worker
  on public.scan_jobs
  for update
  to authenticated
  using ((select private.is_scan_worker()))
  with check ((select private.is_scan_worker()));

-- Sahip yalnızca kendi BEKLEYEN işini iptal edebilir (fotoğrafı silerek); sonuç yazamaz.
drop policy if exists scan_jobs_cancel_owner on public.scan_jobs;
create policy scan_jobs_cancel_owner
  on public.scan_jobs
  for update
  to authenticated
  using ((select auth.uid()) = user_id and status = 'pending')
  with check (
    (select auth.uid()) = user_id
    and status = 'failed'
    and image is null
    and result is null
  );

drop policy if exists scan_jobs_delete_worker on public.scan_jobs;
create policy scan_jobs_delete_worker
  on public.scan_jobs
  for delete
  to authenticated
  using ((select private.is_scan_worker()));

drop policy if exists scan_heartbeat_select on public.scan_worker_heartbeat;
create policy scan_heartbeat_select
  on public.scan_worker_heartbeat
  for select
  to authenticated
  using (true);

drop policy if exists scan_heartbeat_write_worker on public.scan_worker_heartbeat;
create policy scan_heartbeat_write_worker
  on public.scan_worker_heartbeat
  for insert
  to authenticated
  with check ((select private.is_scan_worker()));

drop policy if exists scan_heartbeat_update_worker on public.scan_worker_heartbeat;
create policy scan_heartbeat_update_worker
  on public.scan_worker_heartbeat
  for update
  to authenticated
  using ((select private.is_scan_worker()))
  with check ((select private.is_scan_worker()));
