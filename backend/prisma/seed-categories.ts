import { PrismaClient, LeaveType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Yerleşik (enum) izin türlerini LeaveCategory tablosuna "sistem kategorisi"
 * olarak ekler. Böylece bunların görünürlüğü de kişiye özel yönetilebilir.
 * Idempotent: tekrar çalıştırılabilir (upsert).
 *
 * Çalıştırma:  npx ts-node prisma/seed-categories.ts
 */
const SYSTEM_CATEGORIES: Array<{
  code: LeaveType;
  name: string;
  isPaid: boolean;
  affectsAnnualBalance: boolean;
}> = [
  { code: 'ANNUAL', name: 'Yıllık İzin', isPaid: true, affectsAnnualBalance: true },
  { code: 'HALF_DAY', name: 'Yarım Gün', isPaid: true, affectsAnnualBalance: false },
  { code: 'HOURLY', name: 'Saatlik İzin', isPaid: true, affectsAnnualBalance: false },
  { code: 'EXCUSE', name: 'Mazeret İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'SICK', name: 'Sağlık Raporu', isPaid: true, affectsAnnualBalance: false },
  { code: 'MATERNITY', name: 'Doğum İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'PATERNITY', name: 'Babalık İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'MARRIAGE', name: 'Evlilik İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'BEREAVEMENT', name: 'Vefat İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'UNPAID', name: 'Ücretsiz İzin', isPaid: false, affectsAnnualBalance: false },
];

async function main() {
  for (const c of SYSTEM_CATEGORIES) {
    await prisma.leaveCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, isPaid: c.isPaid, affectsAnnualBalance: c.affectsAnnualBalance, isSystem: true },
      create: {
        code: c.code,
        name: c.name,
        isPaid: c.isPaid,
        affectsAnnualBalance: c.affectsAnnualBalance,
        defaultVisible: true,
        isActive: true,
        isSystem: true,
      },
    });
    console.log(`✓ ${c.code} -> ${c.name}`);
  }
  console.log('Sistem kategorileri hazır.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
