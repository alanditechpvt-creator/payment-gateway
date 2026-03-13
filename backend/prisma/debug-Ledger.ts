// backend/prisma/debug-ledger.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Find the transaction by TXN ID
  const tx = await prisma.transaction.findFirst({
    where: { transactionId: 'TXN1772876352640VWKXQM5BQ' },
  });
  console.log('Transaction:', tx);

  if (!tx) {
    console.log('No transaction found with that transactionId');
    return;
  }

  // 2) All commission breakdown rows tied to this TX
  const commissions = await prisma.commissionTransaction.findMany({
    where: { transactionId: tx.id },
  });
  console.log('CommissionTransaction rows:', commissions);

  // 3) Wallet ledger rows tied to this TX (Global Ledger reads these)
  const walletTx = await prisma.walletTransaction.findMany({
    where: { referenceId: tx.id },
  });
  console.log('WalletTransaction rows for this TX:', walletTx);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });