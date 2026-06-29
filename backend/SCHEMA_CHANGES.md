# schema.prisma DEĞİŞİKLİKLERİ

Aşağıdakileri `backend/prisma/schema.prisma` dosyasına uygula.

## 1) Yeni enum (dosyanın enum'larının yanına ekle)

```prisma
enum PaymentType {
  PAID              // Ücretli
  UNPAID            // Ücretsiz
}
```

## 2) LeaveRequest modelini güncelle

`type LeaveType` satırını **opsiyonel** yap ve yeni alanları + ilişkiyi ekle:

```prisma
model LeaveRequest {
  id           String      @id @default(uuid())
  personnelId  String

  type         LeaveType?                            // <-- ARTIK OPSİYONEL (eskiden: LeaveType)
  categoryId   String?                               // <-- YENİ: dinamik kategori
  paymentType  PaymentType?                          // <-- YENİ: ilk yıl ücretli/ücretsiz kararı
  requiresPaymentDecision Boolean @default(false)    // <-- YENİ: ilk yıl izni mi

  startDate    DateTime    @db.Date
  endDate      DateTime    @db.Date
  totalDays    Float
  reason       String?
  documentUrl  String?

  status       LeaveStatus @default(PENDING)
  approverId   String?
  approvedAt   DateTime?
  rejectionReason String?

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  personnel    Personnel   @relation("Requester", fields: [personnelId], references: [id])
  approver     Personnel?  @relation("Approver", fields: [approverId], references: [id])
  category     LeaveCategory? @relation(fields: [categoryId], references: [id])  // <-- YENİ

  @@index([personnelId, status])
  @@index([startDate, endDate])
}
```

## 3) İki yeni model ekle (dosyanın herhangi bir yerine)

```prisma
// HR/Admin tarafından yönetilen dinamik izin kategorileri
model LeaveCategory {
  id                   String   @id @default(uuid())
  code                 String   @unique
  name                 String
  description          String?
  isPaid               Boolean  @default(true)
  affectsAnnualBalance Boolean  @default(false)
  defaultVisible       Boolean  @default(true)
  isActive             Boolean  @default(true)
  isSystem             Boolean  @default(false)
  createdById          String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  createdBy            Personnel?            @relation("CategoryCreator", fields: [createdById], references: [id])
  accesses             LeaveCategoryAccess[]
  requests             LeaveRequest[]
}

// Kategori görünürlüğünün kişiye özel istisnaları
model LeaveCategoryAccess {
  id          String   @id @default(uuid())
  categoryId  String
  personnelId String
  visible     Boolean  @default(true)
  createdAt   DateTime @default(now())

  category    LeaveCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  personnel   Personnel     @relation("CategoryAccess", fields: [personnelId], references: [id])

  @@unique([categoryId, personnelId])
}
```

## 4) Personnel modeline iki ters-ilişki ekle

`Personnel { ... }` içindeki ilişkiler bölümüne (diğer `@relation` satırlarının yanına) ekle:

```prisma
  createdCategories LeaveCategory[]       @relation("CategoryCreator")
  categoryAccesses  LeaveCategoryAccess[] @relation("CategoryAccess")
```
