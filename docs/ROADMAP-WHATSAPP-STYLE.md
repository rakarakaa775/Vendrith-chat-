# Roadmap Lanjutan Vendrith Chat: pengalaman ala WhatsApp untuk pengembang game

**Status:** usulan untuk ditinjau (belum ada item yang diverifikasi)
**Disusun:** 10 November 2026
**Pelengkap dari:** `docs/ROADMAP.md` (roadmap implementasi Fase 1-8, ditinjau 2026-11-04). Dokumen ini tidak menggantikannya.
**Dasar:** inventaris kode `origin/main` (commit `ee32873`) dan pemeriksaan baca-saja pada proyek Supabase Non-Production E2E.

## 1. Hubungan dengan `docs/ROADMAP.md` dan aturan kerjanya

Roadmap lama sudah mencatat banyak hal yang selesai di kode: shell aplikasi responsif dengan navigasi seluler, paginasi riwayat berbasis kursor (50 pesan), status baca dan hitungan belum dibaca per anggota, arsip per anggota, penutupan grup, balasan, reaksi, edit dan hapus pesan, media privat, pencarian pemain, serta moderasi grup. Karena itu **Fase 1 dan 2 di bawah bersifat melengkapi dan menyempurnakan, bukan membangun dari nol.**

Beberapa usulan di sini bersinggungan dengan aturan kerja di `docs/ROADMAP.md` dan **butuh persetujuan terpisah sebelum dikerjakan**:

- **Pesan suara dan video** (Fase 2): aturan melarang voice/video tanpa persetujuan. Perlu dipastikan apakah pesan suara termasuk.
- **Web Push** (Fase 5): sudah ditunda sampai biaya dan privasi provider dievaluasi.
- **Bot webhook ke provider eksternal** (Fase 3): masuk kategori provider eksternal.
- **Perubahan fungsi game** (temuan keamanan): aturan melarang chat mengubah data atau domain World of Vendrith. Temuan ini sebaiknya dilaporkan ke pemilik domain game, bukan dikerjakan sebagai bagian chat.
- **Production:** tidak ada perubahan Auth, SQL, migrasi, RLS, storage, atau data di production tanpa persetujuan eksplisit.
- **Pengujian** tetap mengikuti aturan lama: ditunda sampai fase verifikasi akhir.

## 2. Konteks dan tujuan

