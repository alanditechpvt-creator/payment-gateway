import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@newweb.com' }
  });
  
  console.log('User found:', {
    id: user?.id,
    email: user?.email,
    role: user?.role
  });
  
  await prisma.$disconnect();
}

checkUser();
