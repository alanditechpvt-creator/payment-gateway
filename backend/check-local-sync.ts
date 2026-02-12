import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSync() {
  console.log('🔍 Checking local database sync...\n');

  // Check PGs
  const pgs = await prisma.paymentGateway.findMany({
    select: {
      name: true,
      code: true,
      _count: {
        select: {
          transactionChannels: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log('Payment Gateways with Channel Counts:');
  console.log('═══════════════════════════════════════');
  pgs.forEach(pg => {
    console.log(`${pg.name} (${pg.code}): ${pg._count.transactionChannels} channels`);
  });

  console.log('\n✅ Local database sync check complete!');
  
  await prisma.$disconnect();
}

checkSync().catch(console.error);
