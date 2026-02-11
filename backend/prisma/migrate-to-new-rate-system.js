#!/usr/bin/env node

/**
 * Migration Script: Old Rate System → New Rate System
 * 
 * This script:
 * 1. Backs up current database
 * 2. Replaces schema.prisma with new schema
 * 3. Applies migration
 * 4. Seeds transaction channels
 * 5. Seeds schema rates
 * 
 * ⚠️  WARNING: This is a breaking change. Old rate data will not be migrated.
 * ⚠️  Make sure you have a backup before running this script.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = path.join(__dirname, 'backups');
const SCHEMA_FILE = path.join(__dirname, 'schema.prisma');
const NEW_SCHEMA_FILE = path.join(__dirname, 'schema-new.prisma');
const DB_FILE = path.join(__dirname, 'prod.db');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n${description}...`, 'cyan');
  try {
    execSync(command, { stdio: 'inherit', cwd: __dirname });
    log(`✓ ${description} completed`, 'green');
  } catch (error) {
    log(`✗ ${description} failed`, 'red');
    throw error;
  }
}

async function migrate() {
  log('\n═══════════════════════════════════════════', 'magenta');
  log('  RATE SYSTEM MIGRATION', 'magenta');
  log('═══════════════════════════════════════════\n', 'magenta');

  // Step 1: Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Step 2: Backup current database
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `prod-${timestamp}.db`);
  
  if (fs.existsSync(DB_FILE)) {
    log(`\n📦 Backing up database to: ${backupFile}`, 'yellow');
    fs.copyFileSync(DB_FILE, backupFile);
    log('✓ Database backed up successfully', 'green');
  } else {
    log(`\n⚠️  Database file not found: ${DB_FILE}`, 'yellow');
    log('Continuing with fresh database...', 'yellow');
  }

  // Step 3: Backup current schema
  const schemaBackupFile = path.join(BACKUP_DIR, `schema-${timestamp}.prisma`);
  if (fs.existsSync(SCHEMA_FILE)) {
    log(`\n📦 Backing up schema to: ${schemaBackupFile}`, 'yellow');
    fs.copyFileSync(SCHEMA_FILE, schemaBackupFile);
    log('✓ Schema backed up successfully', 'green');
  }

  // Step 4: Replace schema with new schema
  if (!fs.existsSync(NEW_SCHEMA_FILE)) {
    log('\n✗ New schema file not found: schema-new.prisma', 'red');
    log('Please create schema-new.prisma before running migration', 'red');
    process.exit(1);
  }

  log('\n🔄 Replacing schema.prisma with new schema...', 'cyan');
  fs.copyFileSync(NEW_SCHEMA_FILE, SCHEMA_FILE);
  log('✓ Schema replaced successfully', 'green');

  // Step 5: Generate Prisma client
  execCommand('npx prisma generate', 'Generating Prisma client');

  // Step 6: Apply migration (fresh start)
  log('\n⚠️  This will reset the database to match the new schema', 'yellow');
  log('⚠️  All existing data will be lost', 'yellow');
  
  // For fresh start, we use db push instead of migrate
  execCommand('npx prisma db push --force-reset', 'Applying new schema');

  // Step 7: Seed payment gateways (if they don't exist)
  log('\n🌱 Seeding payment gateways...', 'cyan');
  try {
    execSync('npx ts-node seed-pgs.ts', { stdio: 'inherit', cwd: __dirname });
    log('✓ Payment gateways seeded', 'green');
  } catch (error) {
    log('⚠️  Payment gateway seed failed', 'yellow');
    console.error(error);
  }

  // Step 8: Seed transaction channels
  execCommand('npx ts-node seed-transaction-channels.ts', 'Seeding transaction channels');

  // Step 9: Seed schemas (if needed)
  log('\n🌱 Seeding schemas...', 'cyan');
  try {
    execSync('npx ts-node seed-schemas.ts', { stdio: 'inherit', cwd: __dirname });
    log('✓ Schemas seeded', 'green');
  } catch (error) {
    log('⚠️  Schema seed failed', 'yellow');
    console.error(error);
  }

  // Step 10: Seed schema rates
  execCommand('npx ts-node seed-schema-rates.ts', 'Seeding schema rates');

  log('\n═══════════════════════════════════════════', 'green');
  log('  MIGRATION COMPLETED SUCCESSFULLY! ', 'green');
  log('═══════════════════════════════════════════\n', 'green');

  log('📝 Next steps:', 'cyan');
  log('  1. Update backend services to use new rate system');
  log('  2. Update admin UI for channel management');
  log('  3. Test payin/payout flows');
  log('  4. Create admin users and assign rates\n');

  log(`📦 Backup location: ${BACKUP_DIR}`, 'yellow');
  log(`   - Database: ${backupFile}`, 'yellow');
  log(`   - Schema: ${schemaBackupFile}\n`, 'yellow');
}

// Confirm before running
log('\n⚠️  WARNING: This migration will RESET your database!', 'red');
log('⚠️  All existing data will be lost.', 'red');
log('⚠️  Make sure you have a backup before proceeding.\n', 'red');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you want to proceed? (yes/no): ', (answer) => {
  rl.close();
  
  if (answer.toLowerCase() === 'yes') {
    migrate()
      .then(() => {
        log('\n✓ Migration successful!', 'green');
        process.exit(0);
      })
      .catch((error) => {
        log('\n✗ Migration failed!', 'red');
        console.error(error);
        process.exit(1);
      });
  } else {
    log('\n✗ Migration cancelled', 'yellow');
    process.exit(0);
  }
});
