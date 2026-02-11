import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchemas() {
  try {
    const schemas = await prisma.schema.findMany();
    
    console.log('\n📋 Available Schemas:');
    if (schemas.length === 0) {
      console.log('  ❌ No schemas found!');
    } else {
      schemas.forEach(schema => {
        console.log(`  - ${schema.name} (${schema.code}) - ID: ${schema.id} - Active: ${schema.isActive}`);
      });
    }

    const pgs = await prisma.paymentGateway.findMany();
    console.log('\n💳 Payment Gateways:');
    pgs.forEach(pg => {
      console.log(`  - ${pg.name} (${pg.code}) - ID: ${pg.id}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchemas();
