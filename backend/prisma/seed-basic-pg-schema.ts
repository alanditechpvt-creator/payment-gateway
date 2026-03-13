import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding basic payment gateways and default schema...');

  // Find any admin user to attach schema to
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!admin) {
    console.log('⚠️ No ADMIN user found. Create an admin user first, then re-run this script.');
    return;
  }

  // Upsert core payment gateways used in the app
  const gatewaysData = [
    {
      code: 'RUNPAISA',
      name: 'Runpaisa',
      description: 'Runpaisa payment gateway',
    },
    {
      code: 'SABPAISA',
      name: 'SabPaisa',
      description: 'SabPaisa payment gateway',
    },
    {
      code: 'CASHFREE',
      name: 'Cashfree',
      description: 'Cashfree payment gateway',
    },
  ];

  const gateways = [];

  for (const pg of gatewaysData) {
    const saved = await prisma.paymentGateway.upsert({
      where: { code: pg.code },
      update: {
        name: pg.name,
        description: pg.description,
        isActive: true,
        supportedTypes: 'PAYIN,PAYOUT',
      },
      create: {
        name: pg.name,
        code: pg.code,
        description: pg.description,
        isActive: true,
        supportedTypes: 'PAYIN,PAYOUT',
      },
    });
    gateways.push(saved);
    console.log(`✅ Payment gateway ready: ${saved.name} (${saved.code})`);
  }

  // Create a simple default schema for rates, if not present
  const defaultSchemaCode = 'DEFAULT_RATE';
  const defaultSchema = await prisma.schema.upsert({
    where: { code: defaultSchemaCode },
    update: {},
    create: {
      name: 'Default Rate Schema',
      code: defaultSchemaCode,
      description: 'Default rate schema for all users',
      createdById: admin.id,
      applicableRoles: 'RETAILER',
      payinRate: 0.02, // 2%
      isActive: true,
      isDefault: true,
    },
  });

  console.log(`✅ Default schema ready: ${defaultSchema.name} (${defaultSchema.code})`);

  console.log('✨ Basic payment gateways and default schema seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

