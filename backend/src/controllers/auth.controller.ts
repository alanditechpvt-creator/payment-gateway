import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { securityService } from '../services/security.service';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

// Helper to get client IP
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, isAdmin, captchaToken } = req.body;
      
      logger.info(`[AUTH DEBUG] Login attempt - Email: ${email}, isAdmin: ${isAdmin}, isAdminType: ${typeof isAdmin}, body:`, JSON.stringify(req.body));
      
      const result = await authService.login(email, password, {
        isAdminLogin: isAdmin,
        captchaToken,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
      });
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  
  // Check if CAPTCHA is required for email (call before login attempt)
  async checkCaptchaRequired(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        res.json({ success: true, data: { required: false } });
        return;
      }
      
      const result = await authService.checkCaptchaRequired(email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshToken(refreshToken);
      res.json({ success: true, data: tokens });
    } catch (error) {
      next(error);
    }
  },
  
  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(req.user!.userId, refreshToken);
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  },
  
  async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await authService.requestPasswordReset(email);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword(token, newPassword);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.user!.userId, currentPassword, newPassword);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userService } = await import('../services/user.service');
      const user = await userService.getUserById(req.user!.userId, req.user!.userId);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },

  async verifyOnboardingToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      const result = await authService.verifyOnboardingToken(token);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async completeOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      const result = await authService.completeOnboarding(token, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};

