
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Adding SabPaisa Payment Gateway...');

  // Create or update SabPaisa PG
  const sabpaisa = await prisma.paymentGateway.upsert({
    where: { code: 'SABPAISA' },
    update: {
      name: 'SabPaisa',
      description: 'SabPaisa Payment Gateway - UPI, Cards, Net Banking',
      isActive: true,
      supportedTypes: 'PAYIN', // SabPaisa for Payin
      baseRate: 0.02, // 2% default rate
      minAmount: 10, // Minimum ₹10
      maxAmount: 500000, // Max ₹5 Lakh
    },
    create: {
      code: 'SABPAISA',
      name: 'SabPaisa',
      description: 'SabPaisa Payment Gateway - UPI, Cards, Net Banking',
      isActive: true,
      supportedTypes: 'PAYIN',
      baseRate: 0.02,
      minAmount: 10,
      maxAmount: 500000,
    },
  });

  console.log(`✅ SabPaisa PG added/updated: ${sabpaisa.id}`);
  console.log(`   Name: ${sabpaisa.name}`);
  console.log(`   Code: ${sabpaisa.code}`);
  console.log(`   Status: ${sabpaisa.isActive ? 'Active' : 'Inactive'}`);
  console.log(`   Supported Types: ${sabpaisa.supportedTypes}`);
  console.log(`   Base Rate: ${(sabpaisa.baseRate * 100).toFixed(2)}%`);
  console.log(`   Min Amount: ₹${sabpaisa.minAmount}`);
  console.log(`   Max Amount: ₹${sabpaisa.maxAmount}`);

  // Check if we need to assign SabPaisa to any schemas
  const schemas = await prisma.schema.findMany();
  
  for (const schema of schemas) {
    // Check if SabPaisa is already assigned to this schema
    const existing = await prisma.schemaPGRate.findUnique({
      where: {
        schemaId_pgId: {
          schemaId: schema.id,
          pgId: sabpaisa.id,
        },
      },
    });

    if (!existing) {
      // Assign SabPaisa to the schema with default rate
      await prisma.schemaPGRate.create({
        data: {
          schemaId: schema.id,
          pgId: sabpaisa.id,
          payinRate: 0.02, // 2%
          payoutRate: 0, // Not applicable for Payin-only
          payoutChargeType: 'PERCENTAGE',
        },
      });
      console.log(`   ✅ Assigned to schema: ${schema.name}`);
    } else {
      console.log(`   ℹ️  Already assigned to schema: ${schema.name}`);
    }
  }

  console.log('\n🎉 SabPaisa setup complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding SabPaisa:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
