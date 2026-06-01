# 🤖 Bot WhatsApp Penjaga Sumber Daya Kelas

[![Deploy to DOM Cloud](https://img.shields.io/badge/Deploy-DOM%20Cloud-00c853?style=for-the-badge&logo=appveyor)](https://domcloud.co)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Library-Baileys-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)

Bot WhatsApp otomatis berbasis Node.js yang berfungsi sebagai pengingat jadwal matinya fasilitas ruangan (seperti **AC** dan **Lampu**) ketika jam perkuliahan berakhir. Dirancang agar berjalan terus-menerus (24/7) di DOM Cloud tanpa mati, dilengkapi fitur pemantauan web terintegrasi dan sistem pengecekan tanggal merah (hari libur nasional/cuti bersama) yang sangat andal.

---

## ✨ Fitur Utama

- **⏱️ Pengingat Terjadwal Otomatis:** Mengirimkan pesan pengingat ke grup kelas saat perkuliahan akan selesai berdasarkan aturan ekspresi `cron` (Waktu Indonesia Barat/WIB).
- **🔴 Integrasi Tanggal Merah Multi-Source:**
  - Otomatis melewati pengiriman pesan di **Hari Libur Nasional** dan **Cuti Bersama**.
  - Menggunakan API Utama (`libur.deno.dev`) dengan sistem **Fallback API otomatis** ke (`api-hari-libur.vercel.app`) apabila kuota API utama habis.
  - **Local Persistent Cache (`~/holidays_cache.json`):** Menyimpan daftar hari libur di server agar bot tetap tahu hari libur walaupun seluruh API eksternal sedang gangguan/down.
- **📍 Penargetan Grup Kustom:** Memungkinkan penambahan jadwal pengingat ke grup yang berbeda seperti **Grup PKN**, **Grup Kelas**, atau **Grup Ini** saat menambahkan jadwal.
- **⚡ Hot Reload Schedule:** Modifikasi file `schedule.json` secara manual atau lewat pesan perintah bot langsung dimuat ulang seketika (*live edit*) tanpa perlu mematikan/restart bot.
- **🌐 Web Dashboard & QR Scan Page:**
  - Halaman status interaktif untuk melihat apakah bot aktif/tidak.
  - Halaman web `/qr` untuk kemudahan login / memindai QR Code langsung lewat browser.
- **🛡️ Anti-Sleep Engine (24/7 Uptime):**
  - **Internal Self-Ping:** Mengirim ping ke diri sendiri setiap 5 menit agar Phusion Passenger tidak menidurkan proses Node.js.
  - **External GitHub Actions Ping:** GitHub Workflow terjadwal yang memanggil endpoint `/health` bot setiap 10 menit sebagai jaring pengaman agar bot tetap hidup abadi.

---

## 🛠️ Struktur Perintah Bot (WhatsApp Commands)

Semua perintah berikut dapat dikirim langsung di dalam grup/chat tempat bot bergabung:

| Perintah | Deskripsi | Contoh Penggunaan |
| :--- | :--- | :--- |
| **`!help`** | Menampilkan daftar perintah bantuan dan contohnya | `!help` |
| **`!ping`** | Memastikan apakah respon bot aktif | `!ping` |
| **`!cekid`** | Mengambil dan menampilkan ID grup saat ini | `!cekid` |
| **`!listjadwal`** | Menampilkan seluruh jadwal aktif lengkap dengan target grupnya | `!listjadwal` |
| **`!addjadwal`** | Menambahkan pengingat baru ke grup tertentu | `!addjadwal pkn Senin 10:05 \| Kelas matdis selesai!` |
| **`!deljadwal`** | Menghapus jadwal tertentu berdasarkan nomor urut daftar | `!deljadwal 1` |

> 💡 **Format `!addjadwal`:**  
> `!addjadwal [pkn/kelas/sini] <Hari> <Jam:Menit> | <pesan>`  
> - Pilihan grup: `pkn` (Grup PKN), `kelas` (Grup Kelas), atau `sini` (Opsional, default: grup saat ini).

---

## 📂 Struktur Folder

```text
.
├── .github/workflows/
│   ├── deploy.yml            # Auto-deployment ke DOM Cloud via push
│   └── keep-alive.yml        # Cron pinger 10 menit sekali via GitHub Action
├── auth_info_baileys/        # Data kredensial login WhatsApp
├── app.js                    # Entry point DOM Cloud (Passenger)
├── index.js                  # Logika utama Bot & Web Server
├── package.json              # Daftar dependensi modul Node.js
└── schedule.json             # Penyimpanan lokal jadwal (fallback/default)
```

> **PENTING:** File penyimpanan jadwal dinamis yang aktif tersimpan di luar folder repositori git (`~/schedule.json`) agar data tidak hilang/tertimpa saat Anda melakukan `git pull` atau pembaruan kode.

---

## 🚀 Memulai di Lokal (Local Development)

### 1. Prasyarat
- Node.js versi 18 ke atas
- Koneksi internet aktif

### 2. Instalasi & Menjalankan
1. Kloning repositori ini:
   ```bash
   git clone https://github.com/R3dkk/BOT-penjagasumberdaya.git
   cd BOT-penjagasumberdaya
   ```
2. Pasang semua dependensi:
   ```bash
   npm install
   ```
3. Jalankan bot:
   ```bash
   npm start
   ```
4. Buka browser dan arahkan ke `http://localhost:3000/qr` untuk memindai QR Code agar terhubung dengan WhatsApp Anda.

---

## 🌐 Panduan Deployment & Keep-Alive (DOM Cloud)

### 1. Konfigurasi DOM Cloud (Passenger)
DOM Cloud menggunakan **Phusion Passenger** untuk menjalankan Node.js. File `app.js` bertindak sebagai entry point yang memanggil `index.js`.

### 2. Environment Variables (⚠️ WAJIB)
Bot membutuhkan environment variable berikut agar bisa mengirim pesan ke grup yang benar. Set di **Dashboard DOM Cloud** → bagian **Environment** pada aplikasi Anda:

| Variable | Keterangan | Contoh |
| :--- | :--- | :--- |
| `GROUP_PKN` | ID grup WhatsApp PKN | `120363xxxxxxxxx@g.us` |
| `GROUP_KELAS` | ID grup WhatsApp Kelas | `120363xxxxxxxxx@g.us` |

> 💡 Gunakan perintah `!cekid` di dalam grup WhatsApp untuk mendapatkan ID grup tersebut.

### 3. Mencegah Bot Tertidur (Keep-Alive Setup)
Agar bot tetap aktif 24/7 di DOM Cloud:
1. Masuk ke repositori GitHub Anda.
2. Buka menu **Settings > Secrets and variables > Actions**.
3. Tambahkan **New repository secret**:
   - **Name:** `BOT_URL`
   - **Value:** `https://domain-bot-anda.dom.my.id` (isi dengan URL domain DOM Cloud Anda tanpa garis miring di akhir).
4. GitHub Actions `keep-alive.yml` otomatis akan berjalan setiap 10 menit untuk memicu endpoint `/health` bot Anda, menjamin bot tidak akan pernah tertidur!

---
💡 *Selalu pastikan AC dan lampu dalam keadaan mati sebelum meninggalkan kelas untuk bumi yang lebih hijau!* 🌍💡
