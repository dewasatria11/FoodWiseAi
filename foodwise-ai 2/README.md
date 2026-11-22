# FoodWise AI

FoodWise AI adalah prototipe PWA untuk tugas UTS **Data Science in Practice**. Pengguna memasukkan bahan makanan, tujuan, anggaran, alergi, dan preferensi. Backend memproses permintaan melalui model AI OpenAI-compatible (default: `model-dewa`), menyimpan hasil ke SQLite, dan menampilkan riwayat resep.

## Fitur

- PWA installable dari browser HP/desktop
- Rekomendasi resep berbasis bahan yang tersedia
- Input tujuan masak, budget, alergi, dan preferensi
- Integrasi AI API melalui backend
- Fallback lokal jika API AI tidak tersedia
- Riwayat rekomendasi tersimpan di SQLite
- UI responsive dengan tombol Install App mengambang
- Service worker untuk asset caching

## Arsitektur

```text
PWA / Browser
      ↓ HTTP
Express API
      ├── SQLite
      └── OpenAI-compatible AI API
```

API key hanya digunakan di backend dan tidak boleh dimasukkan ke frontend atau repository.

## Kebutuhan

- Node.js 18 atau lebih baru
- npm
- API endpoint OpenAI-compatible (opsional; tanpa API key aplikasi memakai fallback lokal)

## Menjalankan lokal

```bash
npm install
cp .env.example .env
```

Edit `.env` dan isi API key secara lokal. Jangan commit file `.env`.

```bash
npm start
```

Buka:

```text
http://127.0.0.1:3016
```

## Environment variable

| Variable | Wajib | Keterangan |
|---|---:|---|
| `PORT` | Tidak | Port server, default `3016` |
| `FOODWISE_HOME` | Tidak | Folder data aplikasi |
| `FOODWISE_DB` | Tidak | Lokasi file SQLite |
| `AI_ENDPOINT` | Tidak | Endpoint chat completions |
| `AI_MODEL` | Tidak | Nama model, default `model-dewa` |
| `AI_API_KEY` | Tidak | API key AI, hanya di backend |

Contoh konfigurasi untuk 9Router/model-dewa:

```env
PORT=3016
AI_ENDPOINT=https://your-ai-endpoint.example/v1/chat/completions
AI_MODEL=model-dewa
AI_API_KEY=isi_secara_lokal_jangan_commit
```

Gunakan endpoint yang benar sesuai konfigurasi 9Router Anda. Jangan menyalin API key ke README, source code, screenshot, atau frontend.

## Endpoint API

### Status

```http
GET /api/status
```

### Membuat rekomendasi

```http
POST /api/recommend
Content-Type: application/json
```

Contoh body:

```json
{
  "ingredients": "ayam, telur, wortel",
  "goal": "tinggi protein",
  "budget": "Rp25000",
  "allergies": "kacang",
  "preferences": "rendah minyak"
}
```

### Riwayat

```http
GET /api/requests
```

## Pengujian manual

```bash
curl http://127.0.0.1:3016/api/status

curl -X POST http://127.0.0.1:3016/api/recommend \
  -H 'Content-Type: application/json' \
  -d '{"ingredients":"tahu, tempe, kol","goal":"hemat","budget":"Rp15000"}'

curl http://127.0.0.1:3016/api/requests
```

## Keamanan

- Jangan commit `.env` atau API key.
- Jangan memanggil API AI langsung dari browser.
- Untuk deployment publik, tambahkan autentikasi dashboard dan pembatasan CORS.
- SQLite/data runtime disimpan di folder `data/` dan tidak disertakan dalam source ZIP.

## Struktur project

```text
foodwise-ai/
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── public/
    ├── index.html
    ├── app.js
    ├── style.css
    ├── manifest.json
    ├── sw.js
    └── assets/
```

## Catatan akademik

Model AI digunakan untuk menghasilkan rekomendasi resep dari constraint pengguna. Evaluasi sebaiknya mencatat jumlah kasus, validitas output, kepatuhan terhadap bahan/alergi, status fallback, dan latensi. Hasil eksperimen aktual harus ditulis berdasarkan log pengujian, bukan perkiraan.

## Lisensi

Prototype akademik. Tambahkan lisensi sesuai kebutuhan repository Anda.
