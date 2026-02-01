/**
 * Security Service
 * 
 * Handles:
 * - Account lockout after failed login attempts
 * - CAPTCHA verification (Cloudflare Turnstile)
 * - Login attempt logging
 * - Security settings management
 */

import prisma from '../lib/prisma';
import { config } from '../config';
import { logger } from '../utils/logger';

// Default security settings
export const SECURITY_DEFAULTS = {
  MAX_FAILED_ATTEMPTS: 20,
  LOCKOUT_DURATION_MINUTES: 30,
  CAPTCHA_ENABLED: false,
  CAPTCHA_AFTER_FAILURES: 3,
  REQUIRE_CAPTCHA_ALWAYS: false,
};

export interface SecuritySettings {
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  captchaEnabled: boolean;
  captchaAfterFailures: number;
  requireCaptchaAlways: boolean;
}

export interface LoginAttemptData {
  email: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  captchaVerified?: boolean;
}

class SecurityService {
  private settingsCache: SecuritySettings | null = null;
  private settingsCacheTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get security settings (with caching)
   */
  async getSecuritySettings(): Promise<SecuritySettings> {
    // Check cache
    if (this.settingsCache && Date.now() - this.settingsCacheTime < this.CACHE_TTL) {
      return this.settingsCache;
    }

    try {
      const settings = await prisma.systemSettings.findMany({
        where: { category: 'SECURITY' },
      });

      const settingsMap = new Map(settings.map(s => [s.key, s.value]));

      this.settingsCache = {
        maxFailedAttempts: parseInt(settingsMap.get('MAX_FAILED_ATTEMPTS') || String(SECURITY_DEFAULTS.MAX_FAILED_ATTEMPTS), 10),
        lockoutDurationMinutes: parseInt(settingsMap.get('LOCKOUT_DURATION_MINUTES') || String(SECURITY_DEFAULTS.LOCKOUT_DURATION_MINUTES), 10),
        captchaEnabled: settingsMap.get('CAPTCHA_ENABLED') === 'true',
        captchaAfterFailures: parseInt(settingsMap.get('CAPTCHA_AFTER_FAILURES') || String(SECURITY_DEFAULTS.CAPTCHA_AFTER_FAILURES), 10),
        requireCaptchaAlways: settingsMap.get('REQUIRE_CAPTCHA_ALWAYS') === 'true',
      };

      this.settingsCacheTime = Date.now();
      return this.settingsCache;
    } catch (error) {
      logger.error('Error fetching security settings:', error);
      return {
        maxFailedAttempts: SECURITY_DEFAULTS.MAX_FAILED_ATTEMPTS,
        lockoutDurationMinutes: SECURITY_DEFAULTS.LOCKOUT_DURATION_MINUTES,
        captchaEnabled: SECURITY_DEFAULTS.CAPTCHA_ENABLED,
        captchaAfterFailures: SECURITY_DEFAULTS.CAPTCHA_AFTER_FAILURES,
        requireCaptchaAlways: SECURITY_DEFAULTS.REQUIRE_CAPTCHA_ALWAYS,
      };
    }
  }

  /**
   * Clear settings cache (call after admin updates settings)
   */
  clearSettingsCache(): void {
    this.settingsCache = null;
    this.settingsCacheTime = 0;
  }

