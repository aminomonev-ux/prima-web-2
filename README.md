# PRIMA — Sistem Perencanaan & Kinerja RSJD Dr. Amino Gondohutomo

Aplikasi web internal RSJD Dr. Amino Gondohutomo Semarang untuk manajemen **Usulan Kebutuhan Aset** dan **E-Anggaran (eControlling)**. Dibangun dengan Next.js 14 App Router dan MySQL 8.

---

## Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript |
| Database | MySQL 8 via `mysql2` (raw SQL, tagged template) |
| Auth | JWT (`jose`) · bcryptjs · HTTP-only cookie |
| Security | Upstash Redis (rate limiting) · Cloudflare Turnstile · Audit Log |
| Storage | Google Drive API (upload file pendukung usulan) |
| Email | Nodemailer / Gmail SMTP |
| UI | Tailwind CSS · shadcn/ui (Nova) · Lucide Icons |
| Hosting | Vercel · GitHub |

---

## Fitur Utama

- **Usulan Kebutuhan** — pengajuan, review bidang, telaah admin, putusan Kasubag/Kabag, export
- **E-Anggaran (eControlling)** — input SSK, rekening, realisasi, pendapatan, laporan
- **Manajemen User** — RBAC 26+ role, aktivasi, reset password, app access control
- **Audit Trail** — semua aksi kritis tercatat di tabel `audit_log`
- **Notifikasi** — real-time per user/role untuk perubahan status usulan
- **Admin Panel** — monitoring sesi, attack monitor, broadcast, konfigurasi sistem

---

## Struktur Folder

```
app/
├── (auth)/          # Login, register, forgot password, verify email
├── (dashboard)/     # Halaman utama (usulan, kinerja, admin, menu)
└── api/             # API routes (auth, usulan, kinerja, admin, config)

lib/
├── data/            # db.ts (MySQL pool), usulan.ts, kinerja.ts
├── security/        # auth.ts, auditlog.ts, ratelimit.ts, recaptcha.ts
└── services/        # email.ts, notifications.ts

docs/                # Schema MySQL, migration scripts, panduan
proxy.ts             # Edge Runtime — route guard & CSP (BUKAN middleware.ts)
types/index.ts       # Semua TypeScript types
lib/constants.ts     # Roles, status, mapping bidang
```

---

## Instalasi & Menjalankan Lokal

### 1. Clone & install dependencies

```bash
git clone https://github.com/your-org/prima-web.git
cd prima-web
npm install
```

### 2. Konfigurasi environment

Buat file `.env.local` di root:

```env
# Database
DATABASE_URL=mysql://user:password@host:3306/prima_db

# Auth
JWT_SECRET=your-random-secret-min-32-chars

# Redis (rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Google Drive (upload file)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=

# Email (Nodemailer)
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

### 3. Setup database

Jalankan schema MySQL:

```bash
mysql -u root -p prima_db < docs/schema-mysql.sql
```

### 4. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## Sistem Role

```
SUPER_ADMIN
ADMIN · ADMIN_KASUBAG · ADMIN_KABAG
BIDANG_UMUM · BIDANG_RENBANG · BIDANG_PENUNJANG · BIDANG_PELAYANAN
SUB_UMUM_* · SUB_KEU_* · SUB_RENBANG_* · SUB_PENUNJANG_* · SUB_PELAYANAN_*
```

Detail mapping role → bidang ada di `lib/constants.ts`.

---

## Keamanan

- Session JWT di HTTP-only cookie (`prima_session`)
- Rate limiting via Upstash Redis (login max 5x, lock 15 menit)
- CSP nonce per-request dikelola di `proxy.ts`
- HTTP security headers di `next.config.ts` (HSTS, X-Frame-Options, nosniff, dll)
- Semua aksi kritis dicatat di tabel `audit_log`
- **Jangan rename `proxy.ts` ke `middleware.ts`** — akan konflik fatal di Next.js

---

## Referensi

- Schema database: `docs/schema-mysql.sql`
- Panduan akses LAN: `docs/akses-lokal-lan.txt`
- Alur usulan: `docs/workflow/flowchart-usulan.html`
- Security audit: `docs/security-audit.html`
