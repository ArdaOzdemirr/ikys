import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'ik@firma.com' } });
  if (existing) {
    console.log('⚠️ ik@firma.com zaten var, hiçbir şey yapılmadı.');
    return;
  }

  const pass = await bcrypt.hash('ik12345!', 12);
  const user = await prisma.user.create({
    data: { email: 'ik@firma.com', passwordHash: pass, role: Role.HR },
  });
  await prisma.personnel.create({
    data: {
      employeeNo: 'EMP-IK',
      userId: user.id,
      firstName: 'İK',
      lastName: '.',
      tcKimlikNo: '44444444440',
      contractType: 'PERMANENT',
      hireDate: new Date(),
    },
  });
  console.log('✅ ik@firma.com / ik12345! (HR) oluşturuldu');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
