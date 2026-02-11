import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPaymentGateways() {
  console.log('🌱 Seeding payment gateways...');

  // Razorpay
  const razorpay = await prisma.paymentGateway.upsert({
    where: { code: 'RAZORPAY' },
    update: {
      name: 'Razorpay',
      description: 'Razorpay Payment Gateway',
      isActive: true,
      supportedTypes: 'PAYIN,PAYOUT',
    },
    create: {
      name: 'Razorpay',
      code: 'RAZORPAY',
      description: 'Razorpay Payment Gateway',
      isActive: true,
      supportedTypes: 'PAYIN,PAYOUT',
    },
  });
  console.log(`✓ Razorpay (${razorpay.id})`);

  // Sabpaisa
  const sabpaisa = await prisma.paymentGateway.upsert({
    where: { code: 'SABPAISA' },
    update: {
      name: 'Sabpaisa',
      description: 'Sabpaisa Payment Gateway',
      isActive: true,
      supportedTypes: 'PAYIN,PAYOUT',
    },
    create: {
      name: 'Sabpaisa',
      code: 'SABPAISA',
      description: 'Sabpaisa Payment Gateway',
      isActive: true,
      supportedTypes: 'PAYIN,PAYOUT',
    },
  });
  console.log(`✓ Sabpaisa (${sabpaisa.id})`);

  console.log('✅ Payment gateways seeded successfully!');
}

seedPaymentGateways()
  .catch((error) => {
    console.error('❌ Error seeding payment gateways:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
