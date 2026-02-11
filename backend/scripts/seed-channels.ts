import prisma from '../src/lib/prisma';

/**
 * Seed Transaction Channels for Payment Gateways
 * Creates default channels for UPI, Cards, Netbanking, Wallet
 */

const seedChannels = async () => {
  try {
    console.log('🌱 Seeding transaction channels...');

    // Get all payment gateways
    const pgs = await prisma.paymentGateway.findMany();
    console.log(`Found ${pgs.length} payment gateways`);

    for (const pg of pgs) {
      console.log(`\n📦 Creating channels for ${pg.name}...`);

      // UPI Channel
      await prisma.transactionChannel.upsert({
        where: { 
          pgId_name_transactionType: {
            pgId: pg.id,
            name: 'UPI',
            transactionType: 'PAYIN'
          }
        },
        create: {
          pgId: pg.id,
          name: 'UPI',
          category: 'UPI',
          transactionType: 'PAYIN',
          isDefault: true,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        },
        update: {}
      });

      // Cards Channel
      await prisma.transactionChannel.upsert({
        where: { 
          pgId_name_transactionType: {
            pgId: pg.id,
            name: 'Cards',
            transactionType: 'PAYIN'
          }
        },
        create: {
          pgId: pg.id,
          name: 'Cards',
          category: 'CARDS',
          transactionType: 'PAYIN',
          isDefault: false,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        },
        update: {}
      });

      // Netbanking Channel
      await prisma.transactionChannel.upsert({
        where: { 
          pgId_name_transactionType: {
            pgId: pg.id,
            name: 'Netbanking',
            transactionType: 'PAYIN'
          }
        },
        create: {
          pgId: pg.id,
          name: 'Netbanking',
          category: 'NETBANKING',
          transactionType: 'PAYIN',
          isDefault: false,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        },
        update: {}
      });

      // Wallet Channel
      await prisma.transactionChannel.upsert({
        where: { 
          pgId_name_transactionType: {
            pgId: pg.id,
            name: 'Wallet',
            transactionType: 'PAYIN'
          }
        },
        create: {
          pgId: pg.id,
          name: 'Wallet',
          category: 'WALLET',
          transactionType: 'PAYIN',
          isDefault: false,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        },
        update: {}
      });

      // Payout Channel
      await prisma.transactionChannel.upsert({
        where: { 
          pgId_name_transactionType: {
            pgId: pg.id,
            name: 'Bank Transfer',
            transactionType: 'PAYOUT'
          }
        },
        create: {
          pgId: pg.id,
          name: 'Bank Transfer',
          category: 'BANK_TRANSFER',
          transactionType: 'PAYOUT',
          isDefault: true,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        },
        update: {}
      });

      console.log(`✅ Created 5 channels for ${pg.name}`);
    }

    // Count total channels
    const totalChannels = await prisma.transactionChannel.count();
    console.log(`\n🎉 Success! Total channels in database: ${totalChannels}`);

  } catch (error) {
    console.error('❌ Error seeding channels:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

seedChannels();
