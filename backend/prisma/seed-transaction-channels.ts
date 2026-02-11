import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed standard transaction channels for all payment gateways
 * 
 * PAYIN Channels:
 * - UPI
 * - Net Banking
 * - Debit Card
 * - Wallet
 * - Credit Card (VISA, MasterCard, RuPay, Amex, Diners)
 * 
 * PAYOUT Channels:
 * - IMPS
 * - NEFT (Net Banking)
 */

async function seedTransactionChannels() {
  console.log('🌱 Seeding transaction channels...');

  // Get all payment gateways
  const paymentGateways = await prisma.paymentGateway.findMany({
    where: { isActive: true }
  });

  if (paymentGateways.length === 0) {
    console.log('⚠️  No payment gateways found. Please seed payment gateways first.');
    return;
  }

  for (const pg of paymentGateways) {
    console.log(`\n📦 Seeding channels for ${pg.name} (${pg.code})...`);

    // Check if PG supports PAYIN
    if (pg.supportedTypes.includes('PAYIN')) {
      await seedPayinChannels(pg);
    }

    // Check if PG supports PAYOUT
    if (pg.supportedTypes.includes('PAYOUT')) {
      await seedPayoutChannels(pg);
    }
  }

  console.log('\n✅ Transaction channels seeded successfully!');
}

async function seedPayinChannels(pg: any) {
  const payinChannels = [
    // UPI
    {
      code: 'upi',
      name: 'UPI',
      category: 'UPI',
      baseCost: 0.015, // 1.5%
      pgResponseCodes: JSON.stringify(['upi', 'UPI', 'unified_payments', 'bhim']),
      isDefault: false,
    },

    // Net Banking
    {
      code: 'netbanking',
      name: 'Net Banking',
      category: 'NETBANKING',
      baseCost: 0.020, // 2%
      pgResponseCodes: JSON.stringify(['netbanking', 'net_banking', 'NETBANKING', 'nb', 'NB']),
      isDefault: false,
    },

    // Debit Card
    {
      code: 'debitcard',
      name: 'Debit Card',
      category: 'DEBITCARD',
      baseCost: 0.022, // 2.2%
      pgResponseCodes: JSON.stringify(['debit_card', 'debitcard', 'DEBIT', 'dc']),
      isDefault: false,
    },

    // Wallet
    {
      code: 'wallet',
      name: 'Digital Wallet',
      category: 'WALLET',
      baseCost: 0.018, // 1.8%
      pgResponseCodes: JSON.stringify(['wallet', 'WALLET', 'paytm', 'phonepe', 'mobikwik']),
      isDefault: false,
    },

    // Credit Cards - VISA
    {
      code: 'credit_visa_normal',
      name: 'VISA Normal',
      category: 'CREDITCARD',
      cardNetwork: 'VISA',
      cardType: 'NORMAL',
      baseCost: 0.028, // 2.8%
      pgResponseCodes: JSON.stringify(['visa', 'VISA', 'Visa', 'credit_card_visa', 'visa_normal']),
      isDefault: false,
    },
    {
      code: 'credit_visa_corporate',
      name: 'VISA Corporate',
      category: 'CREDITCARD',
      cardNetwork: 'VISA',
      cardType: 'CORPORATE',
      baseCost: 0.030, // 3%
      pgResponseCodes: JSON.stringify(['visa_corporate', 'VISA_CORPORATE', 'visa_business']),
      isDefault: false,
    },
    {
      code: 'credit_visa_premium',
      name: 'VISA Premium',
      category: 'CREDITCARD',
      cardNetwork: 'VISA',
      cardType: 'PREMIUM',
      baseCost: 0.032, // 3.2%
      pgResponseCodes: JSON.stringify(['visa_premium', 'visa_platinum', 'visa_signature']),
      isDefault: false,
    },

    // Credit Cards - MasterCard
    {
      code: 'credit_master_normal',
      name: 'MasterCard Normal',
      category: 'CREDITCARD',
      cardNetwork: 'MASTER',
      cardType: 'NORMAL',
      baseCost: 0.028, // 2.8%
      pgResponseCodes: JSON.stringify(['mastercard', 'MASTERCARD', 'master', 'MASTER', 'mc']),
      isDefault: false,
    },
    {
      code: 'credit_master_corporate',
      name: 'MasterCard Corporate',
      category: 'CREDITCARD',
      cardNetwork: 'MASTER',
      cardType: 'CORPORATE',
      baseCost: 0.030, // 3%
      pgResponseCodes: JSON.stringify(['mastercard_corporate', 'master_business', 'mc_corporate']),
      isDefault: false,
    },
    {
      code: 'credit_master_premium',
      name: 'MasterCard Premium',
      category: 'CREDITCARD',
      cardNetwork: 'MASTER',
      cardType: 'PREMIUM',
      baseCost: 0.032, // 3.2%
      pgResponseCodes: JSON.stringify(['mastercard_world', 'master_platinum', 'mc_premium']),
      isDefault: false,
    },

    // Credit Cards - RuPay
    {
      code: 'credit_rupay',
      name: 'RuPay Credit',
      category: 'CREDITCARD',
      cardNetwork: 'RUPAY',
      cardType: 'NORMAL',
      baseCost: 0.025, // 2.5%
      pgResponseCodes: JSON.stringify(['rupay', 'RUPAY', 'RuPay']),
      isDefault: false,
    },

    // Credit Cards - Amex
    {
      code: 'credit_amex',
      name: 'American Express',
      category: 'CREDITCARD',
      cardNetwork: 'AMEX',
      cardType: 'NORMAL',
      baseCost: 0.035, // 3.5%
      pgResponseCodes: JSON.stringify(['amex', 'AMEX', 'american_express', 'americanexpress']),
      isDefault: false,
    },

    // Credit Cards - Diners
    {
      code: 'credit_diners',
      name: 'Diners Club',
      category: 'CREDITCARD',
      cardNetwork: 'DINERS',
      cardType: 'NORMAL',
      baseCost: 0.035, // 3.5%
      pgResponseCodes: JSON.stringify(['diners', 'DINERS', 'dinersclub', 'diners_club']),
      isDefault: false,
    },

    // Credit Cards - Others
    {
      code: 'credit_discover',
      name: 'Discover',
      category: 'CREDITCARD',
      cardNetwork: 'DISCOVER',
      cardType: 'NORMAL',
      baseCost: 0.035, // 3.5%
      pgResponseCodes: JSON.stringify(['discover', 'DISCOVER']),
      isDefault: false,
    },
    {
      code: 'credit_jcb',
      name: 'JCB',
      category: 'CREDITCARD',
      cardNetwork: 'JCB',
      cardType: 'NORMAL',
      baseCost: 0.035, // 3.5%
      pgResponseCodes: JSON.stringify(['jcb', 'JCB']),
      isDefault: false,
    },

    // Default fallback for unknown payin channels
    {
      code: 'payin_default',
      name: 'Other Payment Methods',
      category: 'OTHER',
      baseCost: 0.035, // 3.5% (higher to avoid losses)
      pgResponseCodes: JSON.stringify([]),
      isDefault: true, // This is the fallback
    },
  ];

  for (const channel of payinChannels) {
    try {
      await prisma.transactionChannel.upsert({
        where: {
          pgId_code: {
            pgId: pg.id,
            code: channel.code,
          },
        },
        create: {
          ...channel,
          pgId: pg.id,
          transactionType: 'PAYIN',
          isActive: true,
          isCustom: false,
        },
        update: {
          name: channel.name,
          category: channel.category,
          baseCost: channel.baseCost,
          pgResponseCodes: channel.pgResponseCodes,
          isDefault: channel.isDefault,
          transactionType: 'PAYIN',
        },
      });
      console.log(`  ✓ ${channel.name} (${channel.code})`);
    } catch (error: any) {
      console.error(`  ✗ Failed to seed ${channel.name}:`, error.message);
    }
  }
}

