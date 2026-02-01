/**
 * Seed script to add Runpaisa as a Payment Gateway
 * Run with: npx ts-node prisma/seed-runpaisa.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Adding Runpaisa Payment Gateway...');

  // Create or update Runpaisa PG
  const runpaisa = await prisma.paymentGateway.upsert({
    where: { code: 'RUNPAISA' },
    update: {
      name: 'Runpaisa',
      description: 'Runpaisa Payment Gateway - UPI, Cards, Net Banking',
      isActive: true,
      supportedTypes: 'PAYIN', // Runpaisa is for PAYIN only based on docs
      baseRate: 0.02, // 2% default rate
      minAmount: 10, // Minimum ₹10 as per API docs
      maxAmount: 500000, // Max ₹5 Lakh
    },
    create: {
      code: 'RUNPAISA',
      name: 'Runpaisa',
      description: 'Runpaisa Payment Gateway - UPI, Cards, Net Banking',
      isActive: true,
      supportedTypes: 'PAYIN',
      baseRate: 0.02,
      minAmount: 10,
      maxAmount: 500000,
    },
  });

  console.log(`✅ Runpaisa PG added/updated: ${runpaisa.id}`);
  console.log(`   Name: ${runpaisa.name}`);
  console.log(`   Code: ${runpaisa.code}`);
  console.log(`   Status: ${runpaisa.isActive ? 'Active' : 'Inactive'}`);
  console.log(`   Supported Types: ${runpaisa.supportedTypes}`);
  console.log(`   Base Rate: ${(runpaisa.baseRate * 100).toFixed(2)}%`);
  console.log(`   Min Amount: ₹${runpaisa.minAmount}`);
  console.log(`   Max Amount: ₹${runpaisa.maxAmount}`);

  // Check if we need to assign Runpaisa to any schemas
  const schemas = await prisma.schema.findMany();
  
  for (const schema of schemas) {
    // Check if Runpaisa is already assigned to this schema
    const existing = await prisma.schemaPGRate.findUnique({
      where: {
        schemaId_pgId: {
          schemaId: schema.id,
          pgId: runpaisa.id,
        },
      },
    });

    if (!existing) {
      // Assign Runpaisa to the schema with default rate
      await prisma.schemaPGRate.create({
        data: {
          schemaId: schema.id,
          pgId: runpaisa.id,
          payinRate: 0.02, // 2%
          payoutRate: 0, // Not applicable for Runpaisa
          payoutChargeType: 'PERCENTAGE',
        },
      });
      console.log(`   ✅ Assigned to schema: ${schema.name}`);
    } else {
      console.log(`   ℹ️  Already assigned to schema: ${schema.name}`);
    }
  }

  console.log('\n🎉 Runpaisa setup complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Set environment variables in your .env file:');
  console.log('   RUNPAISA_CLIENT_ID="your-client-id"');
  console.log('   RUNPAISA_USERNAME="your-username"');
  console.log('   RUNPAISA_PASSWORD="your-password"');
  console.log('   RUNPAISA_CALLBACK_URL="http://your-domain/api/webhooks/runpaisa"');
  console.log('\n2. Whitelist your IP with Runpaisa support');
  console.log('3. Restart the backend server');
}

main()
  .catch((e) => {
    console.error('Error seeding Runpaisa:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