- Vendrith chat akan menjadi bagian dari fitur game engine (pembuatan game). Penggunanya adalah pengembang yang berbicara dengan sesama pengembang.
- Fitur **Status** menjadi pratinjau: pengembang mengirim status perkembangan game yang sedang mereka buat.
- Titik awal: backend chat lengkap, tetapi Realtime baru aktif untuk pesan dan notifikasi, dan migrasi chat di Non-Production belum seluruhnya ada di `main` (PR #3 menunggu merge; lihat `docs/MIGRATION-RECONCILIATION.md`).

## 3. Prinsip kerja

- Mobile-first dan PWA lebih dulu. Aplikasi native menyusul bila perlu.
- Semua penulisan data lewat RPC, RLS aktif di semua tabel, migrasi kecil dan bertahap.
- Perubahan database hanya ke proyek Non-Production yang disetujui, dan tidak disebut selesai sebelum diverifikasi.
- Jangan menyebut chat terenkripsi end-to-end selama pesan disimpan sebagai teks biasa di database.

## 4. Ringkasan fase (perkiraan kasar, satu pengembang dibantu AI)

- **Fase 0 - Fondasi dan perbaikan** (sekitar 1 minggu)
- **Fase 1 - Penyempurnaan UI ala WhatsApp** (2-3 minggu)
- **Fase 2 - Perilaku chat ala WhatsApp** (3-4 minggu)
- **Fase 3 - Fitur khusus pengembang** (2-3 minggu, boleh tumpang tindih dengan akhir Fase 2)
- **Fase 4 - Status: pratinjau perkembangan game** (3-4 minggu)
- **Fase 5 - Notifikasi dan keandalan** (sekitar 2 minggu)
- **Fase 6 - Keamanan dan privasi lanjutan** (sekitar 2 minggu)
- **Fase 7 - Beta tertutup dan peluncuran** (2-3 minggu)

## 5. Fase 0 - Fondasi dan perbaikan

1. Selesaikan rekonsiliasi migrasi. Sebagian besar sudah dikerjakan di PR #3 (`integration/reconcile-2026-11-06`, 42 file). Tersisa: merge PR #3; samakan nomor versi `20261107013000` menjadi `20261106182923` sesuai catatan database; putuskan nasib `20261105153203` (grant `service_role`: efeknya sudah ada di database lewat default privileges, tetapi versinya tidak tercatat); tinjau perbedaan escape regex di `20261103155201`; lalu replay pada database sekali pakai dengan perbandingan katalog. Hasil audit ada di `docs/MIGRATION-HISTORY-VERIFICATION.md` (branch `chore/migration-history-verification`).
2. Sinkronkan repo kerja: Codespace `main` tertinggal 173 commit dan punya 1 commit lokal (`2dd745b`) yang belum di-push. Putuskan simpan atau buang, lalu rapikan worktree.
3. Perbaiki Realtime komunitas. Draf SQL ada di `docs/drafts/realtime-community.sql` dan baru diterapkan ke Non-Production setelah ditinjau.
4. Hapus atau ganti pemanggilan `chat_add_group_member` di UI (hak EXECUTE-nya sudah dicabut dari role `authenticated`).
5. Laporkan ke pemilik domain game: 58 fungsi game SECURITY DEFINER tanpa pengecekan pemanggil bisa dipanggil pengguna yang login (misalnya `vandrith_simulation_tick`, `claim_due_time_events`, `transfer_inventory`). Perbaikannya di luar lingkup chat.
6. Konfigurasi Auth Non-Production: wajib konfirmasi email, captcha, kata sandi minimal 8 karakter, perlindungan kata sandi bocor (cek paket), SMTP kustom, URL redirect `vendrith-chat.vercel.app`.
7. CI: `tsc` dan `next build` tetap dipertahankan. Proteksi branch `main`.

**Selesai bila:** Realtime komunitas aktif di Non-Production dan terverifikasi dua akun pada fase verifikasi, migrasi chat dari PR #3 sudah di `main` dengan nomor versi sama seperti catatan database, `main` sinkron dan terproteksi.

## 6. Fase 1 - Penyempurnaan UI ala WhatsApp

Tinjau UI yang ada terhadap pola WhatsApp dan lengkapi yang kurang:

- **Navigasi bawah** (Chat, Status, Komunitas, Profil), PWA (manifest, ikon, service worker dasar), mode gelap, dua panel di layar lebar.
- **Daftar chat:** avatar, cuplikan pesan terakhir, jam, lencana belum dibaca, penanda sematan dan arsip, pencarian percakapan.
- **Layar percakapan:** gelembung kiri dan kanan, pemisah tanggal, geser untuk membalas, menu tekan-lama (reaksi, balas, salin, edit, hapus, sematkan), tombol ke pesan terbaru.
- **Info grup dan kontak:** anggota, peran, media bersama, keluar grup.
- **Backend:** satu RPC ringkasan daftar chat (menggantikan 3 query per percakapan), tipe database dari `supabase gen types`, paginasi grup besar.
- Pindahkan halaman uji (`/test-chat`, `/realtime-probe`) ke area pengembang.

## 7. Fase 2 - Perilaku chat ala WhatsApp

- **Centang terkirim dan dibaca:** `last_read_at` per anggota yang sudah ada bisa dipakai untuk centang baca, tetapi kolom itu tidak terbaca anggota lain. Perlu RPC terkontrol dan pengaturan privasi tanda baca. Centang terkirim butuh penunjuk baru.
- **Indikator mengetik dan online:** Realtime Broadcast dan Presence (tidak ditulis ke database), dengan pengaturan privasi presence yang sudah ada.
- **Pengiriman optimistis,** antrean offline, dan coba ulang otomatis (idempotensi sudah ada lewat `client_message_id`).
- **Pencarian pesan:** full-text Postgres yang mengikuti RLS.
- **Teruskan pesan,** pesan berbintang, mention @nama di grup, dan sematan pesan (item `[ ] pinned messages` di roadmap lama).
- **Media:** kompres gambar, thumbnail, video pendek. Pesan suara menunggu persetujuan.
- **Pratinjau tautan:** ambil metadata di server dengan penolakan alamat internal untuk mencegah SSRF.

## 8. Fase 3 - Fitur khusus pengembang

- **Pesan kaya:** kartu proyek, kartu build, rujukan aset dan issue, blok kode dengan penyorotan sintaks, Markdown dasar.
- **Grup per proyek game** dengan peran (owner, developer, artist, QA) yang selaras dengan peran di game engine. Undangan lewat tautan berumur terbatas.
- **Bot sistem:** pesan otomatis ke grup proyek saat build atau deploy selesai atau gagal, dan saat pull request dibuka. Butuh persetujuan karena melibatkan provider eksternal.
- **Identitas pengembang:** tetap memakai UUID Supabase Auth sebagai identitas kanonik (`docs/IDENTITY-INTEGRATION.md`). Pencarian lewat username atau proyek, bukan nomor telepon.
- **Peringatan rahasia:** deteksi pola kunci API atau token sebelum pesan terkirim.

## 9. Fase 4 - Status: pratinjau perkembangan game

**Konsep:** pembaruan singkat yang tampil sebagai baris atau cincin di tab Status dan kedaluwarsa otomatis. Isinya teks, gambar atau GIF, video pendek, atau tautan build dan changelog, dikaitkan ke satu proyek.

**Model data (usulan):**
- `chat_status_posts`: penulis, proyek, jenis, isi, jalur media, rujukan build, mode audiens, waktu dibuat dan kedaluwarsa
- `chat_status_audience`: daftar penerima khusus per status
- `chat_status_views`: siapa melihat dan kapan
- bucket privat `vendrith-chat-status` dengan URL bertanda tangan berumur pendek

**Audiens (seperti WhatsApp):** semua teman, teman kecuali orang tertentu, hanya orang yang dipilih, atau anggota grup proyek tertentu.

**RPC (usulan):** `chat_post_status`, `chat_list_status_feed`, `chat_mark_status_viewed`, `chat_list_status_viewers` (hanya penulis), `chat_delete_status`, `chat_reply_to_status`, `chat_report_status`.

**RLS:** status terlihat bila pembacanya penulis atau masuk audiens, dan tidak ada blokir dua arah.

**Realtime dan kedaluwarsa:** daftarkan tabel status ke publikasi untuk cincin status baru. Kedaluwarsa default 24 jam lewat pekerjaan terjadwal yang menghapus baris dan file.

**Pratinjau game:** tahap 4a gambar, video, dan tautan build. Tahap 4b build yang bisa dimainkan di iframe ber-sandbox, hanya dari domain hosting milik engine sendiri, dengan CSP ketat.

**Privasi dan moderasi:** pengaturan audiens bawaan, bisukan status pengembang tertentu, opsi mematikan tanda dilihat, laporan status, dan penghormatan pada blokir.

## 10. Fase 5 - Notifikasi dan keandalan

- **Web Push:** evaluasi provider, biaya, dan privasi dulu (sesuai roadmap lama). Setelah disetujui: VAPID dan service worker, bisukan per percakapan, jam tenang, lencana angka.
- **Laporan pesan langsung** (laporan saat ini baru untuk grup).
- **Performa:** hilangkan query berlapis, tinjau indeks, uji beban Realtime sesuai batas paket.
- **Pemantauan:** pelacak error, log Vercel dan Supabase, peringatan advisor.
- **Penghapusan akun dan ekspor data:** selesaikan jalur pemrosesan job (worker sudah ada) dan putuskan perlakuan pesan di sisi lawan bicara.

## 11. Fase 6 - Keamanan dan privasi lanjutan

- **Keputusan enkripsi:** (A) tetap enkripsi di sisi server dan jujur di dokumentasi, atau (B) enkripsi end-to-end untuk chat 1:1. Opsi B rumit: kunci per perangkat, server tidak bisa mencari atau memoderasi isi pesan, multi-perangkat sulit. Saran: tunda sampai produk stabil.
- **MFA** dan pengelolaan sesi atau perangkat (inventaris sesi sudah ada).
- **Keamanan lampiran:** batasi tipe, periksa MIME sebenarnya, tolak file eksekusi, URL bertanda tangan berumur pendek.
- **Uji RLS otomatis** dengan skenario beberapa identitas, dijalankan pada fase verifikasi.
- **Kebijakan:** syarat layanan, kebijakan privasi, dan pedoman moderasi.

## 12. Fase 7 - Beta tertutup dan peluncuran

- Beta untuk 10-50 pengembang dengan bendera fitur.
- Metrik: pesan per hari, status per hari, latensi kirim, tingkat gagal kirim, retensi mingguan.
- Integrasi production hanya setelah persetujuan eksplisit terpisah, dengan cadangan, rencana rollback, dan uji beban.
- Opsional: bungkus PWA menjadi aplikasi Android atau iOS.

## 13. Keputusan yang perlu diambil

1. **Database:** `docs/decisions/0003-shared-supabase-project.md` sudah menetapkan proyek Supabase bersama. Perlu dikonfirmasi apakah itu tetap berlaku untuk Status dan fitur pengembang.
2. **Identitas:** username dan undangan (disarankan) atau nomor telepon seperti WhatsApp.
3. **Model audiens Status:** bawaan teman dan grup proyek, atau lebih sederhana.
4. **PWA dulu atau langsung aplikasi native.** Saran: PWA dulu.
5. **Enkripsi end-to-end:** ya, tidak, atau tunda.
6. **Persetujuan terpisah** untuk pesan suara, Web Push, dan bot webhook.
7. **Batas paket** Supabase dan Vercel untuk Realtime, storage, dan fungsi terjadwal.

## 14. Risiko utama

- Cakupan terlalu besar: selesaikan inti (Fase 0-2) sebelum Status.
- Realtime dan biaya yang naik seiring pengguna.
- Spam dan penyalahgunaan bila pendaftaran terbuka tanpa konfirmasi email dan captcha.
- Database bersama dengan game: fungsi game yang terbuka dan kebijakan akses yang berbeda-beda.
- Nomor versi migrasi di Git dan di database belum seluruhnya sama.

## 15. Urutan yang disarankan

Fase 0, lalu 1, lalu 2. Fase 3 dimulai saat Fase 2 hampir selesai. Setelah chat stabil, kerjakan Fase 4 (Status), lalu 5, 6, dan 7.
