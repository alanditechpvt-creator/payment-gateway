import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@alandi.in';
  const plainPassword = 'Admin@123456';

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,   // <-- use `password`
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'Admin',
      lastName: 'User',
    },
    create: {
      email,
      password: passwordHash,   // <-- use `password`
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  console.log('Admin user ready:');
  console.log('  Email   :', email);
  console.log('  Password:', plainPassword);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });