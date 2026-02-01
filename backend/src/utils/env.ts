/**
 * Environment Validation
 * 
 * Validates required environment variables on startup
 * Prevents silent failures due to missing configuration
 */

import { z } from 'zod';
import { logger } from './logger';

// Environment schema
const envSchema = z.object({
  // Required
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4100),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // Admin
  ADMIN_EMAIL: z.string().email().default('admin@paymentgateway.com'),
  ADMIN_PASSWORD: z.string().min(8).default('Admin@123456'),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5000,http://localhost:5002'),
  
  // Upload
  UPLOAD_PATH: z.string().default('./uploads'),
  
  // SMTP (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  
  // Runpaisa (optional)
  RUNPAISA_ENABLED: z.string().transform(v => v === 'true').default('false'),
  RUNPAISA_CLIENT_ID: z.string().optional(),
  RUNPAISA_USERNAME: z.string().optional(),
  RUNPAISA_PASSWORD: z.string().optional(),
  
  // Cashfree (optional)
  CASHFREE_ENABLED: z.string().transform(v => v === 'true').default('false'),
  CASHFREE_APP_ID: z.string().optional(),
  CASHFREE_SECRET_KEY: z.string().optional(),
  CASHFREE_ENV: z.string().default('TEST'),
  CASHFREE_CALLBACK_URL: z.string().optional(),
  
  // PG Mode
  PG_MODE: z.enum(['ONLINE', 'OFFLINE']).default('OFFLINE'),
  
  // Storage (optional)
  STORAGE_PROVIDER: z.enum(['local', 's3', 'azure', 'gcs']).default('local'),
  IMAGE_COMPRESSION: z.string().transform(v => v === 'true').default('false'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 * Call this on application startup
 */
export function validateEnv(): EnvConfig {
  try {
    const env = envSchema.parse(process.env);
    
    logger.info('✅ Environment validation passed');
    
    // Log non-sensitive config
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Port: ${env.PORT}`);
    logger.info(`PG Mode: ${env.PG_MODE}`);
    logger.info(`Storage: ${env.STORAGE_PROVIDER}`);
    logger.info(`Runpaisa Enabled: ${env.RUNPAISA_ENABLED}`);
    
    // Warn about optional configs
    if (!env.SMTP_HOST) {
      logger.warn('⚠️ SMTP not configured - emails will be logged to console');
    }
    
    if (!env.RUNPAISA_ENABLED) {
      logger.warn('⚠️ Runpaisa not enabled - PG integration disabled');
    }
    
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('❌ Environment validation failed:');
      error.errors.forEach(err => {
        logger.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      
      console.error('\n=== Environment Configuration Errors ===');
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      console.error('=========================================\n');
      
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get required environment variable or throw
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
export function getOptionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

