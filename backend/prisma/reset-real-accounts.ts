import { PrismaClient, Role, ContractType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const OLD_EMAILS = ['admin@firma.com', 'ik@firma.com', 'mehmet@firma.com', 'yazilim@firma.com'];

async function main() {
  console.log('🧹 Eski demo hesapları temizleniyor...');

  const oldUsers = await prisma.user.findMany({
    where: { email: { in: OLD_EMAILS } },
    select: { id: true },
  });
  const oldUserIds = oldUsers.map((u) => u.id);

  const oldPersonnel = await prisma.personnel.findMany({
    where: { userId: { in: oldUserIds } },
    select: { id: true },
  });
  const oldPersonnelIds = oldPersonnel.map((p) => p.id);

  if (oldPersonnelIds.length > 0) {
    // Referans alanlarını temizle (silmeden önce FK engeli kalmasın)
    await prisma.notification.updateMany({
      where: { senderId: { in: oldPersonnelIds } },
      data: { senderId: null },
    });
    await prisma.leaveRequest.updateMany({
      where: { approverId: { in: oldPersonnelIds } },
      data: { approverId: null },
    });
    await prisma.leaveRequest.updateMany({
      where: { cancelApproverId: { in: oldPersonnelIds } },
      data: { cancelApproverId: null },
    });
    await prisma.leaveCategory.updateMany({
      where: { createdById: { in: oldPersonnelIds } },
      data: { createdById: null },
    });
    await prisma.expense.updateMany({
      where: { approverId: { in: oldPersonnelIds } },
      data: { approverId: null },
    });
    await prisma.expense.updateMany({
      where: { paidById: { in: oldPersonnelIds } },
      data: { paidById: null },
    });

    // Bağımlı kayıtları sil
    await prisma.leaveApprovalStep.deleteMany({ where: { approverId: { in: oldPersonnelIds } } });
    await prisma.leaveRequest.deleteMany({ where: { personnelId: { in: oldPersonnelIds } } });
    await prisma.leaveCategoryAccess.deleteMany({ where: { personnelId: { in: oldPersonnelIds } } });
    await prisma.leaveBalance.deleteMany({ where: { personnelId: { in: oldPersonnelIds } } });
    await prisma.attendance.deleteMany({ where: { personnelId: { in: oldPersonnelIds } } });
    await prisma.payroll.deleteMany({ where: { personnelId: { in: oldPersonnelIds } } });
    await prisma.expense.deleteMany({ where: { personnelId: { in: oldPersonnelIds } } });
    await prisma.salaryConfig.deleteMany({ where: { personnelId: { in: oldPersonnelIds } } });
    await prisma.shiftAssignment.deleteMany({ where: { personnelId: { in: oldPersonnelIds } } });

    // Document / DeviceToken / Notification(recipient) onDelete: Cascade -> Personnel silinince otomatik gider
    await prisma.personnel.deleteMany({ where: { id: { in: oldPersonnelIds } } });
  }

  if (oldUserIds.length > 0) {
    await prisma.auditLog.updateMany({
      where: { userId: { in: oldUserIds } },
      data: { userId: null },
    });
    // RefreshToken onDelete: Cascade -> otomatik gider
    await prisma.user.deleteMany({ where: { id: { in: oldUserIds } } });
  }

  console.log('✅ Eski demo hesaplar silindi');

  // === Gerçek şirket hesapları ===
  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!branch) throw new Error('Şube bulunamadı, önce bir Branch oluşturulmalı');

  const yazilimDept = await prisma.department.upsert({
    where: { code: 'YAZILIM' },
    update: {},
    create: { code: 'YAZILIM', name: 'Yazılım', branchId: branch.id },
  });

  const genelMudurPos = await prisma.position.create({
    data: { title: 'Genel Müdür', departmentId: yazilimDept.id, level: 5 },
  });
  const yazilimGelistiriciPos = await prisma.position.create({
    data: { title: 'Yazılım Geliştirici', departmentId: yazilimDept.id, level: 2 },
  });

  const savasPass = await bcrypt.hash('savas123!', 12);
  const savasUser = await prisma.user.create({
    data: { email: 'savas@firma.com', passwordHash: savasPass, role: Role.ADMIN },
  });
  const savasPersonnel = await prisma.personnel.create({
    data: {
      employeeNo: 'EMP-SAVAS',
      userId: savasUser.id,
      firstName: 'Savaş',
      lastName: '.',
      tcKimlikNo: '11111111110',
      departmentId: yazilimDept.id,
      positionId: genelMudurPos.id,
      contractType: ContractType.PERMANENT,
      hireDate: new Date(),
    },
  });
  console.log('✅ savas@firma.com / savas123! (ADMIN)');

  const abidinPass = await bcrypt.hash('abidin123!', 12);
  const abidinUser = await prisma.user.create({
    data: { email: 'abidin@firma.com', passwordHash: abidinPass, role: Role.EMPLOYEE },
  });
  await prisma.personnel.create({
    data: {
      employeeNo: 'EMP-ABIDIN',
      userId: abidinUser.id,
      firstName: 'Abidin',
      lastName: '.',
      tcKimlikNo: '22222222220',
      departmentId: yazilimDept.id,
      positionId: yazilimGelistiriciPos.id,
      managerId: savasPersonnel.id,
      contractType: ContractType.PERMANENT,
      hireDate: new Date(),
    },
  });
  console.log('✅ abidin@firma.com / abidin123! (EMPLOYEE, Savaş\'a bağlı)');

  const emirPass = await bcrypt.hash('emir123!', 12);
  const emirUser = await prisma.user.create({
    data: { email: 'emir@firma.com', passwordHash: emirPass, role: Role.EMPLOYEE },
  });
  await prisma.personnel.create({
    data: {
      employeeNo: 'EMP-EMIR',
      userId: emirUser.id,
      firstName: 'Emir',
      lastName: '.',
      tcKimlikNo: '33333333330',
      departmentId: yazilimDept.id,
      positionId: yazilimGelistiriciPos.id,
      managerId: savasPersonnel.id,
      contractType: ContractType.PERMANENT,
      hireDate: new Date(),
    },
  });
  console.log('✅ emir@firma.com / emir123! (EMPLOYEE, Savaş\'a bağlı)');

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
