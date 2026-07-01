// Sadece YEREL geliştirme ortamı içindir — Railway production'daki gibi
// yalnızca savas/abidin/emir hesapları kalsın diye diğer tüm test
// kullanıcılarını (ve bağlı verilerini) temizler.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KEEP_EMAILS = ['savas@firma.com', 'abidin@firma.com', 'emir@firma.com'];

async function main() {
  console.log('🧹 Tutulacaklar dışındaki tüm hesaplar temizleniyor...');

  const keepUsers = await prisma.user.findMany({
    where: { email: { in: KEEP_EMAILS } },
    select: { id: true },
  });
  const keepUserIds = keepUsers.map((u) => u.id);

  const removeUsers = await prisma.user.findMany({
    where: { id: { notIn: keepUserIds } },
    select: { id: true },
  });
  const removeUserIds = removeUsers.map((u) => u.id);

  const removePersonnel = await prisma.personnel.findMany({
    where: { userId: { in: removeUserIds } },
    select: { id: true },
  });
  const removePersonnelIds = removePersonnel.map((p) => p.id);

  if (removePersonnelIds.length > 0) {
    await prisma.notification.updateMany({
      where: { senderId: { in: removePersonnelIds } },
      data: { senderId: null },
    });
    await prisma.leaveRequest.updateMany({
      where: { approverId: { in: removePersonnelIds } },
      data: { approverId: null },
    });
    await prisma.leaveRequest.updateMany({
      where: { cancelApproverId: { in: removePersonnelIds } },
      data: { cancelApproverId: null },
    });
    await prisma.leaveCategory.updateMany({
      where: { createdById: { in: removePersonnelIds } },
      data: { createdById: null },
    });
    await prisma.expense.updateMany({
      where: { approverId: { in: removePersonnelIds } },
      data: { approverId: null },
    });
    await prisma.expense.updateMany({
      where: { paidById: { in: removePersonnelIds } },
      data: { paidById: null },
    });

    await prisma.leaveApprovalStep.deleteMany({ where: { approverId: { in: removePersonnelIds } } });
    await prisma.leaveRequest.deleteMany({ where: { personnelId: { in: removePersonnelIds } } });
    await prisma.leaveCategoryAccess.deleteMany({ where: { personnelId: { in: removePersonnelIds } } });
    await prisma.leaveBalance.deleteMany({ where: { personnelId: { in: removePersonnelIds } } });
    await prisma.attendance.deleteMany({ where: { personnelId: { in: removePersonnelIds } } });
    await prisma.payroll.deleteMany({ where: { personnelId: { in: removePersonnelIds } } });
    await prisma.expense.deleteMany({ where: { personnelId: { in: removePersonnelIds } } });
    await prisma.salaryConfig.deleteMany({ where: { personnelId: { in: removePersonnelIds } } });
    await prisma.shiftAssignment.deleteMany({ where: { personnelId: { in: removePersonnelIds } } });

    // Personel silinince managerId ile bu kişilere bağlı olanlar varsa null'a düşer
    await prisma.personnel.updateMany({
      where: { managerId: { in: removePersonnelIds } },
      data: { managerId: null },
    });

    await prisma.personnel.deleteMany({ where: { id: { in: removePersonnelIds } } });
  }

  if (removeUserIds.length > 0) {
    await prisma.auditLog.updateMany({
      where: { userId: { in: removeUserIds } },
      data: { userId: null },
    });
    await prisma.user.deleteMany({ where: { id: { in: removeUserIds } } });
  }

  console.log(`✅ ${removeUserIds.length} kullanıcı ve bağlı verileri silindi. Kalanlar: ${KEEP_EMAILS.join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
