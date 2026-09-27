# Yuk's Wallet — Praktikum 3 (PABWE)

**Nama:** Wahyu Nainggolan (Yuyu)
**NIM:** 11S24032
**Mata Kuliah:** Praktikum Pemrograman Aplikasi Berbasis Web (PABWE) — IT Del

## Deskripsi

Yuk's Wallet adalah aplikasi web satu halaman (single page) yang menggabungkan tiga fitur
interaktif berbasis JavaScript murni (vanilla JS), dipisahkan menggunakan navigasi tab:

1. **Catatan Pengeluaran Harian (Expense Tracker)** — mencatat transaksi pemasukan/pengeluaran
   lengkap dengan CRUD via DOM, ringkasan saldo, pencarian, filter tipe/kategori, dan sorting.
2. **Tautan Favorit (Bookmark / Link Manager)** — menyimpan tautan favorit dengan validasi URL,
   kategori/tag, catatan opsional, pencarian, dan sorting.
3. **Kuis Interaktif (Quiz App)** — kuis pilihan ganda bertema literasi finansial & keamanan
   digital (6 soal, `array of object`), dengan skor akhir dan pencatatan skor tertinggi.

Tab terakhir yang dibuka akan diingat dan dipulihkan otomatis saat halaman dimuat ulang.
Seluruh data (transaksi, tautan, skor tertinggi, tab aktif) disimpan di `localStorage`
browser dengan key yang terpisah per fitur, sehingga tidak ada backend/API yang dibutuhkan.

## Struktur Proyek

```
11s24032-pabwe-p3/
├── index.html         # markup + 3 tab (Expense, Bookmark, Quiz) + modal
├── assets/
│   ├── script.js       # seluruh logika JavaScript, dikelompokkan per fitur
│   └── img/             # aset gambar opsional
└── README.md
```

## Teknologi

- HTML5 semantik (`header`, `nav`, `main`, `section`, `footer`)
- Tailwind CSS (CDN) untuk styling & responsivitas
- Google Fonts (Fraunces + Inter) dan Tabler Icons (CDN) untuk tampilan
- JavaScript ES6+ murni (tanpa framework) untuk seluruh logika & manipulasi DOM
- `localStorage` untuk persistensi data (tanpa backend/API)

## Cara Menjalankan

Buka `index.html` langsung di browser (double click atau lewat ekstensi Live Server),
tidak memerlukan proses build maupun server tambahan.

## Ringkasan Fitur per Panel

| Panel | Teknologi utama | Persistensi (localStorage key) |
|---|---|---|
| Catatan Pengeluaran Harian | DOM, event, array/object, validasi angka | `yukswallet:expenses` |
| Tautan Favorit | DOM, validasi URL (regex), CRUD | `yukswallet:bookmarks` |
| Kuis Interaktif | state aplikasi, render soal, penilaian | `yukswallet:quiz-highscore` |
| Navigasi Tab | — | `yukswallet:active-tab` |
