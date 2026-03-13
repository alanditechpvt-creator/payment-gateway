import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSchemas() {
  console.log('🌱 Seeding schemas...');

  // Get or create admin user
  let admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!admin) {
    console.log('Creating admin user...');
    admin = await prisma.user.create({
      data: {
        email: 'admin@alandi.in',
        password: '$2b$10$YourHashedPasswordHere', // You'll need to hash this properly
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'System',
        lastName: 'Admin',
        emailVerified: true,
      }
    });
    console.log(`✓ Admin created (${admin.id})`);
  }

  // Platinum Schema — single rate 1.8%
  const platinum = await prisma.schema.upsert({
    where: { code: 'PLATINUM' },
    update: {
      name: 'Platinum Plan',
      description: 'Best rates for high-volume users',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.018,
      isActive: true,
    },
    create: {
      name: 'Platinum Plan',
      code: 'PLATINUM',
      description: 'Best rates for high-volume users',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.018,
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ Platinum (${platinum.id})`);

  // Gold Schema — 1.7%
  const gold = await prisma.schema.upsert({
    where: { code: 'GOLD' },
    update: {
      name: 'Gold Plan',
      description: 'Standard rates for regular users',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.017,
      isActive: true,
    },
    create: {
      name: 'Gold Plan',
      code: 'GOLD',
      description: 'Standard rates for regular users',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.017,
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ Gold (${gold.id})`);

  // Silver Schema — 2%
  const silver = await prisma.schema.upsert({
    where: { code: 'SILVER' },
    update: {
      name: 'Silver Plan',
      description: 'Basic rates for new users',
      applicableRoles: 'RETAILER',
      payinRate: 0.02,
      isActive: true,
      isDefault: true,
    },
    create: {
      name: 'Silver Plan',
      code: 'SILVER',
      description: 'Basic rates for new users',
      applicableRoles: 'RETAILER',
      payinRate: 0.02,
      isActive: true,
      isDefault: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ Silver (${silver.id})`);

  // RATE15 = 1.5% (PG base e.g. 1.4% → admin 0.1%)
  const rate15 = await prisma.schema.upsert({
    where: { code: 'RATE15' },
    update: {
      name: 'RATE15',
      description: '1.5% — one rate for all channels',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.015,
      isActive: true,
    },
    create: {
      name: 'RATE15',
      code: 'RATE15',
      description: '1.5% — one rate for all channels',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.015,
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ RATE15 (${rate15.id})`);

  // RATE145 = 1.45%
  await prisma.schema.upsert({
    where: { code: 'RATE145' },
    update: {
      name: 'RATE145',
      description: '1.45% — one rate for all channels',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.0145,
      isActive: true,
    },
    create: {
      name: 'RATE145',
      code: 'RATE145',
      description: '1.45% — one rate for all channels',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.0145,
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ RATE145`);

  // RATE16 = 1.6%
  await prisma.schema.upsert({
    where: { code: 'RATE16' },
    update: {
      name: 'RATE16',
      description: '1.6% — one rate for all channels',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.016,
      isActive: true,
    },
    create: {
      name: 'RATE16',
      code: 'RATE16',
      description: '1.6% — one rate for all channels',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.016,
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ RATE16`);

  // RATE17 = 1.7%
  await prisma.schema.upsert({
    where: { code: 'RATE17' },
    update: {
      name: 'RATE17',
      description: '1.7% — one rate for all channels',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.017,
      isActive: true,
    },
    create: {
      name: 'RATE17',
      code: 'RATE17',
      description: '1.7% — one rate for all channels',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      payinRate: 0.017,
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ RATE17`);

  console.log('✅ Schemas seeded successfully!');
}

seedSchemas()
  .catch((error) => {
    console.error('❌ Error seeding schemas:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
