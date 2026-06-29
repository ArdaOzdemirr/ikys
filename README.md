# IKYS — İnsan Kaynakları Yönetim Sistemi

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

## E-posta Bildirimleri (Gmail Uygulama Şifresi)

Bildirimler (izin onayı, mesaj, duyuru vb.) oluşturulduğunda hem uygulama içi
bildirim hem de e-posta gönderilir. E-posta gönderimi `backend/.env` içindeki
`SMTP_*` değişkenleri boşsa otomatik olarak pasif kalır; uygulamayı düşürmez.

Gmail ile aktif etmek için:
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
4. Backend'i yeniden başlatın (`npm run start:dev` veya `docker compose restart backend`).

`SMTP_PASS` alanına normal Gmail şifresi **çalışmaz**; yalnızca uygulama şifresi
kullanılabilir. Bu değerleri `.env` dosyasında tutun, repoya commit etmeyin.

## Test
```bash
cd backend && npm run test
cd frontend && npm run lint
```
