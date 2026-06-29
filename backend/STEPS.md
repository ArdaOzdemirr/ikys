# İzin Eksiklikleri — Uygulama Adımları (backend)

İki özellik:
1. İlk yıl izin kuralı (kıdem < 1 yıl → bakiye düşülmez; onaylayan ücretli/ücretsiz seçer)
2. Dinamik izin kategorileri (HR/Admin kategori açar, kişiye özel gizli/açık yapar)

## 1) Dosyaları yerleştir
Bu zip'i `backend/` klasörüne aç. Şunları kapsar:
- `src/modules/leave/leave.service.ts`        (değişti)
- `src/modules/leave/leave.dto.ts`            (değişti)
- `src/modules/leave/leave.module.ts`         (değişti)
- `src/modules/leave/leave-category.service.ts`    (yeni)
- `src/modules/leave/leave-category.controller.ts` (yeni)
- `src/modules/leave/leave-category.dto.ts`        (yeni)
- `prisma/seed-categories.ts`                 (yeni, tek seferlik)

Not: `leave.controller.ts` değişmedi (approve zaten dto'yu olduğu gibi geçiyor).

## 2) Şemayı güncelle
`SCHEMA_CHANGES.md`'deki 4 değişikliği `prisma/schema.prisma`'ya elle uygula.

## 3) Migration oluştur
`backend/` klasöründe (Docker kullanıyorsan backend konteyneri çalışırken host'ta):

```bash
cd backend
npx prisma migrate dev --name leave_categories_and_first_year_rule
npx prisma generate
```

Bu adım veritabanına yeni tabloları/sütunları ekler ve Prisma Client'ı yeniler.

## 4) Sistem kategorilerini ekle (tek seferlik)
Yerleşik 10 izin türünü kategori tablosuna taşır (idempotent):

```bash
npx ts-node prisma/seed-categories.ts
```

## 5) Backend'i yeniden başlat
```bash
docker-compose restart backend
# veya geliştirme modunda:  npm run start:dev
```

## Yeni API uçları
- `GET  /api/v1/leave/categories/me`            → çalışana açık kategoriler
- `GET  /api/v1/leave/categories`               → tüm kategoriler (HR/Admin)
- `POST /api/v1/leave/categories`               → kategori aç (HR/Admin)
- `PATCH /api/v1/leave/categories/:id`          → düzenle
- `DELETE /api/v1/leave/categories/:id`         → sil/pasifleştir (sistem hariç)
- `PUT  /api/v1/leave/categories/:id/visibility` → {personnelId, visible} kişiye aç/gizle
- `DELETE /api/v1/leave/categories/:id/visibility/:personnelId` → istisnayı kaldır

İzin talebi artık `type` (eski) veya `categoryId` (yeni) ile gönderilebilir.
Onay (`PATCH /leave/requests/:id/approve`) gövdesine ilk yıl izinlerinde
`paymentType: "PAID" | "UNPAID"` eklenmeli.

## Test
- İlk yıl kuralı: işe giriş tarihi son 1 yıl içinde olan bir personel oluştur
  (web panel → personel ekle, hireDate yakın bir tarih). O personelle yıllık izin
  iste → bakiye hatası ALMAZ; talep "Beklemede" olur. Onaylarken paymentType
  vermezsen "ödeme tipi belirtilmelidir" hatası alırsın; PAID/UNPAID verince onaylanır.
- Kategori: HR ile yeni kategori aç (ör. code: DOGUM_GUNU, name: Doğum Günü İzni).
  defaultVisible=false yapıp tek bir kişiye visibility=true verirsen sadece o kişi görür.
