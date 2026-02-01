/**
 * Application Entry Point
 * 
 * Handles:
 * - Environment validation
 * - Database connection
 * - Server startup
 * - Graceful shutdown
 */

import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import prisma from './lib/prisma';
import fs from 'fs';
import path from 'path';

// ==================== DIRECTORY SETUP ====================

function ensureDirectories(): void {
  const directories = [
    config.upload.path,
    './logs',
    './uploads/profiles',
    './uploads/kyc/aadhaar',
    './uploads/kyc/pan',
    './uploads/documents',
  ];
  
  directories.forEach(dir => {
    const fullPath = path.resolve(dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      logger.info(`Created directory: ${fullPath}`);
    }
  });
}

// ==================== SERVER STARTUP ====================

async function startServer(): Promise<void> {
  try {
    // Display startup banner
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║       PAYMENT GATEWAY API - Starting Up...                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    // Ensure required directories exist
    ensureDirectories();
    
    // Test database connection
    logger.info('Connecting to database...');
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    
    // Verify database schema
    const userCount = await prisma.user.count();
    logger.info(`📊 Database has ${userCount} users`);
    
    // Start HTTP server
    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log('\n');
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log(`║  🚀 Server running on http://0.0.0.0:${config.port}                     ║`);
      console.log(`║  📦 Environment: ${config.nodeEnv.padEnd(42)}║`);
      console.log(`║  🔧 PG Mode: ${config.pgMode.mode.padEnd(46)}║`);
      console.log('╠═══════════════════════════════════════════════════════════════╣');
      console.log('║  Health Check: GET /api/health                                ║');
      console.log('║  API Docs:     GET /api/health/version                        ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log('\n');
      
      logger.info(`Server running on http://0.0.0.0:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`PG Mode: ${config.pgMode.mode}`);
    });
    
    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use`);
        process.exit(1);
      }
      throw error;
    });
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    console.error('\nFailed to start server:', error);
    process.exit(1);
  }
}

// ==================== GRACEFUL SHUTDOWN ====================

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Close database connection
    await prisma.$disconnect();
    logger.info('✅ Database disconnected');
    
    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==================== START ====================

startServer();

