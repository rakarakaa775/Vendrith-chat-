-- DRAFT: JANGAN DIJALANKAN SEBELUM DITINJAU.
-- Target: hanya proyek Non-Production E2E (npvlokuszipgwrdipeoi). Jangan diterapkan ke production.
-- Disimpan di docs/drafts/ (bukan supabase/migrations/) agar tidak terterapkan otomatis.
-- Sebaiknya diterapkan setelah rekonsiliasi migrasi (docs/MIGRATION-RECONCILIATION.md).
--
-- Tujuan: mengaktifkan Realtime untuk halaman komunitas. Klien (app/community/community-client.tsx)
-- sudah berlangganan perubahan tiga tabel ini, tetapi publikasi supabase_realtime
-- hanya berisi chat_messages dan chat_notifications.
--
-- Kondisi yang diperiksa (10 November 2026, hanya baca):
--   chat_friend_requests    : kebijakan SELECT peserta ada, hak baca kolom ada, belum di publikasi
--   chat_members            : kebijakan SELECT anggota ada, hak baca kolom ada, belum di publikasi
--   chat_group_invitations  : RLS aktif, TIDAK ada kebijakan, TIDAK ada hak baca, belum di publikasi
--
-- Klien hanya memakai event sebagai pemicu refresh() (isi payload tidak dipakai).

-- 1) chat_group_invitations: beri hak baca kolom dan kebijakan untuk pihak yang terlibat.
--    Daftar kolom dibatasi persis sesuai skema saat ini.
grant select (id, conversation_id, inviter_id, invitee_id, status, created_at, responded_at)
  on public.chat_group_invitations to authenticated;

create policy chat_group_invitations_select_participant
  on public.chat_group_invitations
  for select
  to authenticated
  using (
    inviter_id = (select auth.uid())
    or invitee_id = (select auth.uid())
  );

-- 2) Daftarkan ketiga tabel ke publikasi Realtime.
alter publication supabase_realtime add table
  public.chat_friend_requests,
  public.chat_group_invitations,
  public.chat_members;

-- Catatan pengujian (dengan dua akun, pada fase verifikasi):
--   - Kirim permintaan pertemanan: penerima dan pengirim menerima event, pihak lain tidak.
--   - Buat undangan grup: invitee dan inviter menerima event.
--   - Tambah dan keluarkan anggota grup: user terkait menerima event.
--   - Dengan replica identity default, event DELETE hanya bisa difilter dengan kolom primary key.
--     Bila UI mengandalkan DELETE pada chat_friend_requests atau chat_group_invitations,
--     pertimbangkan replica identity full atau ubah ke pembaruan status.

-- Rollback (bila perlu):
--   alter publication supabase_realtime drop table
--     public.chat_friend_requests, public.chat_group_invitations, public.chat_members;
--   drop policy chat_group_invitations_select_participant on public.chat_group_invitations;
--   revoke select (id, conversation_id, inviter_id, invitee_id, status, created_at, responded_at)
--     on public.chat_group_invitations from authenticated;
