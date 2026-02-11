import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkChannels() {
  try {
    const count = await prisma.transactionChannel.count();
    console.log(`Total TransactionChannels: ${count}`);
    
    if (count > 0) {
      const channels = await prisma.transactionChannel.findMany({
        take: 10,
        include: {
          paymentGateway: true
        }
      });
      
      console.log('\nSample channels:');
      channels.forEach(ch => {
        console.log(`- ${ch.name} (${ch.code}) - ${ch.paymentGateway.name} - ${ch.transactionType}`);
      });
    } else {
      console.log('\n❌ No channels found! Need to run seed script.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChannels();
