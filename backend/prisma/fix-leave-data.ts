import { PrismaClient, LeaveType } from '@prisma/client';
import { cumulativeAnnualLeaveEntitlement } from '../src/modules/leave/leave-entitlement.util';

const prisma = new PrismaClient();

/** import-leave-history.ts tarafından oluşturulan kayıtların işaretleri. */
const EXCEL_MARKERS = ['Excel aktarımı', 'Babalık izni', 'Vefat izni'];

/**
 * Excel'deki en güncel "KALAN" (kalan yıllık izin) değerleri (2026 sayfası).
 * Bu, şirketin 2024 öncesinden gelen gerçek başlangıç bakiyesini de içeren
 * kendi bakiye takibi — bizim canlı hesaplama formülümüz sadece hireDate'ten
 * bugüne kıdem kademelerini topladığı için bu tarihsiz/eski geçmişi bilmiyor.
 * Bu yüzden farkı bir düzeltme kaydı olarak ekliyoruz.
 */
const TARGET_REMAINING: Record<string, number> = {
  'savas@firma.com': 43.5,
  'abidin@firma.com': 5.5,
  'emir@firma.com': -2.5,
};

/** Düzeltme kayıtlarının saklandığı, gerçek hiçbir yılla çakışmayan sentetik yıl. */
const CORRECTION_YEAR = 2000;

async function main() {
  // 1) Excel aktarımı DIŞINDA kalan tüm test izin kayıtlarını sil (tüm personel).
  const testRequests = await prisma.leaveRequest.findMany({
    where: { NOT: { OR: EXCEL_MARKERS.map((m) => ({ reason: { contains: m } })) } },
    select: { id: true },
  });
  if (testRequests.length > 0) {
    await prisma.leaveRequest.deleteMany({ where: { id: { in: testRequests.map((r) => r.id) } } });
    console.log(`🗑️  ${testRequests.length} test izin kaydı silindi`);
  } else {
    console.log('Silinecek test izin kaydı yok');
  }

  // 2) Kalan bakiyeyi Excel'deki gerçek değerlerle eşitle.
  for (const [email, targetRemaining] of Object.entries(TARGET_REMAINING)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.warn(`⚠️  ${email} bulunamadı, atlanıyor`);
      continue;
    }
    const personnel = await prisma.personnel.findUnique({ where: { userId: user.id } });
    if (!personnel) {
      console.warn(`⚠️  ${email} için personel kaydı bulunamadı, atlanıyor`);
      continue;
    }

    const totalEntitled = cumulativeAnnualLeaveEntitlement(personnel.hireDate);
    const agg = await prisma.leaveBalance.aggregate({
      where: { personnelId: personnel.id, type: LeaveType.ANNUAL },
      _sum: { usedDays: true },
    });
    const usedSoFar = agg._sum.usedDays ?? 0;
    const neededTotalUsed = totalEntitled - targetRemaining;
    const correction = neededTotalUsed - usedSoFar;

    if (Math.abs(correction) < 0.01) {
      console.log(`✅ ${email}: zaten doğru (kalan=${targetRemaining})`);
      continue;
    }

    await prisma.leaveBalance.upsert({
      where: {
        personnelId_year_type: { personnelId: personnel.id, year: CORRECTION_YEAR, type: LeaveType.ANNUAL },
      },
      update: { usedDays: { increment: correction } },
      create: {
        personnelId: personnel.id,
        year: CORRECTION_YEAR,
        type: LeaveType.ANNUAL,
        totalDays: 0,
        usedDays: correction,
        remainingDays: -correction,
      },
    });
    console.log(
      `✅ ${email}: ${correction.toFixed(2)} gün düzeltme eklendi ` +
        `(toplam hakediş=${totalEntitled}, hedef kalan=${targetRemaining})`,
    );
  }

  console.log('✨ Tamamlandı!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
