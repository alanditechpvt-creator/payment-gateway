/**
 * Seed Security Settings
 * 
 * Run with: npx ts-node prisma/seed-security.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SECURITY_SETTINGS = [
  {
    key: 'MAX_FAILED_ATTEMPTS',
    value: '20',
    description: 'Maximum number of failed login attempts before account lockout',
    category: 'SECURITY',
    dataType: 'NUMBER',
  },
  {
    key: 'LOCKOUT_DURATION_MINUTES',
    value: '30',
    description: 'Duration (in minutes) for which account remains locked after max failed attempts',
    category: 'SECURITY',
    dataType: 'NUMBER',
  },
  {
    key: 'CAPTCHA_ENABLED',
    value: 'false',
    description: 'Enable CAPTCHA verification for login (requires Cloudflare Turnstile configuration)',
    category: 'SECURITY',
    dataType: 'BOOLEAN',
  },
  {
    key: 'CAPTCHA_AFTER_FAILURES',
    value: '3',
    description: 'Number of failed login attempts after which CAPTCHA is required',
    category: 'SECURITY',
    dataType: 'NUMBER',
  },
  {
    key: 'REQUIRE_CAPTCHA_ALWAYS',
    value: 'false',
    description: 'Always require CAPTCHA for every login attempt (overrides CAPTCHA_AFTER_FAILURES)',
    category: 'SECURITY',
    dataType: 'BOOLEAN',
  },
];

async function main() {
  console.log('🔐 Seeding Security Settings...\n');

  for (const setting of SECURITY_SETTINGS) {
    const existing = await prisma.systemSettings.findUnique({
      where: { key: setting.key },
    });

    if (existing) {
      console.log(`⏭️  Skipped: ${setting.key} (already exists: ${existing.value})`);
    } else {
      await prisma.systemSettings.create({
        data: setting,
      });
      console.log(`✅ Created: ${setting.key} = ${setting.value}`);
    }
  }

  console.log('\n🎉 Security settings seeded successfully!');
  console.log('\n📝 To modify settings:');
  console.log('   - Use Admin Panel → Settings → Security');
  console.log('   - Or API: PATCH /api/security/settings/{key}');
}

main()
  .catch((e) => {
    console.error('Error seeding security settings:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