async function seedPayoutChannels(pg: any) {
  const payoutChannels = [
    // IMPS
    {
      code: 'imps',
      name: 'IMPS',
      category: 'IMPS',
      baseCost: 0, // Flat slab-based, not percentage
      pgResponseCodes: JSON.stringify(['imps', 'IMPS', 'immediate']),
      isDefault: false,
    },

    // NEFT (Net Banking)
    {
      code: 'neft',
      name: 'NEFT (Net Banking)',
      category: 'NETBANKING',
      baseCost: 0, // Flat slab-based, not percentage
      pgResponseCodes: JSON.stringify(['neft', 'NEFT', 'netbanking', 'net_banking']),
      isDefault: false,
    },

    // Default fallback for unknown payout channels
    {
      code: 'payout_default',
      name: 'Other Payout Methods',
      category: 'OTHER',
      baseCost: 0, // Use highest slab charge
      pgResponseCodes: JSON.stringify([]),
      isDefault: true, // This is the fallback
    },
  ];

  for (const channel of payoutChannels) {
    try {
      await prisma.transactionChannel.upsert({
        where: {
          pgId_code: {
            pgId: pg.id,
            code: channel.code,
          },
        },
        create: {
          ...channel,
          pgId: pg.id,
          transactionType: 'PAYOUT',
          isActive: true,
          isCustom: false,
        },
        update: {
          name: channel.name,
          category: channel.category,
          baseCost: channel.baseCost,
          pgResponseCodes: channel.pgResponseCodes,
          isDefault: channel.isDefault,
          transactionType: 'PAYOUT',
        },
      });
      console.log(`  ✓ ${channel.name} (${channel.code})`);
    } catch (error: any) {
      console.error(`  ✗ Failed to seed ${channel.name}:`, error.message);
    }
  }
}

// Run seed
seedTransactionChannels()
  .catch((error) => {
    console.error('❌ Error seeding transaction channels:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
