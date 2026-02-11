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

      // Check if channels already exist
      const existing = await prisma.transactionChannel.findMany({
        where: { pgId: pg.id }
      });

      if (existing.length > 0) {
        console.log(`  ⏭️  ${existing.length} channels already exist, skipping`);
        continue;
      }

      // UPI Channel
      await prisma.transactionChannel.create({
        data: {
          paymentGateway: { connect: { id: pg.id } },
          name: 'UPI',
          category: 'UPI',
          transactionType: 'PAYIN',
          isDefault: true,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        }
      });

      // Cards Channel
      await prisma.transactionChannel.create({
        data: {
          paymentGateway: { connect: { id: pg.id } },
          name: 'Cards',
          category: 'CARDS',
          transactionType: 'PAYIN',
          isDefault: false,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        }
      });

      // Netbanking Channel
      await prisma.transactionChannel.create({
        data: {
          paymentGateway: { connect: { id: pg.id } },
          name: 'Netbanking',
          category: 'NETBANKING',
          transactionType: 'PAYIN',
          isDefault: false,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        }
      });

      // Wallet Channel
      await prisma.transactionChannel.create({
        data: {
          paymentGateway: { connect: { id: pg.id } },
          name: 'Wallet',
          category: 'WALLET',
          transactionType: 'PAYIN',
          isDefault: false,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        }
      });

      // Payout Channel
      await prisma.transactionChannel.create({
        data: {
          paymentGateway: { connect: { id: pg.id } },
          name: 'Bank Transfer',
          category: 'BANK_TRANSFER',
          transactionType: 'PAYOUT',
          isDefault: true,
          isActive: true,
          pgResponseCodes: JSON.stringify([]),
        }
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
