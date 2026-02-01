
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Adding Razorpay Payment Gateway...');

  // Create or update Razorpay PG
  const razorpay = await prisma.paymentGateway.upsert({
    where: { code: 'RAZORPAY' },
    update: {
      name: 'Razorpay',
      description: 'Razorpay Payment Gateway - Cards, UPI, Netbanking',
      isActive: true,
      supportedTypes: 'PAYIN', 
      baseRate: 0.02, // 2% default rate
      minAmount: 1, // Minimum ₹1
      maxAmount: 500000, // Max ₹5 Lakh
    },
    create: {
      code: 'RAZORPAY',
      name: 'Razorpay',
      description: 'Razorpay Payment Gateway - Cards, UPI, Netbanking',
      isActive: true,
      supportedTypes: 'PAYIN',
      baseRate: 0.02,
      minAmount: 1,
      maxAmount: 500000,
    },
  });

  console.log(`✅ Razorpay PG added/updated: ${razorpay.id}`);
  console.log(`   Name: ${razorpay.name}`);
  console.log(`   Code: ${razorpay.code}`);
  console.log(`   Status: ${razorpay.isActive ? 'Active' : 'Inactive'}`);
  console.log(`   Supported Types: ${razorpay.supportedTypes}`);
  console.log(`   Base Rate: ${(razorpay.baseRate * 100).toFixed(2)}%`);
  console.log(`   Min Amount: ₹${razorpay.minAmount}`);
  console.log(`   Max Amount: ₹${razorpay.maxAmount}`);

  // Check if we need to assign Razorpay to any schemas
  const schemas = await prisma.schema.findMany();
  
  for (const schema of schemas) {
    // Check if Razorpay is already assigned to this schema
    const existing = await prisma.schemaPGRate.findUnique({
      where: {
        schemaId_pgId: {
          schemaId: schema.id,
          pgId: razorpay.id,
        },
      },
    });

    if (!existing) {
      // Assign Razorpay to the schema with default rate
      await prisma.schemaPGRate.create({
        data: {
          schemaId: schema.id,
          pgId: razorpay.id,
          payinRate: 0.02, // 2%
          payoutRate: 0, 
          payoutChargeType: 'PERCENTAGE',
        },
      });
      console.log(`   ✅ Assigned to schema: ${schema.name}`);
    } else {
      console.log(`   ℹ️  Already assigned to schema: ${schema.name}`);
    }
  }

  console.log('\n🎉 Razorpay setup complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding Razorpay:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
