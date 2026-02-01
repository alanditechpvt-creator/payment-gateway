import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTransaction() {
  const txnId = 'TXN176984278592210RY7CRE5';
  
  console.log(`\nSearching for transaction: ${txnId}\n`);
  
  const transaction = await prisma.transaction.findUnique({
    where: { transactionId: txnId },
    include: {
      initiator: true,
      paymentGateway: true,
    }
  });
  
  if (transaction) {
    console.log('✅ Transaction Found:');
    console.log(`   ID: ${transaction.id}`);
    console.log(`   Transaction ID: ${transaction.transactionId}`);
    console.log(`   Status: ${transaction.status}`);
    console.log(`   Amount: ₹${transaction.amount}`);
    console.log(`   Type: ${transaction.type}`);
    console.log(`   Payment Gateway: ${transaction.paymentGateway?.name}`);
    console.log(`   Initiator: ${transaction.initiator?.email}`);
    console.log(`   Created: ${transaction.createdAt}`);
    console.log(`   Updated: ${transaction.updatedAt}`);
    console.log(`   PG Transaction ID: ${transaction.pgTransactionId || 'N/A'}`);
    console.log(`   PG Response: ${transaction.pgResponse || 'N/A'}`);
  } else {
    console.log('❌ Transaction NOT found');
    
    // Search for recent transactions
    console.log('\n📋 Recent Sabpaisa transactions:');
    const recentTxns = await prisma.transaction.findMany({
      where: {
        paymentGateway: {
          code: 'SABPAISA'
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        paymentGateway: true,
      }
    });
    
    if (recentTxns.length > 0) {
      recentTxns.forEach((txn, idx) => {
        console.log(`\n   ${idx + 1}. ${txn.transactionId}`);
        console.log(`      Status: ${txn.status}`);
        console.log(`      Amount: ₹${txn.amount}`);
        console.log(`      Created: ${txn.createdAt}`);
      });
    } else {
      console.log('   No Sabpaisa transactions found');
    }
  }
  
  await prisma.$disconnect();
}

checkTransaction().catch(console.error);
