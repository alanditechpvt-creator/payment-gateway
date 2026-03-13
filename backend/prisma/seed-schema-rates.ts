import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed schema-level rates and payout configuration
 * 
 * For each schema:
 * 1. Configure payin rates per transaction channel
 * 2. Configure payout PG and slab-based charges
 */

async function seedSchemaRates() {
  console.log('🌱 Seeding schema rates and payout configuration...');

  // Get all schemas
  const schemas = await prisma.schema.findMany({
    where: { isActive: true }
  });

  if (schemas.length === 0) {
    console.log('⚠️  No schemas found. Please create schemas first.');
    return;
  }

  // Get payment gateways
  const razorpay = await prisma.paymentGateway.findUnique({
    where: { code: 'RAZORPAY' }
  });

  const sabpaisa = await prisma.paymentGateway.findUnique({
    where: { code: 'SABPAISA' }
  });

  if (!razorpay && !sabpaisa) {
    console.log('⚠️  No payment gateways found. Please seed payment gateways first.');
    return;
  }

  for (const schema of schemas) {
    console.log(`\n📦 Configuring rates for schema: ${schema.name} (${schema.code})`);

    // Configure payin rates
    await seedSchemaPayinRates(schema, razorpay, sabpaisa);

    // Configure payout (use first available PG that supports payout)
    const payoutPG = razorpay?.supportedTypes.includes('PAYOUT') ? razorpay : sabpaisa;
    if (payoutPG) {
      await seedSchemaPayoutConfig(schema, payoutPG);
    }
  }

  console.log('\n✅ Schema rates seeded successfully!');
}

async function seedSchemaPayinRates(schema: any, razorpay: any, sabpaisa: any) {
  console.log('  📊 Setting payin rates...');

  // RATE15: fixed base 1.4%, successor (user) rate 1.5% for every channel
  const isRate15 = schema.code === 'RATE15';
  const fixedBase = 0.014;
  const fixedPayin = 0.015;

  const baseRateMultiplier = schema.code === 'PLATINUM' ? 1.0 :
                             schema.code === 'GOLD' ? 1.1 :
                             schema.code === 'SILVER' ? 1.2 : 1.0;

  const setRate = async (pg: any, channel: any, pgName: string) => {
    const baseRate = isRate15 ? fixedBase : (channel.baseCost ?? 0.02);
    const payinRate = isRate15 ? fixedPayin : (channel.baseCost * baseRateMultiplier);
    try {
      await prisma.schemaPayinRate.upsert({
        where: {
          schemaId_channelId: {
            schemaId: schema.id,
            channelId: channel.id,
          }
        },
        create: {
          schemaId: schema.id,
          channelId: channel.id,
          pgId: pg.id,
          baseRate,
          payinRate,
          isEnabled: true,
        },
        update: {
          baseRate,
          payinRate,
          isEnabled: true,
        }
      });
      const baseStr = (baseRate * 100).toFixed(2);
      const payinStr = (payinRate * 100).toFixed(2);
      console.log(`    ✓ ${pgName} - ${channel.name}: base ${baseStr}% → user ${payinStr}%`);
    } catch (error: any) {
      console.error(`    ✗ Failed to set rate for ${channel.name}:`, error.message);
    }
  };

  if (razorpay) {
    const razorpayChannels = await prisma.transactionChannel.findMany({
      where: {
        pgId: razorpay.id,
        transactionType: 'PAYIN',
        isActive: true,
        isDefault: false,
      }
    });
    for (const channel of razorpayChannels) {
      await setRate(razorpay, channel, 'Razorpay');
    }
  }

  if (sabpaisa) {
    const sabpaisaChannels = await prisma.transactionChannel.findMany({
      where: {
        pgId: sabpaisa.id,
        transactionType: 'PAYIN',
        isActive: true,
        isDefault: false,
      }
    });
    for (const channel of sabpaisaChannels) {
      await setRate(sabpaisa, channel, 'Sabpaisa');
    }
  }
}

async function seedSchemaPayoutConfig(schema: any, payoutPG: any) {
  console.log(`  💸 Setting payout configuration (PG: ${payoutPG.name})...`);

  try {
    // Create or update payout config
    const config = await prisma.schemaPayoutConfig.upsert({
      where: {
        schemaId: schema.id,
      },
      create: {
        schemaId: schema.id,
        pgId: payoutPG.id,
      },
      update: {
        pgId: payoutPG.id,
      }
    });

    // Delete existing slabs
    await prisma.payoutSlab.deleteMany({
      where: { schemaPayoutConfigId: config.id }
    });

    // Define slabs based on schema
    // Platinum < Gold < Silver (Platinum gets best rates)
    const slabs = schema.code === 'PLATINUM' ? [
      { minAmount: 1, maxAmount: 50000, flatCharge: 10 },
      { minAmount: 50001, maxAmount: 100000, flatCharge: 12 },
      { minAmount: 100001, maxAmount: 200000, flatCharge: 15 },
      { minAmount: 200001, maxAmount: null, flatCharge: 20 },
    ] : schema.code === 'GOLD' ? [
      { minAmount: 1, maxAmount: 50000, flatCharge: 12 },
      { minAmount: 50001, maxAmount: 100000, flatCharge: 15 },
      { minAmount: 100001, maxAmount: 200000, flatCharge: 20 },
      { minAmount: 200001, maxAmount: null, flatCharge: 25 },
    ] : [
      // SILVER or default
      { minAmount: 1, maxAmount: 50000, flatCharge: 15 },
      { minAmount: 50001, maxAmount: 100000, flatCharge: 18 },
      { minAmount: 100001, maxAmount: 200000, flatCharge: 22 },
      { minAmount: 200001, maxAmount: null, flatCharge: 28 },
    ];

    // Create new slabs
    for (const slab of slabs) {
      await prisma.payoutSlab.create({
        data: {
          schemaPayoutConfigId: config.id,
          minAmount: slab.minAmount,
          maxAmount: slab.maxAmount,
          flatCharge: slab.flatCharge,
        }
      });

      const maxDisplay = slab.maxAmount ? `₹${slab.maxAmount.toLocaleString('en-IN')}` : '₹∞';
      console.log(`    ✓ ₹${slab.minAmount.toLocaleString('en-IN')} - ${maxDisplay}: ₹${slab.flatCharge}`);
    }
  } catch (error: any) {
    console.error(`  ✗ Failed to set payout config:`, error.message);
  }
}

// Run seed
seedSchemaRates()
  .catch((error) => {
    console.error('❌ Error seeding schema rates:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
