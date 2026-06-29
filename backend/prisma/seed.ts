import { PrismaClient, Role, ContractType, LeaveType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed başlıyor...');

  // === Admin kullanıcı ===
  const adminPass = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@firma.com' },
    update: {},
    create: { email: 'admin@firma.com', passwordHash: adminPass, role: Role.ADMIN },
  });
  console.log('✅ Admin: admin@firma.com / Admin123!');

  // === Şube ===
  const branch = await prisma.branch.upsert({
    where: { id: 'branch-hq' },
    update: {},
    create: {
      id: 'branch-hq',
      name: 'Genel Müdürlük',
      city: 'İstanbul',
      address: 'Levent Mah. No:1',
    },
  });

  // === Departmanlar ===
  const itDept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: { code: 'IT', name: 'Bilgi Teknolojileri', branchId: branch.id },
  });
  const hrDept = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: { code: 'HR', name: 'İnsan Kaynakları', branchId: branch.id },
  });
  const finDept = await prisma.department.upsert({
    where: { code: 'FIN' },
    update: {},
    create: { code: 'FIN', name: 'Finans', branchId: branch.id },
  });

  // === Pozisyonlar ===
  const seniorDev = await prisma.position.create({
    data: { title: 'Senior Developer', departmentId: itDept.id, level: 4 },
  });
  const hrManager = await prisma.position.create({
    data: { title: 'İK Müdürü', departmentId: hrDept.id, level: 5 },
  });
  const accountant = await prisma.position.create({
    data: { title: 'Muhasebeci', departmentId: finDept.id, level: 3 },
  });

  // === Vardiya ===
  await prisma.shift.create({
    data: { name: 'Standart', startTime: '09:00', endTime: '18:00', breakMin: 60 },
  });

  // === İK Müdürü ===
  const hrPass = await bcrypt.hash('Hr123456!', 12);
  const hrUser = await prisma.user.create({
    data: { email: 'ik@firma.com', passwordHash: hrPass, role: Role.HR },
  });
  const hrPersonnel = await prisma.personnel.create({
    data: {
      employeeNo: 'EMP-0001',
      userId: hrUser.id,
      firstName: 'Ayşe',
      lastName: 'Yılmaz',
      tcKimlikNo: '12345678901',
      phone: '+905551112233',
      departmentId: hrDept.id,
      positionId: hrManager.id,
      contractType: ContractType.PERMANENT,
      hireDate: new Date('2020-01-15'),
    },
  });
  console.log('✅ İK Müdürü: ik@firma.com / Hr123456!');

  // === Test çalışan ===
  const empPass = await bcrypt.hash('Emp123456!', 12);
  const empUser = await prisma.user.create({
    data: { email: 'mehmet@firma.com', passwordHash: empPass, role: Role.EMPLOYEE },
  });
  const employee = await prisma.personnel.create({
    data: {
      employeeNo: 'EMP-0002',
      userId: empUser.id,
      firstName: 'Mehmet',
      lastName: 'Demir',
      tcKimlikNo: '12345678902',
      phone: '+905551112244',
      departmentId: itDept.id,
      positionId: seniorDev.id,
      managerId: hrPersonnel.id,
      contractType: ContractType.PERMANENT,
      hireDate: new Date('2022-03-01'),
    },
  });

  // Maaş tanımı
  await prisma.salaryConfig.create({
    data: {
      personnelId: employee.id,
      grossSalary: 75000,
      mealAllowance: 3000,
      transportAllowance: 1500,
      bes: 750,
    },
  });

  // İzin bakiyesi
  await prisma.leaveBalance.create({
    data: {
      personnelId: employee.id,
      year: new Date().getFullYear(),
      type: LeaveType.ANNUAL,
      totalDays: 14,
      remainingDays: 14,
    },
  });
  console.log('✅ Çalışan: mehmet@firma.com / Emp123456!');

  // === Resmi tatiller (TR 2025 - örnek) ===
  const holidays = [
    { name: 'Yılbaşı', date: '2025-01-01', recurring: true },
    { name: 'Ulusal Egemenlik ve Çocuk Bayramı', date: '2025-04-23', recurring: true },
    { name: 'Emek ve Dayanışma Günü', date: '2025-05-01', recurring: true },
    { name: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı', date: '2025-05-19', recurring: true },
    { name: 'Demokrasi ve Milli Birlik Günü', date: '2025-07-15', recurring: true },
    { name: 'Zafer Bayramı', date: '2025-08-30', recurring: true },
    { name: 'Cumhuriyet Bayramı', date: '2025-10-29', recurring: true },
  ];
  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { name_date: { name: h.name, date: new Date(h.date) } },
      update: {},
      create: { name: h.name, date: new Date(h.date), recurring: h.recurring },
    });
  }

  // === KVKK saklama politikaları ===
  await prisma.dataRetentionPolicy.upsert({
    where: { entity: 'AuditLog' },
    update: {},
    create: { entity: 'AuditLog', retentionDays: 365 * 2 },
  });
  await prisma.dataRetentionPolicy.upsert({
    where: { entity: 'Personnel' },
    update: {},
    create: { entity: 'Personnel', retentionDays: 365 * 10, anonymizeAfter: true },
  });

  // === Örnek iş ilanı ===
  await prisma.jobPosting.create({
    data: {
      title: 'Backend Developer',
      description: 'NestJS, PostgreSQL bilen geliştirici aranıyor',
      requirements: '3+ yıl deneyim, TypeScript, Prisma',
      location: 'İstanbul / Hibrit',
      departmentId: itDept.id,
    },
  });

  console.log('✨ Seed tamamlandı!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
