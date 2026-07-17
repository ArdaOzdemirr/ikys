import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMAILS = ['savas@firma.com', 'abidin@firma.com', 'emir@firma.com', 'ik@firma.com'];

async function main() {
  const shift = await prisma.shift.findFirst({ where: { name: 'Standart' } });
  if (!shift) throw new Error('Standart vardiya bulunamadı');

  const users = await prisma.user.findMany({
    where: { email: { in: EMAILS } },
    select: { id: true, email: true },
  });

  for (const u of users) {
    const personnel = await prisma.personnel.findUnique({ where: { userId: u.id } });
    if (!personnel) continue;

    const existing = await prisma.shiftAssignment.findFirst({
      where: { personnelId: personnel.id, shiftId: shift.id, endDate: null },
    });
    if (existing) {
      console.log(`⚠️ ${u.email} zaten atanmış, atlandı.`);
      continue;
    }

    await prisma.shiftAssignment.create({
      data: { personnelId: personnel.id, shiftId: shift.id, startDate: new Date() },
    });
    console.log(`✅ ${u.email} -> Standart (${shift.startTime}-${shift.endTime})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
