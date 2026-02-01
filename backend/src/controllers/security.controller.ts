/**
 * Security Controller
 * 
 * Admin endpoints for security settings management
 * 
 * All endpoints are protected by:
 * - JWT authentication
 * - ADMIN role authorization
 * - Password re-confirmation for write operations
 * - Rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import { securityService, SECURITY_DEFAULTS } from '../services/security.service';
import { AuthRequest } from '../middleware/auth';
import { auditSensitiveAction } from '../middleware/sensitiveAction';
import { config } from '../config';

// Helper to get client IP
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export const securityController = {
  /**
   * Get all security settings
   */
  async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await securityService.getAllSecuritySettings();
      const currentSettings = await securityService.getSecuritySettings();
      
      res.json({
        success: true,
        data: {
          settings,
          current: currentSettings,
          defaults: SECURITY_DEFAULTS,
          captcha: {
            enabled: config.captcha.enabled,
            siteKey: config.captcha.siteKey,
            configured: !!(config.captcha.siteKey && config.captcha.secretKey),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update a single security setting
   * Requires: password re-confirmation
   */
  async updateSetting(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const { value } = req.body;
      
      const result = await securityService.updateSecuritySetting(
        key,
        String(value),
        req.user!.userId
      );
      
      // Audit log
      await auditSensitiveAction(req.user!.userId, 'UPDATE_SECURITY_SETTING', key, {
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        newValue: value,
      });
      
      res.json({
        success: true,
        data: result,
        message: `Security setting ${key} updated successfully`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Bulk update security settings
   */
  async bulkUpdateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { settings } = req.body;
      
      await securityService.bulkUpdateSecuritySettings(
        settings.map((s: any) => ({ key: s.key, value: String(s.value) })),
        req.user!.userId
      );
      
      const updated = await securityService.getSecuritySettings();
      
      res.json({
        success: true,
        data: updated,
        message: 'Security settings updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Unlock a user account
   * Requires: password re-confirmation (CRITICAL ACTION)
   */
  async unlockAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email } = req.params;
      
      await securityService.unlockAccount(email, req.user!.userId);
      
      // Audit log for this critical action
      await auditSensitiveAction(req.user!.userId, 'UNLOCK_ACCOUNT', email, {
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
      });
      
      res.json({
        success: true,
        message: `Account ${email} unlocked successfully`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get login history for a user
   */
  async getLoginHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const history = await securityService.getLoginHistory(email, limit);
      
      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get failed login statistics
   */
  async getFailedLoginStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      
      const stats = await securityService.getFailedLoginStats(hours);
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get CAPTCHA site key for frontend
   */
  async getCaptchaConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: {
          enabled: config.captcha.enabled,
          siteKey: config.captcha.siteKey || null,
          provider: 'cloudflare-turnstile',
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

