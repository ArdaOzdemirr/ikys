import { PrismaClient, LeaveStatus, LeaveType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * "Docart Yıllık İzinler.xlsx" dosyasındaki "İzin Detay 2025" ve
 * "izin detay 2026" sayfalarından elle çıkarılmış, tarih bazlı geçmiş izin
 * kayıtları. Sadece sistemde gerçekten kayıtlı olan Savaş/Abidin/Emir için.
 *
 * type belirtilmemişse ANNUAL (yıllık izin bakiyesini etkiler).
 * PATERNITY/BEREAVEMENT gibi özel izinler bakiyeyi ETKİLEMEZ (4857 sayılı
 * kanuna göre ayrı haktır) — kendi type'ıyla kaydedilir ama LeaveBalance'a
 * yansıtılmaz.
 */
type Entry = { date: string; days: number; type?: LeaveType; reason?: string };

const DATA: Record<string, { email: string; hireDate: string; entries: Entry[] }> = {
  savas: {
    email: 'savas@firma.com',
    hireDate: '2017-02-24',
    entries: [
      { date: '2025-08-06', days: 1 },
      { date: '2025-08-21', days: 0.5 },
      { date: '2025-09-03', days: 0.5 },
      { date: '2025-09-08', days: 5 },
      { date: '2025-09-19', days: 1 },
      { date: '2025-09-30', days: 1 },
      { date: '2025-10-02', days: 1 },
      { date: '2025-10-13', days: 0.25 },
      { date: '2025-10-27', days: 0.25 },
      { date: '2025-11-18', days: 1 },
      { date: '2025-11-21', days: 0.5 },
      { date: '2025-11-25', days: 0.5 },
      { date: '2025-12-03', days: 0.5 },
      { date: '2025-12-08', days: 5, type: LeaveType.PATERNITY, reason: 'Babalık izni' },
      { date: '2026-01-02', days: 1 },
      { date: '2026-01-09', days: 0.5 },
      { date: '2026-02-06', days: 1 },
      { date: '2026-03-06', days: 1 },
      { date: '2026-03-19', days: 0.5 },
      { date: '2026-03-24', days: 1 },
      { date: '2026-04-06', days: 1 },
      { date: '2026-05-15', days: 1 },
      { date: '2026-06-16', days: 1 },
      { date: '2026-06-26', days: 1 },
      { date: '2026-07-06', days: 4 },
    ],
  },
  abidin: {
    email: 'abidin@firma.com',
    hireDate: '2023-01-01',
    entries: [
      { date: '2025-08-05', days: 0.5 },
      { date: '2025-08-14', days: 0.5 },
      { date: '2025-08-18', days: 0.5 },
      { date: '2025-09-05', days: 0.5 },
      { date: '2025-09-11', days: 1 },
      { date: '2025-10-09', days: 0.5 },
      { date: '2025-10-10', days: 1 },
      { date: '2025-10-28', days: 0.25 },
      { date: '2025-10-30', days: 3, type: LeaveType.BEREAVEMENT, reason: 'Vefat izni' },
      { date: '2025-11-02', days: 5 },
      { date: '2025-12-23', days: 0.5 },
      { date: '2025-12-24', days: 1 },
      { date: '2026-01-02', days: 1 },
      { date: '2026-02-18', days: 1 },
      { date: '2026-03-18', days: 0.5 },
      { date: '2026-03-19', days: 0.5 },
      { date: '2026-04-10', days: 0.5 },
      { date: '2026-04-14', days: 2 },
    ],
  },
  emir: {
    email: 'emir@firma.com',
    hireDate: '2025-09-22',
    entries: [
      { date: '2026-01-02', days: 1 },
      { date: '2026-01-23', days: 0.5 },
      { date: '2026-03-03', days: 1 },
    ],
  },
};

function addDays(dateStr: string, totalDays: number): Date {
  const start = new Date(dateStr + 'T00:00:00Z');
  if (totalDays < 1) return start; // yarım/çeyrek gün: aynı gün
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Math.floor(totalDays) - 1);
  return end;
}

async function main() {
  for (const [key, person] of Object.entries(DATA)) {
    const user = await prisma.user.findUnique({ where: { email: person.email } });
    if (!user) {
      console.warn(`⚠️  ${person.email} bulunamadı, atlanıyor`);
      continue;
    }
    const personnel = await prisma.personnel.findUnique({ where: { userId: user.id } });
    if (!personnel) {
      console.warn(`⚠️  ${person.email} için personel kaydı bulunamadı, atlanıyor`);
      continue;
    }

    // İşe giriş tarihini düzelt (yıllık izin hakedişi buna göre canlı hesaplanıyor).
    await prisma.personnel.update({
      where: { id: personnel.id },
      data: { hireDate: new Date(person.hireDate + 'T00:00:00Z') },
    });
    console.log(`✅ ${key}: hireDate -> ${person.hireDate}`);

    const already = await prisma.leaveRequest.count({
      where: { personnelId: personnel.id, reason: { contains: 'Excel aktarımı' } },
    });
    if (already > 0) {
      console.warn(`⚠️  ${key}: zaten ${already} kayıt aktarılmış, tekrar işlenmiyor (script iki kez çalıştırılmasın diye)`);
      continue;
    }

    let annualUsedSum = 0;
    for (const e of person.entries) {
      const type = e.type ?? LeaveType.ANNUAL;
      const startDate = new Date(e.date + 'T00:00:00Z');
      const endDate = addDays(e.date, e.days);

      await prisma.leaveRequest.create({
        data: {
          personnelId: personnel.id,
          type,
          startDate,
          endDate,
          totalDays: e.days,
          reason: e.reason ?? 'Geçmiş kayıt (Excel aktarımı)',
          status: LeaveStatus.APPROVED,
          approverId: personnel.id,
          approvedAt: startDate,
        },
      });

      if (type === LeaveType.ANNUAL) annualUsedSum += e.days;
    }
    console.log(`  ${person.entries.length} izin kaydı oluşturuldu (${annualUsedSum} gün yıllık izin bakiyesini etkiliyor)`);

    if (annualUsedSum > 0) {
      const year = 2025;
      await prisma.leaveBalance.upsert({
        where: { personnelId_year_type: { personnelId: personnel.id, year, type: LeaveType.ANNUAL } },
        update: { usedDays: { increment: annualUsedSum } },
        create: {
          personnelId: personnel.id,
          year,
          type: LeaveType.ANNUAL,
          totalDays: 0, // artık canlı hesaplanıyor, bu alan kullanılmıyor
          usedDays: annualUsedSum,
          remainingDays: -annualUsedSum,
        },
      });
      console.log(`  LeaveBalance güncellendi: usedDays +${annualUsedSum}`);
    }
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
