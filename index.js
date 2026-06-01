// Load .env file jika ada (untuk environment variable seperti GROUP_PKN, GROUP_KELAS)
try { require('dotenv').config(); } catch(e) {}

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const cron = require('node-cron');
const fs = require('fs');
const express = require('express');
const pino = require('pino');

// --- WEB SERVER (untuk Cloud Deployment agar tidak tidur) ---
const app = express();
const port = process.env.PORT || 3000;

// Variabel untuk menyimpan status bot dan QR terbaru
let latestQR = null;
let botStatus = 'Menunggu QR Code...';
let isConnected = false;

// Halaman utama - status bot
app.get('/', (req, res) => {
    const statusColor = isConnected ? '#00c853' : '#ff6d00';
    const statusIcon = isConnected ? '✅' : '⏳';
    res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="10">
        <title>Bot WhatsApp Kelas</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
            .card { background: #1a1a1a; border-radius: 20px; padding: 40px 50px; text-align: center; border: 1px solid #333; box-shadow: 0 0 40px rgba(0,200,83,0.1); }
            .icon { font-size: 60px; margin-bottom: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; color: #eee; }
            .status { font-size: 18px; color: ${statusColor}; font-weight: bold; margin: 15px 0; }
            .btn { display: inline-block; margin-top: 20px; padding: 12px 30px; background: #25d366; color: white; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px; }
            .btn:hover { background: #1ebe57; }
            small { color: #666; display: block; margin-top: 15px; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">🤖</div>
            <h1>Bot WhatsApp Penjaga Sumber Daya</h1>
            <div class="status">${statusIcon} ${botStatus}</div>
            ${!isConnected ? '<a href="/qr" class="btn">📱 Scan QR Code</a>' : '<p style="color:#666;margin-top:15px">Bot sudah terhubung ke WhatsApp!</p>'}
            <small>Halaman ini auto-refresh setiap 10 detik</small>
        </div>
    </body>
    </html>
    `);
});

// Halaman QR Code
app.get('/qr', async (req, res) => {
    if (isConnected) {
        return res.send(`
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot Sudah Login</title>
        <style>body{font-family:'Segoe UI',sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:20px;}</style>
        </head><body>
        <div style="font-size:60px">✅</div>
        <h1>Bot sudah terhubung!</h1>
        <p style="color:#666">Tidak perlu scan QR lagi.</p>
        <a href="/" style="color:#25d366">← Kembali ke halaman utama</a>
        </body></html>`);
    }
    if (!latestQR) {
        return res.send(`
        <!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>Menunggu QR...</title>
        <style>body{font-family:'Segoe UI',sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:20px;}</style>
        </head><body>
        <div style="font-size:60px">⏳</div>
        <h1>QR Code belum tersedia</h1>
        <p style="color:#666">Halaman ini akan auto-refresh dalam 5 detik...</p>
        </body></html>`);
    }
    try {
        const qrImage = await QRCode.toDataURL(latestQR, { width: 300, margin: 2 });
        res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="refresh" content="30">
            <title>Scan QR - Bot WhatsApp</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
                .card { background: #1a1a1a; border-radius: 20px; padding: 40px; text-align: center; border: 1px solid #333; }
                h1 { font-size: 22px; margin-bottom: 5px; }
                p { color: #aaa; margin: 10px 0; font-size: 14px; }
                img { border-radius: 12px; border: 4px solid #25d366; margin: 20px 0; display: block; }
                .steps { text-align: left; background: #111; border-radius: 10px; padding: 15px 20px; margin-top: 15px; font-size: 13px; color: #ccc; line-height: 2; }
                .timer { color: #ff6d00; font-size: 12px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>📱 Scan QR Code</h1>
                <p>Gunakan WhatsApp untuk scan kode di bawah ini</p>
                <img src="${qrImage}" alt="QR Code WhatsApp" width="280" height="280">
                <div class="steps">
                    1️⃣ Buka WhatsApp di HP Anda<br>
                    2️⃣ Ketuk ⋮ (titik tiga) → <b>Perangkat Tertaut</b><br>
                    3️⃣ Ketuk <b>Tautkan Perangkat</b><br>
                    4️⃣ Scan QR Code di atas
                </div>
                <p class="timer">⏱️ QR Code expired dalam ~60 detik. Halaman auto-refresh tiap 30 detik.</p>
                <p><a href="/" style="color:#25d366">← Kembali</a></p>
            </div>
        </body>
        </html>`);
    } catch (err) {
        res.send('Error generate QR: ' + err.message);
    }
});

// Endpoint health-check (untuk monitoring eksternal)
app.get('/health', (req, res) => {
    res.json({
        status: isConnected ? 'connected' : 'disconnected',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`[+] Web server berjalan di port ${port} | Buka /qr untuk scan QR Code`);

    // --- KEEP-ALIVE: Self-ping setiap 5 menit agar Passenger tidak tidurkan proses ---
    const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 menit
    setInterval(async () => {
        try {
            const res = await fetch(`http://localhost:${port}/health`);
            const data = await res.json();
            console.log(`[♥] Keep-alive ping: ${data.status} | Uptime: ${data.uptime}s`);
        } catch (e) {
            console.error('[♥] Keep-alive ping gagal:', e.message);
        }
    }, KEEP_ALIVE_INTERVAL);
    console.log(`[♥] Keep-alive aktif: self-ping setiap 5 menit`);
});
// -------------------------------------------------------------

// Menyimpan referensi socket secara global agar bisa dipakai oleh cron
let sock;

// Array untuk menyimpan daftar cron job yang sedang berjalan
let activeJobs = [];

// Fungsi memuat jadwal dari schedule.json dan mendaftarkan cron
// Simpan di luar folder git agar tidak konflik saat git pull
const path = require('path');
const SCHEDULE_PATH = process.env.SCHEDULE_PATH
    || path.join(require('os').homedir(), 'schedule.json');

// ID Grup diambil dari environment variable agar tidak terekspos di GitHub
const GROUP_PKN = process.env.GROUP_PKN || '';
const GROUP_KELAS = process.env.GROUP_KELAS || '';

// Jadwal default (dipakai jika file belum ada atau rusak)
const DEFAULT_SCHEDULES = [];
function buildDefaultSchedule(groupId) {
  if (!groupId) return;
  DEFAULT_SCHEDULES.push(
    { cron: '5 10 * * 1', displayTime: 'Senin 10:05', groupId, message: '📚 Kelas *Matematika Diskrit I* sebentar lagi selesai!\nJangan lupa matikan *AC dan lampu* sebelum keluar ruangan ya! 💡🌬️' },
    { cron: '40 14 * * 1', displayTime: 'Senin 14:40', groupId, message: '📚 Kelas *Organisasi Sistem Komputer* sebentar lagi selesai!\nJangan lupa matikan *AC dan lampu* sebelum keluar ruangan ya! 💡🌬️' },
    { cron: '55 11 * * 2', displayTime: 'Selasa 11:55', groupId, message: '📚 Kelas *Pendidikan Kewarganegaraan* sebentar lagi selesai!\nJangan lupa matikan *AC dan lampu* sebelum keluar ruangan ya! 💡🌬️' },
    { cron: '40 14 * * 2', displayTime: 'Selasa 14:40', groupId, message: '📚 Kelas *Kalkulus II* sebentar lagi selesai!\nJangan lupa matikan *AC dan lampu* sebelum keluar ruangan ya! 💡🌬️' },
    { cron: '0 11 * * 3', displayTime: 'Rabu 11:00', groupId, message: '📚 Kelas *Struktur Data & Algoritma* sebentar lagi selesai!\nJangan lupa matikan *AC dan lampu* sebelum keluar ruangan ya! 💡🌬️' },
    { cron: '40 14 * * 3', displayTime: 'Rabu 14:40', groupId, message: '📚 Kelas *Aljabar Linier* sebentar lagi selesai!\nJangan lupa matikan *AC dan lampu* sebelum keluar ruangan ya! 💡🌬️' },
    { cron: '10 9 * * 4', displayTime: 'Kamis 09:10', groupId, message: '📚 Kelas *Manajemen Sistem Informasi* sebentar lagi selesai!\nJangan lupa matikan *AC dan lampu* sebelum keluar ruangan ya! 💡🌬️' }
  );
}
buildDefaultSchedule(GROUP_PKN);
buildDefaultSchedule(GROUP_KELAS);

// Inisialisasi file jadwal - buat baru atau perbaiki jika rusak
function initScheduleFile() {
    try {
        if (fs.existsSync(SCHEDULE_PATH)) {
            // Validasi JSON - kalau rusak, reset ke default
            JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
            console.log(`[+] schedule.json valid, menggunakan: ${SCHEDULE_PATH}`);
        } else {
            // File belum ada, buat dengan jadwal default
            fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(DEFAULT_SCHEDULES, null, 2));
            console.log(`[+] schedule.json baru dibuat di: ${SCHEDULE_PATH}`);
        }
    } catch (e) {
        // JSON rusak (misal konflik git), reset ke default
        console.log(`[!] schedule.json rusak (${e.message}), mereset ke jadwal default...`);
        fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(DEFAULT_SCHEDULES, null, 2));
    }
}
initScheduleFile();
console.log(`[+] Menggunakan schedule dari: ${SCHEDULE_PATH}`);

const HOLIDAYS_CACHE_PATH = path.join(require('os').homedir(), 'holidays_cache.json');

// --- FITUR HARI LIBUR ---
// Daftar hardcoded sebagai jaminan terakhir jika SEMUA API dan cache gagal
const HARDCODED_HOLIDAYS = {
    '2026-01-01': 'Tahun Baru 2026 Masehi',
    '2026-01-16': "Isra Mi'raj Nabi Muhammad SAW",
    '2026-02-16': 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili',
    '2026-02-17': 'Tahun Baru Imlek 2577 Kongzili',
    '2026-03-18': 'Cuti Bersama Hari Suci Nyepi Tahun Baru Saka 1948',
    '2026-03-19': 'Hari Suci Nyepi Tahun Baru Saka 1948',
    '2026-03-20': 'Cuti Bersama Hari Raya Idul Fitri 1447 Hijriyah',
    '2026-03-21': 'Hari Raya Idul Fitri 1447 Hijriyah',
    '2026-03-22': 'Hari Raya Idul Fitri 1447 Hijriyah',
    '2026-03-23': 'Cuti Bersama Hari Raya Idul Fitri 1447 Hijriyah',
    '2026-03-24': 'Cuti Bersama Hari Raya Idul Fitri 1447 Hijriyah',
    '2026-03-25': 'Cuti Bersama Hari Raya Idul Fitri 1447 Hijriyah',
    '2026-04-03': 'Wafat Isa Al Masih',
    '2026-05-01': 'Hari Buruh Internasional',
    '2026-05-14': 'Kenaikan Isa Al Masih',
    '2026-05-15': 'Hari Raya Waisak 2570 BE',
    '2026-05-27': 'Hari Raya Idul Adha 1447 Hijriyah',
    '2026-05-28': 'Cuti Bersama Hari Raya Idul Adha 1447 Hijriyah',
    '2026-06-01': 'Hari Lahir Pancasila',
    '2026-06-16': 'Tahun Baru Islam 1448 Hijriyah',
    '2026-08-17': 'Hari Kemerdekaan Republik Indonesia',
    '2026-08-25': 'Maulid Nabi Muhammad SAW',
    '2026-12-24': 'Cuti Bersama Hari Raya Natal',
    '2026-12-25': 'Hari Raya Natal',
};

let holidaysCache = [];
let lastFetchDate = '';

// Load cache dari file saat startup jika ada
try {
    if (fs.existsSync(HOLIDAYS_CACHE_PATH)) {
        holidaysCache = JSON.parse(fs.readFileSync(HOLIDAYS_CACHE_PATH, 'utf8'));
        console.log(`[+] Mengambil ${holidaysCache.length} data hari libur cadangan dari cache lokal.`);
    }
} catch (e) {
    console.error('[-] Gagal memuat cache hari libur lokal:', e.message);
}

async function fetchHolidaysFromAPI(year) {
    // 1. Coba API utama libur.deno.dev
    try {
        console.log('[+] Fetching data hari libur dari libur.deno.dev/api...');
        const res = await fetch('https://libur.deno.dev/api');
        if (!res.ok) throw new Error(`HTTP status ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            return data.map(h => ({ date: h.date, name: h.name }));
        }
    } catch (e) {
        console.warn(`[-] API utama (Deno) gagal: ${e.message}. Mencoba API cadangan (Vercel)...`);
    }

    // 2. Coba API cadangan api-hari-libur.vercel.app
    try {
        console.log(`[+] Fetching data hari libur dari api-hari-libur.vercel.app untuk tahun ${year}...`);
        const res = await fetch(`https://api-hari-libur.vercel.app/api?year=${year}`);
        if (!res.ok) throw new Error(`HTTP status ${res.status}`);
        const data = await res.json();
        if (data && data.status === 'success' && Array.isArray(data.data)) {
            return data.data.map(h => ({ date: h.date, name: h.description }));
        }
    } catch (e) {
        console.error(`[-] API cadangan (Vercel) gagal: ${e.message}`);
    }

    return null;
}

function isHolidayHardcoded(dateString) {
    return HARDCODED_HOLIDAYS[dateString] || false;
}

async function isHoliday(dateString) { // Format: YYYY-MM-DD
    // Cek WIB date, bukan UTC
    const now = new Date();
    const wibOffset = 7 * 60; // UTC+7
    const wibTime = new Date(now.getTime() + (wibOffset + now.getTimezoneOffset()) * 60000);
    const todayStr = wibTime.toISOString().split('T')[0];
    const year = dateString.split('-')[0];

    // Fetch data hanya sekali sehari untuk menghindari spam API
    if (lastFetchDate !== todayStr || holidaysCache.length === 0) {
        const fetchedData = await fetchHolidaysFromAPI(year);
        if (fetchedData && fetchedData.length > 0) {
            holidaysCache = fetchedData;
            lastFetchDate = todayStr;
            // Simpan ke cache lokal agar persisten saat restart / API down
            try {
                fs.writeFileSync(HOLIDAYS_CACHE_PATH, JSON.stringify(holidaysCache, null, 2));
                console.log(`[+] Berhasil menyimpan ${holidaysCache.length} hari libur ke cache lokal.`);
            } catch (e) {
                console.error('[-] Gagal menyimpan cache hari libur lokal:', e.message);
            }
        } else {
            console.warn('[!] Semua API hari libur gagal. Menggunakan data cache/hardcoded.');
        }
    }

    // Cocokkan dari data API/cache
    const holiday = holidaysCache.find(h => h.date === dateString);
    if (holiday) return holiday.name;

    // Fallback terakhir: cek dari daftar hardcoded yang tidak mungkin gagal
    return isHolidayHardcoded(dateString);
}

function loadSchedules() {
    try {
        activeJobs.forEach(job => job.stop());
        activeJobs = [];

        const data = fs.readFileSync(SCHEDULE_PATH, 'utf8');
        const schedules = JSON.parse(data);

        const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        console.log(`\n[+] Waktu server sekarang (WIB): ${now}`);
        console.log(`[+] Memuat ulang ${schedules.length} jadwal dari schedule.json...`);

        schedules.forEach((item, index) => {
            const job = cron.schedule(item.cron, async () => {
                // Cek apakah hari ini libur (pakai WIB, bukan UTC server)
                const nowWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
                const year = nowWib.getFullYear();
                const month = String(nowWib.getMonth() + 1).padStart(2, '0');
                const day = String(nowWib.getDate()).padStart(2, '0');
                const dateString = `${year}-${month}-${day}`;

                const holidayName = await isHoliday(dateString);
                
                if (holidayName) {
                    console.log(`[!] HARI LIBUR (${holidayName})! Jadwal ke-${index + 1} dibatalkan untuk hari ini.`);
                    return; // Stop pengiriman
                }

                if (sock) {
                    sock.sendMessage(item.groupId, { text: item.message });
                    console.log(`[!] Pesan pengingat (Jadwal ke-${index + 1}) berhasil dikirim ke ${item.groupId}!`);
                } else {
                    console.log(`[!] Jadwal ke-${index + 1} waktunya tapi bot belum konek!`);
                }
            }, {
                timezone: 'Asia/Jakarta'  // <-- Fix: paksa timezone WIB
            });
            activeJobs.push(job);
            console.log(`  -> Jadwal ke-${index + 1} aktif: ${item.displayTime || item.cron} (WIB) -> Kirim ke: ${item.groupId}`);
        });
    } catch (error) {
        console.error('[-] Gagal memuat schedule.json:', error.message);
        console.error('[-] Path yang dicoba:', SCHEDULE_PATH);
        console.error(error.stack);
    }
}

// Fungsi utama koneksi ke WhatsApp
async function connectToWhatsApp() {
    // Muat sesi login yang tersimpan di dalam folder .data (khusus Glitch agar persistent)
    const { state, saveCreds } = await useMultiFileAuthState('./.data/auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // QR ditampilkan manual via qrcode-terminal
        logger: pino({ level: 'silent' }), // Matikan log verbose Baileys
    });

    // --- EVENT: Update status koneksi (QR, login, disconnect) ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Simpan QR dan tampilkan di terminal
        if (qr) {
            latestQR = qr;
            botStatus = 'Menunggu scan QR Code...';
            isConnected = false;
            console.log('\n[!] QR Code baru tersedia! Buka URL/qr di browser untuk scan.');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            latestQR = null;
            isConnected = false;
            botStatus = 'Koneksi terputus, mencoba reconnect...';
            // Cek apakah harus reconnect atau benar-benar logout
            const alasanDisconnect = lastDisconnect?.error instanceof Boom
                ? lastDisconnect.error.output?.statusCode
                : null;
            const harusReconnect = alasanDisconnect !== DisconnectReason.loggedOut;

            if (harusReconnect) {
                console.log(`[!] Koneksi terputus (kode: ${alasanDisconnect}). Mencoba reconnect otomatis dalam 5 detik...`);
                setTimeout(connectToWhatsApp, 5000);
            } else {
                console.log('[X] Bot ter-logout. Hapus folder "auth_info_baileys" lalu jalankan ulang.');
            }
        }

        if (connection === 'open') {
            latestQR = null;
            isConnected = true;
            botStatus = 'Terhubung dan aktif ✅';
            console.log('\n✅ Bot sudah siap dan berjalan!\n');

            // Muat jadwal saat pertama kali connect
            loadSchedules();

            // Pantau perubahan schedule.json untuk Live Edit
            fs.watchFile(SCHEDULE_PATH, () => {
                console.log('\n[!] Perubahan terdeteksi pada schedule.json (Live Edit)');
                loadSchedules();
            });
        }
    });

    // Simpan kredensial sesi saat ada perubahan
    sock.ev.on('creds.update', saveCreds);

    // --- EVENT: Pesan masuk ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            // Abaikan pesan yang dikirim oleh bot sendiri
            if (msg.key.fromMe) continue;

            const from = msg.key.remoteJid;

            // Ambil teks dari berbagai tipe pesan
            const body = msg.message?.conversation
                || msg.message?.extendedTextMessage?.text
                || msg.message?.imageMessage?.caption
                || '';

            if (!body) continue;

            // Fungsi reply (membalas pesan yang dikutip)
            const reply = async (text) => {
                await sock.sendMessage(from, { text }, { quoted: msg });
            };

            // ===================== DAFTAR PERINTAH =====================

            // !help — Tampilkan menu
            if (body.toLowerCase() === '!help') {
                const menu =
`*🤖 MENU BOT PENGINGAT 🤖*

Berikut adalah daftar perintah yang tersedia:

1️⃣ *!addjadwal [grup] <Hari> <Jam:Menit> | <pesan>*
Menambahkan jadwal pengingat baru ke grup tertentu.
_Pilihan [grup]: *pkn*, *kelas*, atau *sini* (opsional, default: grup saat ini)._
_Contoh: !addjadwal pkn Senin 10:05 | Kelas matdis selesai!_
_Contoh: !addjadwal Senin 10:05 | Matikan AC!_

2️⃣ *!listjadwal*
Melihat semua jadwal yang sedang aktif.

3️⃣ *!deljadwal <nomor>*
Menghapus jadwal berdasarkan nomornya.
_Contoh: !deljadwal 1_

4️⃣ *!ping*
Mengecek apakah bot sedang aktif.

_Selalu pastikan AC dan lampu mati sebelum keluar kelas ya!_ 💡🌍`;
                await reply(menu);
            }

            // !ping — Cek status bot
            if (body.toLowerCase() === '!ping') {
                await reply('Bot aktif dan siap mengingatkan! 🤖');
            }

            // !cekid — Dapatkan ID grup ini
            if (body.toLowerCase() === '!cekid') {
                await reply(`ID Grup ini adalah:\n*${from}*`);
                console.log('[Info] ID Chat:', from);
            }

            // !addjadwal — Tambah jadwal baru
            if (body.toLowerCase().startsWith('!addjadwal ')) {
                try {
                    const input = body.substring(11).trim();
                    const parts = input.split('|');

                    if (parts.length < 2) {
                        return await reply('⚠️ Format salah! Gunakan:\n*!addjadwal [grup] <Hari> <Jam:Menit> | <pesan>*\n\nContoh:\n!addjadwal pkn Senin 14:55 | Tolong matikan AC!\n!addjadwal Senin 14:55 | Tolong matikan AC!');
                    }

                    const waktuInput = parts[0].trim().toLowerCase();
                    const pesanText = parts[1].trim();
                    const waktuParts = waktuInput.split(/\s+/);

                    let targetGroupId = from;
                    let targetGroupName = 'Grup Ini';
                    let hari, jamMenitStr;

                    if (waktuParts.length === 3) {
                        const grupPilihan = waktuParts[0];
                        if (grupPilihan === 'pkn') {
                            if (!GROUP_PKN) return await reply('⚠️ GROUP_PKN belum di-set di environment variable server!');
                            targetGroupId = GROUP_PKN;
                            targetGroupName = 'Grup PKN';
                        } else if (grupPilihan === 'kelas') {
                            if (!GROUP_KELAS) return await reply('⚠️ GROUP_KELAS belum di-set di environment variable server!');
                            targetGroupId = GROUP_KELAS;
                            targetGroupName = 'Grup Kelas';
                        } else if (grupPilihan === 'sini') {
                            targetGroupId = from;
                            targetGroupName = 'Grup Ini';
                        } else {
                            return await reply('⚠️ Pilihan grup tidak valid! Gunakan: *pkn*, *kelas*, atau *sini*.\n\nContoh:\n!addjadwal pkn Senin 10:05 | Matikan AC!');
                        }
                        hari = waktuParts[1];
                        jamMenitStr = waktuParts[2];
                    } else if (waktuParts.length === 2) {
                        hari = waktuParts[0];
                        jamMenitStr = waktuParts[1];
                    } else {
                        return await reply('⚠️ Format waktu atau grup salah!\nGunakan: *[grup] Hari Jam:Menit*\n\nContoh:\n!addjadwal pkn Senin 14:55 | Tolong matikan AC!\n!addjadwal Senin 14:55 | Tolong matikan AC!');
                    }

                    const jamMenit = jamMenitStr.split(':');
                    const hariMap = { 'minggu': 0, 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6 };

                    if (hariMap[hari] === undefined) {
                        return await reply('⚠️ Nama hari tidak valid!\nGunakan: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, atau Minggu.');
                    }
                    if (jamMenit.length !== 2 || isNaN(jamMenit[0]) || isNaN(jamMenit[1])) {
                        return await reply('⚠️ Format jam salah! Gunakan HH:MM (24 jam)\nContoh: 14:55');
                    }

                    const cronJam = parseInt(jamMenit[0]);
                    const cronMenit = parseInt(jamMenit[1]);

                    if (cronJam < 0 || cronJam > 23 || cronMenit < 0 || cronMenit > 59) {
                        return await reply('⚠️ Jam atau menit tidak valid!');
                    }

                    const cronText = `${cronMenit} ${cronJam} * * ${hariMap[hari]}`;
                    const hariCapitalized = hari.charAt(0).toUpperCase() + hari.slice(1);
                    const displayTime = `${hariCapitalized} ${jamMenit[0].padStart(2, '0')}:${jamMenit[1].padStart(2, '0')}`;

                    const fileData = fs.readFileSync(SCHEDULE_PATH, 'utf8');
                    const schedules = JSON.parse(fileData);

                    schedules.push({
                        cron: cronText,
                        displayTime: displayTime,
                        groupId: targetGroupId,
                        message: pesanText
                    });

                    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedules, null, 2));
                    await reply(`✅ Jadwal berhasil ditambahkan untuk setiap hari *${displayTime}* ke *${targetGroupName}*!\nBot otomatis memuat ulang jadwal.`);
                } catch (error) {
                    await reply('❌ Terjadi kesalahan saat menyimpan jadwal.');
                    console.error(error);
                }
            }

            // !listjadwal — Lihat semua jadwal
            if (body.toLowerCase() === '!listjadwal') {
                try {
                    const fileData = fs.readFileSync(SCHEDULE_PATH, 'utf8');
                    const schedules = JSON.parse(fileData);

                    if (schedules.length === 0) {
                        return await reply('Belum ada jadwal yang tersimpan.\n\nTambahkan dengan: *!addjadwal*');
                    }

                    let replyMsg = '*📋 Daftar Jadwal Pengingat:*\n\n';
                    schedules.forEach((item, index) => {
                        let target = 'Grup Ini';
                        if (GROUP_PKN && item.groupId === GROUP_PKN) target = 'Grup PKN';
                        if (GROUP_KELAS && item.groupId === GROUP_KELAS) target = 'Grup Kelas';
                        
                        const waktuTampil = item.displayTime || item.cron;
                        replyMsg += `*[${index + 1}]* ⏰ ${waktuTampil} (📍 ${target})\n↳ ${item.message}\n\n`;
                    });
                    replyMsg += 'Untuk menghapus, ketik: *!deljadwal <nomor>*';

                    await reply(replyMsg);
                } catch (error) {
                    console.error('[-] Error !listjadwal:', error.message, '| Path:', SCHEDULE_PATH);
                    await reply('❌ Gagal membaca jadwal.\nError: ' + error.message);
                }
            }

            // !deljadwal — Hapus jadwal
            if (body.toLowerCase().startsWith('!deljadwal ')) {
                try {
                    const indexToDelete = parseInt(body.substring(11).trim()) - 1;
                    const fileData = fs.readFileSync(SCHEDULE_PATH, 'utf8');
                    let schedules = JSON.parse(fileData);

                    if (isNaN(indexToDelete) || indexToDelete < 0 || indexToDelete >= schedules.length) {
                        return await reply('⚠️ Nomor jadwal tidak valid!\nCek nomor yang benar dengan *!listjadwal*');
                    }

                    schedules.splice(indexToDelete, 1);
                    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedules, null, 2));
                    await reply(`🗑️ Jadwal nomor ${indexToDelete + 1} berhasil dihapus!\nBot otomatis diperbarui.`);
                } catch (error) {
                    await reply('❌ Gagal menghapus jadwal.');
                }
            }
        }
    });
}

// Mulai koneksi
connectToWhatsApp();