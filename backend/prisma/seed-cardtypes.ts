/**
 * Seed script for Card Types
 * Run with: npx ts-node prisma/seed-cardtypes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Seeding Card Types...\n');

  // Find Runpaisa PG
  let runpaisa = await prisma.paymentGateway.findFirst({
    where: { code: 'RUNPAISA' },
  });

  if (!runpaisa) {
    console.log('⚠️ Runpaisa PG not found. Creating it...');
    runpaisa = await prisma.paymentGateway.create({
      data: {
        name: 'Runpaisa',
        code: 'RUNPAISA',
        description: 'PG Aggregator with multiple internal PGs',
        isAggregator: true,
        isActive: true,
        supportedTypes: 'PAYIN,PAYOUT',
        baseRate: 0.02, // 2% default
      },
    });
  } else {
    // Update to mark as aggregator
    await prisma.paymentGateway.update({
      where: { id: runpaisa.id },
      data: { isAggregator: true },
    });
  }

  console.log(`✅ Runpaisa PG: ${runpaisa.id}\n`);

  // Define card types for Runpaisa
  // Format: internalPG_cardNetwork-cardCategory
  const cardTypes = [
    // PayU Card Types
    { internalPG: 'payu', cardNetwork: 'VISA', cardCategory: 'NORMAL', baseRate: 0.01 },    // 1%
    { internalPG: 'payu', cardNetwork: 'VISA', cardCategory: 'CORPORATE', baseRate: 0.015 }, // 1.5%
    { internalPG: 'payu', cardNetwork: 'MASTER', cardCategory: 'NORMAL', baseRate: 0.01 },
    { internalPG: 'payu', cardNetwork: 'MASTER', cardCategory: 'CORPORATE', baseRate: 0.018 }, // 1.8%
    { internalPG: 'payu', cardNetwork: 'RUPAY', cardCategory: 'NORMAL', baseRate: 0.008 },  // 0.8%
    { internalPG: 'payu', cardNetwork: 'AMEX', cardCategory: 'NORMAL', baseRate: 0.025 },   // 2.5%
    { internalPG: 'payu', cardNetwork: 'AMEX', cardCategory: 'CORPORATE', baseRate: 0.03 }, // 3%
    
    // Cashfree Card Types
    { internalPG: 'cashfree', cardNetwork: 'VISA', cardCategory: 'NORMAL', baseRate: 0.012 },
    { internalPG: 'cashfree', cardNetwork: 'VISA', cardCategory: 'CORPORATE', baseRate: 0.016 },
    { internalPG: 'cashfree', cardNetwork: 'MASTER', cardCategory: 'NORMAL', baseRate: 0.012 },
    { internalPG: 'cashfree', cardNetwork: 'MASTER', cardCategory: 'CORPORATE', baseRate: 0.019 },
    { internalPG: 'cashfree', cardNetwork: 'RUPAY', cardCategory: 'NORMAL', baseRate: 0.009 },
    
    // Razorpay Card Types
    { internalPG: 'razorpay', cardNetwork: 'VISA', cardCategory: 'NORMAL', baseRate: 0.018 },
    { internalPG: 'razorpay', cardNetwork: 'VISA', cardCategory: 'CORPORATE', baseRate: 0.022 },
    { internalPG: 'razorpay', cardNetwork: 'VISA', cardCategory: 'PREMIUM', baseRate: 0.025 },
    { internalPG: 'razorpay', cardNetwork: 'MASTER', cardCategory: 'NORMAL', baseRate: 0.018 },
    { internalPG: 'razorpay', cardNetwork: 'MASTER', cardCategory: 'CORPORATE', baseRate: 0.022 },
    { internalPG: 'razorpay', cardNetwork: 'RUPAY', cardCategory: 'NORMAL', baseRate: 0.006 },
    
    // UPI (considered as card type for simplicity)
    { internalPG: 'payu', cardNetwork: 'UPI', cardCategory: 'NORMAL', baseRate: 0.003 },
    { internalPG: 'cashfree', cardNetwork: 'UPI', cardCategory: 'NORMAL', baseRate: 0.002 },
    { internalPG: 'razorpay', cardNetwork: 'UPI', cardCategory: 'NORMAL', baseRate: 0.002 },
    
    // Net Banking
    { internalPG: 'payu', cardNetwork: 'NETBANKING', cardCategory: 'NORMAL', baseRate: 0.015 },
    { internalPG: 'cashfree', cardNetwork: 'NETBANKING', cardCategory: 'NORMAL', baseRate: 0.014 },
    { internalPG: 'razorpay', cardNetwork: 'NETBANKING', cardCategory: 'NORMAL', baseRate: 0.018 },
  ];

  let created = 0;
  let skipped = 0;

  for (const ct of cardTypes) {
    const code = `${ct.internalPG}_${ct.cardNetwork}-${ct.cardCategory}`.toLowerCase();
    const name = `${ct.internalPG.charAt(0).toUpperCase() + ct.internalPG.slice(1)} ${ct.cardNetwork} ${ct.cardCategory.charAt(0) + ct.cardCategory.slice(1).toLowerCase()}`;

    const existing = await prisma.cardType.findUnique({
      where: {
        pgId_code: { pgId: runpaisa.id, code },
      },
    });

    if (existing) {
      console.log(`⏭️  Skipped: ${code} (already exists)`);
      skipped++;
      continue;
    }

    await prisma.cardType.create({
      data: {
        pgId: runpaisa.id,
        code,
        name,
        description: `${name} card payments via Runpaisa`,
        internalPG: ct.internalPG,
        cardNetwork: ct.cardNetwork,
        cardCategory: ct.cardCategory,
        baseRate: ct.baseRate,
        isActive: true,
      },
    });

    console.log(`✅ Created: ${code} (${(ct.baseRate * 100).toFixed(2)}%)`);
    created++;
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped`);

  // Now set schema rates for existing schemas
  const schemas = await prisma.schema.findMany();
  const allCardTypes = await prisma.cardType.findMany({
    where: { pgId: runpaisa.id },
  });

  if (schemas.length > 0 && allCardTypes.length > 0) {
    console.log('\n🔧 Setting default schema card type rates...\n');

    for (const schema of schemas) {
      let ratesSet = 0;

      for (const ct of allCardTypes) {
        // Check if rate already exists
        const existing = await prisma.schemaCardTypeRate.findUnique({
          where: {
            schemaId_cardTypeId: { schemaId: schema.id, cardTypeId: ct.id },
          },
        });

        if (existing) continue;

        // Set a markup based on schema type
        // Gold: +0.3%, Platinum: +0.2%, others: +0.5%
        let markup = 0.005; // 0.5% default
        if (schema.code.toUpperCase().includes('PLATINUM')) {
          markup = 0.002;
        } else if (schema.code.toUpperCase().includes('GOLD')) {
          markup = 0.003;
        } else if (schema.code.toUpperCase().includes('IRON')) {
          markup = 0.006;
        }

        await prisma.schemaCardTypeRate.create({
          data: {
            schemaId: schema.id,
            cardTypeId: ct.id,
            payinRate: ct.baseRate + markup,
          },
        });

        ratesSet++;
      }

      console.log(`✅ Schema "${schema.name}": ${ratesSet} card type rates set`);
    }
  }

  console.log('\n🎉 Card Types seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding card types:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

