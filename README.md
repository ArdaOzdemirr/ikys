# IKYS — İnsan Kaynakları Yönetim Sistemi

[![CI](https://github.com/ArdaOzdemirr/ikys/actions/workflows/ci.yml/badge.svg)](https://github.com/ArdaOzdemirr/ikys/actions/workflows/ci.yml)

Şirket içi İK süreçlerini (personel, izin, bordro, devam/QR check-in, işe alım, KVKK
loglama, bildirimler) tek bir platformda toplayan; backend, web paneli ve mobil
uygulamadan oluşan bir sistem.

## Mimari

| Bileşen | Teknoloji | Klasör |
|---|---|---|
| Backend API | NestJS + Prisma + PostgreSQL | `backend/` |
| Web Paneli | React + Vite + TypeScript + Tailwind | `frontend/` |
| Mobil Uygulama | Flutter | `ikys_mobile/` |
| Veritabanı | PostgreSQL 16 (Docker) | `database/`, `docker-compose.yml` |

## Modül Özeti (backend)

| Modül | Sorumluluk |
|---|---|
| `auth` | Giriş/JWT (access+refresh token), 2FA |
| `personnel` | Personel kayıtları, departman/pozisyon, organizasyon şeması |
| `company` | Şirket/departman yapısı |
| `attendance` | Devam takibi, QR ile check-in/check-out |
| `leave` | İzin talepleri, onay zinciri, ilk yıl kuralı, dinamik izin kategorileri |
| `payroll` | Bordro hesaplama (SGK, işsizlik sigortası, gelir vergisi, damga vergisi) |
| `recruitment` | İlan yayınlama, başvuru/aday takibi |
| `documents` | Belge yükleme/saklama (local veya S3 uyumlu depolama) |
| `kvkk` | KVKK kapsamında veri erişim/işleme loglama |
| `notifications` | Uygulama içi bildirim, e-posta (SMTP) ve push (FCM) gönderimi |

Web panelindeki sayfalar (`frontend/src/pages/`) bu modüllerin arayüzünü oluşturur
(örn. `PayrollManagementPage`, `LeaveApprovalPage`, `KvkkLogsPage`, `OrgChartPage`).
Mobil uygulama (`ikys_mobile/`) personelin kendi profilini, izin taleplerini ve
QR ile check-in akışını kapsar.

## Kurulum

### Gereksinimler
- Node.js 18+
- Docker & Docker Compose (PostgreSQL için)
- Flutter SDK (mobil uygulamayı çalıştırmak için)

### 1) Veritabanı
```bash
docker compose up -d postgres
```

### 2) Backend
```bash
cd backend
npm install
cp .env.example .env   # değerleri kendi ortamına göre doldur
npx prisma migrate dev
npx prisma db seed
npm run start:dev       # http://localhost:3000
```

Önemli `.env` alanları:
- `DATABASE_URL`: PostgreSQL bağlantısı
- `JWT_SECRET` / `JWT_REFRESH_SECRET`: üretimde değiştirilmeli (min. 64 karakter rastgele string)
- `SMTP_*`: e-posta bildirimleri için (bkz. aşağıdaki "E-posta Bildirimleri" bölümü)

### 3) Frontend (web paneli)
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

### 4) Mobil uygulama
```bash
cd ikys_mobile
flutter pub get
flutter run
```

### Docker ile tek komutla (backend + frontend + db)
```bash
docker compose up -d
```
Frontend: `http://localhost:8080`, Backend: `http://localhost:3000`.

## E-posta Bildirimleri

Bildirimler (izin onayı, mesaj, duyuru vb.) oluşturulduğunda hem uygulama içi
bildirim hem de e-posta gönderilir. Hiçbir sağlayıcı yapılandırılmazsa e-posta
gönderimi otomatik olarak pasif kalır; uygulamayı düşürmez.

### Seçenek A: Resend (önerilen)

Ekstra paket kurulumu gerektirmez (Node'un yerleşik `fetch`'i kullanılır).

1. [resend.com](https://resend.com)'da ücretsiz hesap açın.
2. Dashboard → API Keys → "Create API Key".
3. `backend/.env` dosyasında doldurun:
   ```env
   RESEND_API_KEY=re_xxx
   RESEND_FROM=IKYS <onboarding@resend.dev>
   ```
4. Backend'i yeniden başlatın.

**Önemli sınırlama:** Kendi domaininizi Resend'de doğrulamadığınız sürece
`onboarding@resend.dev` adresinden **yalnızca Resend hesabınızın sahibi olduğu
e-posta adresine** gönderim yapabilirsiniz (test/demo için yeterli). Gerçek
kullanıcılara göndermek için Resend'de bir domain doğrulayıp `RESEND_FROM`'u
o domain'e göre güncelleyin.

`RESEND_API_KEY` tanımlıysa SMTP ayarlarına hiç bakılmaz.

### Seçenek B: SMTP / Gmail Uygulama Şifresi

`RESEND_API_KEY` boşsa devreye girer.

1. Gmail hesabında 2 Adımlı Doğrulama'yı açın.
2. [Google Hesap Güvenliği](https://myaccount.google.com/security) →
   "Uygulama Şifreleri" → yeni bir uygulama şifresi oluşturun.
3. `backend/.env` dosyasında doldurun:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=hesabiniz@gmail.com
   SMTP_PASS=olusturulan_16_haneli_uygulama_sifresi
   SMTP_FROM=IKYS <hesabiniz@gmail.com>
   ```
4. `npm i nodemailer` çalıştırın (kurulu değilse e-posta pasif kalır).
5. Backend'i yeniden başlatın (`npm run start:dev` veya `docker compose restart backend`).

`SMTP_PASS` alanına normal Gmail şifresi **çalışmaz**; yalnızca uygulama şifresi
kullanılabilir. Bu değerleri `.env` dosyasında tutun, repoya commit etmeyin.

## Push Bildirimleri (Firebase)

Uygulama kapalıyken bile bildirim göndermek için Firebase Cloud Messaging (FCM)
kullanılır. Aşağıdaki dosyalar **gizli sır içerdiği için repoya dahil değildir**
(`.gitignore`); olmadıklarında backend ve mobil normal çalışır, sadece push
bildirimleri pasif kalır (hata vermez).

- `backend/firebase-service-account.json` — Firebase Console →
  Proje Ayarları → Hizmet Hesapları → "Yeni özel anahtar oluştur" ile indirilir.
- `ikys_mobile/android/app/google-services.json` — Firebase Console →
  Proje Ayarları → Android uygulaması → `google-services.json` indir.

Her iki dosya da aynı Firebase projesine ait olmalı. Ekip arkadaşına/yeni bir
makineye geçerken bu dosyaları Firebase Console üzerinden (veya güvenli bir
kanaldan) elle aktarman gerekir.

## Test ve Lint

```bash
# Backend
cd backend && npx tsc --noEmit && npm run lint && npm run test

# Frontend
cd frontend && npx tsc --noEmit && npm run lint && npm run test && npm run build

# Mobil
cd ikys_mobile && flutter analyze && flutter test
```

## CI

`main` branch'ine her push/PR'da [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
otomatik olarak backend/frontend/mobil için tip kontrolü, lint ve testleri çalıştırır.
