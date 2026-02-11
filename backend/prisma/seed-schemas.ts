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

  // Platinum Schema
  const platinum = await prisma.schema.upsert({
    where: { code: 'PLATINUM' },
    update: {
      name: 'Platinum Plan',
      description: 'Best rates for high-volume users',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      isActive: true,
    },
    create: {
      name: 'Platinum Plan',
      code: 'PLATINUM',
      description: 'Best rates for high-volume users',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ Platinum (${platinum.id})`);

  // Gold Schema
  const gold = await prisma.schema.upsert({
    where: { code: 'GOLD' },
    update: {
      name: 'Gold Plan',
      description: 'Standard rates for regular users',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      isActive: true,
    },
    create: {
      name: 'Gold Plan',
      code: 'GOLD',
      description: 'Standard rates for regular users',
      applicableRoles: 'RETAILER,DISTRIBUTOR',
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ Gold (${gold.id})`);

  // Silver Schema
  const silver = await prisma.schema.upsert({
    where: { code: 'SILVER' },
    update: {
      name: 'Silver Plan',
      description: 'Basic rates for new users',
      applicableRoles: 'RETAILER',
      isActive: true,
      isDefault: true,
    },
    create: {
      name: 'Silver Plan',
      code: 'SILVER',
      description: 'Basic rates for new users',
      applicableRoles: 'RETAILER',
      isActive: true,
      isDefault: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ Silver (${silver.id})`);

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
