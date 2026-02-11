import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  DATABASE VERIFICATION');
  console.log('═══════════════════════════════════════════\n');

  // Payment Gateways
  const pgs = await prisma.paymentGateway.findMany();
  console.log(`✓ Payment Gateways: ${pgs.length}`);
  pgs.forEach(pg => console.log(`  - ${pg.name} (${pg.code})`));

  // Transaction Channels
  const channels = await prisma.transactionChannel.findMany({
    include: { paymentGateway: true }
  });
  console.log(`\n✓ Transaction Channels: ${channels.length}`);
  const payinChannels = channels.filter(c => c.transactionType === 'PAYIN');
  const payoutChannels = channels.filter(c => c.transactionType === 'PAYOUT');
  console.log(`  - Payin: ${payinChannels.length}`);
  console.log(`  - Payout: ${payoutChannels.length}`);
  console.log(`  - Default channels: ${channels.filter(c => c.isDefault).length}`);

  // Schemas
  const schemas = await prisma.schema.findMany();
  console.log(`\n✓ Schemas: ${schemas.length}`);
  schemas.forEach(s => console.log(`  - ${s.name} (${s.code})`));

  // Schema Payin Rates
  const payinRates = await prisma.schemaPayinRate.findMany({
    include: {
      schema: true,
      transactionChannel: true,
      paymentGateway: true
    }
  });
  console.log(`\n✓ Schema Payin Rates: ${payinRates.length}`);
  
  for (const schema of schemas) {
    const schemaRates = payinRates.filter(r => r.schemaId === schema.id);
    console.log(`  - ${schema.code}: ${schemaRates.length} rates`);
  }

  // Schema Payout Config
  const payoutConfigs = await prisma.schemaPayoutConfig.findMany({
    include: {
      schema: true,
      paymentGateway: true,
      slabs: true
    }
  });
  console.log(`\n✓ Schema Payout Configs: ${payoutConfigs.length}`);
  
  for (const config of payoutConfigs) {
    console.log(`  - ${config.schema.code}: ${config.slabs.length} slabs (PG: ${config.paymentGateway.name})`);
    config.slabs.forEach(slab => {
      const max = slab.maxAmount ? `₹${slab.maxAmount.toLocaleString('en-IN')}` : '₹∞';
      console.log(`      ₹${slab.minAmount.toLocaleString('en-IN')} - ${max}: ₹${slab.flatCharge}`);
    });
  }

  // Users
  const users = await prisma.user.findMany();
  console.log(`\n✓ Users: ${users.length}`);
  users.forEach(u => console.log(`  - ${u.email} (${u.role})`));

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ VERIFICATION COMPLETE');
  console.log('═══════════════════════════════════════════\n');
}

verify()
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