  /**
   * Check if user account is locked
   */
  async isAccountLocked(email: string): Promise<{ locked: boolean; reason?: string; unlockAt?: Date }> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        status: true,
        lockedUntil: true,
        lockedReason: true,
        failedLoginAttempts: true,
      },
    });

    if (!user) {
      return { locked: false };
    }

    // Check if manually suspended/inactive
    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      return {
        locked: true,
        reason: `Account is ${user.status.toLowerCase()}. Please contact administrator.`,
      };
    }

    // Check if temporarily locked
    if (user.lockedUntil) {
      if (new Date() < user.lockedUntil) {
        return {
          locked: true,
          reason: user.lockedReason || 'Account temporarily locked due to too many failed login attempts.',
          unlockAt: user.lockedUntil,
        };
      } else {
        // Lock expired, reset
        await this.resetFailedAttempts(email);
      }
    }

    return { locked: false };
  }

  /**
   * Record a failed login attempt
   */
  async recordFailedLogin(email: string, ipAddress?: string, userAgent?: string, reason?: string): Promise<{
    attemptsRemaining: number;
    locked: boolean;
    lockReason?: string;
  }> {
    const settings = await this.getSecuritySettings();

    // Log the attempt
    await this.logLoginAttempt({
      email,
      ipAddress,
      userAgent,
      success: false,
      failureReason: reason,
    });

    // Update user's failed attempts
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, failedLoginAttempts: true },
    });

    if (!user) {
      return { attemptsRemaining: settings.maxFailedAttempts, locked: false };
    }

    const newAttempts = user.failedLoginAttempts + 1;
    const attemptsRemaining = Math.max(0, settings.maxFailedAttempts - newAttempts);

    // Check if should lock
    if (newAttempts >= settings.maxFailedAttempts) {
      const lockUntil = new Date(Date.now() + settings.lockoutDurationMinutes * 60 * 1000);
      const lockReason = `Account locked after ${newAttempts} failed login attempts. Will unlock at ${lockUntil.toISOString()}.`;

      await prisma.user.update({
        where: { email },
        data: {
          failedLoginAttempts: newAttempts,
          lastFailedLogin: new Date(),
          lockedUntil: lockUntil,
          lockedReason: lockReason,
          status: 'INACTIVE', // Set status to INACTIVE
        },
      });

      logger.warn(`Account locked: ${email} after ${newAttempts} failed attempts`);

      return {
        attemptsRemaining: 0,
        locked: true,
        lockReason: `Account locked due to ${newAttempts} failed login attempts. Please try again after ${settings.lockoutDurationMinutes} minutes or contact administrator.`,
      };
    }

    // Just increment failed attempts
    await prisma.user.update({
      where: { email },
      data: {
        failedLoginAttempts: newAttempts,
        lastFailedLogin: new Date(),
      },
    });

    // Warn user when close to lockout
    if (attemptsRemaining <= 5) {
      logger.warn(`User ${email} has ${attemptsRemaining} login attempts remaining`);
    }

    return {
      attemptsRemaining,
      locked: false,
    };
  }

  /**
   * Record a successful login
   */
  async recordSuccessfulLogin(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    // Log the attempt
    await this.logLoginAttempt({
      email,
      ipAddress,
      userAgent,
      success: true,
    });

    // Reset failed attempts
    await this.resetFailedAttempts(email);

    // Update last login
    await prisma.user.update({
      where: { email },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Reset failed login attempts
   */
  async resetFailedAttempts(email: string): Promise<void> {
    await prisma.user.update({
      where: { email },
      data: {
        failedLoginAttempts: 0,
        lastFailedLogin: null,
        lockedUntil: null,
        lockedReason: null,
      },
    });
  }

  /**
   * Admin: Unlock a user account
   */
  async unlockAccount(email: string, adminId: string): Promise<void> {
    await prisma.user.update({
      where: { email },
      data: {
        failedLoginAttempts: 0,
        lastFailedLogin: null,
        lockedUntil: null,
        lockedReason: null,
        status: 'ACTIVE',
      },
    });

    logger.info(`Account ${email} unlocked by admin ${adminId}`);
  }

  /**
   * Check if CAPTCHA is required for this login attempt
   */
  async isCaptchaRequired(email: string): Promise<boolean> {
    const settings = await this.getSecuritySettings();

    if (!settings.captchaEnabled) {
      return false;
    }

    if (settings.requireCaptchaAlways) {
      return true;
    }

    // Check failed attempts
    const user = await prisma.user.findUnique({
      where: { email },
      select: { failedLoginAttempts: true },
    });

    if (!user) {
      // For non-existent users, require CAPTCHA after global threshold
      const recentFailures = await prisma.loginAttempt.count({
        where: {
          email,
          success: false,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        },
      });

      return recentFailures >= settings.captchaAfterFailures;
    }

    return user.failedLoginAttempts >= settings.captchaAfterFailures;
  }

  /**
   * Verify Cloudflare Turnstile CAPTCHA
   */
  async verifyCaptcha(token: string, ipAddress?: string): Promise<{ success: boolean; error?: string }> {
    const secretKey = config.captcha?.secretKey;

    if (!secretKey) {
      logger.warn('CAPTCHA secret key not configured');
      return { success: true }; // Allow if not configured
    }

    // Test keys always pass - Cloudflare's official test keys
    // Site Key: 1x00000000000000000000AA, Secret Key: 1x0000000000000000000000000000000AA
    const isTestKey = secretKey.startsWith('1x') || secretKey.startsWith('2x') || secretKey.startsWith('3x');
    
    if (isTestKey) {
      logger.info('Using Cloudflare test keys - auto-passing CAPTCHA');
      // For test keys starting with '1x' (always pass) or '3x' (invisible pass), return success
      // For test keys starting with '2x' (always fail), return failure
      if (secretKey.startsWith('2x')) {
        return { success: false, error: 'Test CAPTCHA configured to always fail' };
      }
      return { success: true };
    }

    try {
      const formData = new URLSearchParams();
      formData.append('secret', secretKey);
      formData.append('response', token);
      if (ipAddress) {
        formData.append('remoteip', ipAddress);
      }

      logger.info('Verifying CAPTCHA with Cloudflare...');
      
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      const result = await response.json() as { success: boolean; 'error-codes'?: string[] };
      
      logger.info(`CAPTCHA verification result: ${JSON.stringify(result)}`);

      if (result.success) {
        return { success: true };
      }

      logger.warn('CAPTCHA verification failed:', result['error-codes']);
      return {
        success: false,
        error: 'CAPTCHA verification failed. Please try again.',
      };
    } catch (error) {
      logger.error('CAPTCHA verification error:', error);
      return {
        success: false,
        error: 'CAPTCHA verification service unavailable.',
      };
    }
  }

  /**
   * Log login attempt for audit
   */
  async logLoginAttempt(data: LoginAttemptData): Promise<void> {
    try {
      await prisma.loginAttempt.create({
        data: {
          email: data.email,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent?.substring(0, 500), // Truncate long user agents
          success: data.success,
          failureReason: data.failureReason,
          captchaVerified: data.captchaVerified || false,
        },
      });
    } catch (error) {
      logger.error('Error logging login attempt:', error);
    }
  }

  /**
   * Get login history for a user (admin)
   */
  async getLoginHistory(email: string, limit: number = 50): Promise<any[]> {
    return prisma.loginAttempt.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get failed login statistics (admin)
   */
  async getFailedLoginStats(hours: number = 24): Promise<{
    totalAttempts: number;
    uniqueEmails: number;
    uniqueIPs: number;
    topFailedEmails: { email: string; count: number }[];
    topFailedIPs: { ip: string; count: number }[];
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const attempts = await prisma.loginAttempt.findMany({
      where: {
        success: false,
        createdAt: { gte: since },
      },
      select: {
        email: true,
        ipAddress: true,
      },
    });

    // Count by email
    const emailCounts = new Map<string, number>();
    const ipCounts = new Map<string, number>();

    attempts.forEach(a => {
      emailCounts.set(a.email, (emailCounts.get(a.email) || 0) + 1);
      if (a.ipAddress) {
        ipCounts.set(a.ipAddress, (ipCounts.get(a.ipAddress) || 0) + 1);
      }
    });

    const topFailedEmails = Array.from(emailCounts.entries())
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topFailedIPs = Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalAttempts: attempts.length,
      uniqueEmails: emailCounts.size,
      uniqueIPs: ipCounts.size,
      topFailedEmails,
      topFailedIPs,
    };
  }

  // ==================== ADMIN SETTINGS MANAGEMENT ====================

  /**
   * Get all security settings (for admin)
   */
  async getAllSecuritySettings(): Promise<any[]> {
    return prisma.systemSettings.findMany({
      where: { category: 'SECURITY' },
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Update a security setting (admin only)
   */
  async updateSecuritySetting(key: string, value: string, adminId: string): Promise<any> {
    const result = await prisma.systemSettings.upsert({
      where: { key },
      update: {
        value,
        updatedBy: adminId,
        updatedAt: new Date(),
      },
      create: {
        key,
        value,
        category: 'SECURITY',
        description: this.getSettingDescription(key),
        dataType: this.getSettingDataType(key),
        updatedBy: adminId,
      },
    });

    // Clear cache
    this.clearSettingsCache();

    logger.info(`Security setting ${key} updated to ${value} by admin ${adminId}`);

    return result;
  }

  /**
   * Bulk update security settings
   */
  async bulkUpdateSecuritySettings(
    settings: Array<{ key: string; value: string }>,
    adminId: string
  ): Promise<void> {
    for (const setting of settings) {
      await this.updateSecuritySetting(setting.key, setting.value, adminId);
    }
  }

  private getSettingDescription(key: string): string {
    const descriptions: Record<string, string> = {
      MAX_FAILED_ATTEMPTS: 'Maximum number of failed login attempts before account lockout',
      LOCKOUT_DURATION_MINUTES: 'Duration (in minutes) for which account remains locked',
      CAPTCHA_ENABLED: 'Enable CAPTCHA verification for login',
      CAPTCHA_AFTER_FAILURES: 'Number of failed attempts after which CAPTCHA is required',
      REQUIRE_CAPTCHA_ALWAYS: 'Always require CAPTCHA for every login attempt',
    };
    return descriptions[key] || key;
  }

  private getSettingDataType(key: string): string {
    const types: Record<string, string> = {
      MAX_FAILED_ATTEMPTS: 'NUMBER',
      LOCKOUT_DURATION_MINUTES: 'NUMBER',
      CAPTCHA_ENABLED: 'BOOLEAN',
      CAPTCHA_AFTER_FAILURES: 'NUMBER',
      REQUIRE_CAPTCHA_ALWAYS: 'BOOLEAN',
    };
    return types[key] || 'STRING';
  }
}

export const securityService = new SecurityService();

