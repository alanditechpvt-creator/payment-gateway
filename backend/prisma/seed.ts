import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // Create Admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@newweb.com' },
    update: {},
    create: {
      email: 'admin@newweb.com',
      password: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'System',
      lastName: 'Admin',
      emailVerified: true,
    },
  });
  
  console.log('Created admin user:', admin.email);
  
  // Create admin wallet
  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      balance: 0,
    },
  });
  
  // Create admin permissions
  await prisma.userPermission.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      canCreateUsers: true,
      canManageWallet: true,
      canTransferWallet: true,
      canCreateSchema: true,
      canViewReports: true,
      canManagePG: true,
      canApproveUsers: true,
      canViewTransactions: true,
      canInitiatePayin: true,
      canInitiatePayout: true,
    },
  });
  
  // Create sample Payment Gateways
  const pgs = [
    {
      name: 'Razorpay',
      code: 'RAZORPAY',
      description: 'Razorpay Payment Gateway',
      baseRate: 0.02,
      minAmount: 100,
      maxAmount: 500000,
    },
    {
      name: 'PayU',
      code: 'PAYU',
      description: 'PayU Payment Gateway',
      baseRate: 0.022,
      minAmount: 100,
      maxAmount: 1000000,
    },
    {
      name: 'Cashfree',
      code: 'CASHFREE',
      description: 'Cashfree Payment Gateway',
      baseRate: 0.018,
      minAmount: 50,
      maxAmount: 200000,
    },
    {
      name: 'Paytm',
      code: 'PAYTM',
      description: 'Paytm Payment Gateway',
      baseRate: 0.019,
      minAmount: 100,
      maxAmount: 300000,
    },
  ];
  
  for (const pg of pgs) {
    await prisma.paymentGateway.upsert({
      where: { code: pg.code },
      update: {},
      create: pg,
    });
    console.log('Created PG:', pg.name);
  }
  
  // Create sample Schemas
  const schemas = [
    {
      name: 'Platinum',
      code: 'PLATINUM',
      description: 'Premium tier with lowest rates',
      applicableRoles: 'WHITE_LABEL,MASTER_DISTRIBUTOR,DISTRIBUTOR,RETAILER',
      isDefault: false,
    },
    {
      name: 'Gold',
      code: 'GOLD',
      description: 'Standard tier with competitive rates',
      applicableRoles: 'WHITE_LABEL,MASTER_DISTRIBUTOR,DISTRIBUTOR,RETAILER',
      isDefault: true,
    },
    {
      name: 'Silver',
      code: 'SILVER',
      description: 'Entry tier rates',
      applicableRoles: 'DISTRIBUTOR,RETAILER',
      isDefault: false,
    },
  ];
  
  for (const schema of schemas) {
    const createdSchema = await prisma.schema.upsert({
      where: { code: schema.code },
      update: {},
      create: {
        ...schema,
        createdById: admin.id,
      },
    });
    console.log('Created Schema:', schema.name);
    
    // Add PG rates to schemas
    const allPGs = await prisma.paymentGateway.findMany();
    const rateMultiplier = schema.code === 'PLATINUM' ? 1 : schema.code === 'GOLD' ? 1.1 : 1.2;
    
    for (const pg of allPGs) {
      await prisma.schemaPGRate.upsert({
        where: {
          schemaId_pgId: { schemaId: createdSchema.id, pgId: pg.id },
        },
        update: {},
        create: {
          schemaId: createdSchema.id,
          pgId: pg.id,
          payinRate: pg.baseRate * rateMultiplier,
          payoutRate: pg.baseRate * rateMultiplier * 1.1,
        },
      });
    }
  }
  
  // Create email templates
  const templates = [
    {
      code: 'ONBOARDING_INVITE',
      name: 'Onboarding Invitation',
      subject: 'Complete Your Onboarding - PaymentGateway',
      body: '<p>Welcome to PaymentGateway. Click the link to complete your onboarding.</p>',
      variables: 'link,inviterName',
    },
    {
      code: 'EMAIL_OTP',
      name: 'Email OTP',
      subject: 'Email Verification OTP',
      body: '<p>Your OTP is: {{otp}}</p>',
      variables: 'otp',
    },
    {
      code: 'PASSWORD_RESET',
      name: 'Password Reset',
      subject: 'Password Reset Request',
      body: '<p>Click the link to reset your password.</p>',
      variables: 'link',
    },
    {
      code: 'APPROVAL_NOTIFICATION',
      name: 'Account Approval',
      subject: 'Account Status Update',
      body: '<p>Your account has been {{status}}.</p>',
      variables: 'status,reason',
    },
  ];
  
  for (const template of templates) {
    await prisma.emailTemplate.upsert({
      where: { code: template.code },
      update: {},
      create: template,
    });
    console.log('Created Email Template:', template.name);
  }
  
  // Create system config
  const configs = [
    { key: 'maintenance_mode', value: '{"enabled": false}', description: 'System maintenance mode' },
    { key: 'min_transaction_amount', value: '{"amount": 100}', description: 'Minimum transaction amount' },
    { key: 'max_transaction_amount', value: '{"amount": 1000000}', description: 'Maximum transaction amount' },
    { key: 'commission_levels', value: '{"maxLevels": 5}', description: 'Maximum commission hierarchy levels' },
  ];
  
  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
    console.log('Created Config:', cfg.key);
  }
  
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
