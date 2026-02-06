import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { config } from '../config';
import { JWTPayload } from '../types';
import { AppError } from '../middleware/errorHandler';
import { emailService } from './email.service';
import { securityService } from './security.service';

export interface LoginOptions {
  isAdminLogin?: boolean;
  captchaToken?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const authService = {
  /**
   * Login with security checks (lockout, CAPTCHA)
   */
  async login(email: string, password: string, options: LoginOptions = {}) {
    const { isAdminLogin = false, captchaToken, ipAddress, userAgent } = options;

    // Check if account is locked
    const lockStatus = await securityService.isAccountLocked(email);
    if (lockStatus.locked) {
      await securityService.logLoginAttempt({
        email,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'Account locked',
      });
      
      const errorMessage = lockStatus.unlockAt 
        ? `Account locked until ${lockStatus.unlockAt.toLocaleString()}. ${lockStatus.reason || ''}`
        : lockStatus.reason || 'Account is locked.';
      throw new AppError(errorMessage, 403);
    }

    // Check if CAPTCHA is required
    const captchaRequired = await securityService.isCaptchaRequired(email);
    if (captchaRequired && config.captcha.enabled) {
      if (!captchaToken) {
        throw new AppError('CAPTCHA verification required', 400, { captchaRequired: true });
      }

      const captchaResult = await securityService.verifyCaptcha(captchaToken, ipAddress);
      if (!captchaResult.success) {
        await securityService.logLoginAttempt({
          email,
          ipAddress,
          userAgent,
          success: false,
          failureReason: 'CAPTCHA verification failed',
          captchaVerified: false,
        });
        throw new AppError(captchaResult.error || 'CAPTCHA verification failed', 400);
      }
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { permissions: true },
    });
    
    if (!user) {
      // Record failed attempt for non-existent user (prevent enumeration)
      await securityService.recordFailedLogin(email, ipAddress, userAgent, 'User not found');
      throw new AppError('Invalid credentials', 401);
    }
    
    // Check if admin login is required
    if (isAdminLogin && user.role !== 'ADMIN') {
      await securityService.recordFailedLogin(email, ipAddress, userAgent, 'Admin access required');
      throw new AppError('Admin access required', 403);
    }
    
    if (user.status === 'SUSPENDED') {
      await securityService.recordFailedLogin(email, ipAddress, userAgent, 'Account suspended');
      throw new AppError('Account is suspended. Please contact administrator.', 403);
    }
    
    if (user.status === 'INACTIVE') {
      // Check if locked due to failed attempts
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        throw new AppError(`Account locked until ${user.lockedUntil.toLocaleString()}. Too many failed login attempts.`, 403);
      }
      await securityService.recordFailedLogin(email, ipAddress, userAgent, 'Account inactive');
      throw new AppError('Account is inactive. Please contact administrator.', 403);
    }
    
    if (user.status !== 'ACTIVE' && user.role !== 'ADMIN') {
      await securityService.recordFailedLogin(email, ipAddress, userAgent, 'Account not active');
      throw new AppError('Account is not active. Please complete onboarding.', 403);
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Record failed attempt and check for lockout
      const result = await securityService.recordFailedLogin(email, ipAddress, userAgent, 'Invalid password');
      
      if (result.locked) {
        throw new AppError(result.lockReason || 'Account locked due to too many failed attempts.', 403);
      }
      
      // Include remaining attempts in error if close to lockout
      const errorMsg = result.attemptsRemaining <= 5 
        ? `Invalid credentials. ${result.attemptsRemaining} attempts remaining before lockout.`
        : 'Invalid credentials';
      
      throw new AppError(errorMsg, 401, { attemptsRemaining: result.attemptsRemaining });
    }
    
    // Successful login - record and reset failed attempts
    await securityService.recordSuccessfulLogin(email, ipAddress, userAgent);
    
    const tokens = await this.generateTokens(user);
    
    // permissions is an array, return the first element for frontend
    const userPermissions = Array.isArray(user.permissions) ? user.permissions[0] : user.permissions;
    
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        permissions: userPermissions || null,
      },
      ...tokens,
    };
  },

  /**
   * Check if CAPTCHA is required for email (for frontend)
   */
  async checkCaptchaRequired(email: string): Promise<{ required: boolean; siteKey?: string }> {
    const required = await securityService.isCaptchaRequired(email);
    return {
      required: required && config.captcha.enabled,
      siteKey: config.captcha.enabled ? config.captcha.siteKey : undefined,
    };
  },
  
  async generateTokens(user: { id: string; email: string; role: any }) {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
    
    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });
    
    return { accessToken, refreshToken };
  },
  
  async refreshToken(refreshToken: string) {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    
    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
    
    // Delete old token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    
    // Generate new tokens
    return this.generateTokens(storedToken.user);
  },
  
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    } else {
      // Logout from all devices
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  },
  
  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, a reset link has been sent' };
    }
    
    const token = uuidv4();
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingToken: token,
        onboardingTokenExpiry: expiry,
      },
    });
    
    await emailService.sendPasswordReset(email, token);
    
    return { message: 'If the email exists, a reset link has been sent' };
  },
  
  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: {
        onboardingToken: token,
        onboardingTokenExpiry: { gt: new Date() },
      },
    });
    
    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        onboardingToken: null,
        onboardingTokenExpiry: null,
      },
    });
    
    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    
    return { message: 'Password reset successful' };
  },
  
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 400);
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    
    return { message: 'Password changed successfully' };
  },

  async verifyOnboardingToken(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        onboardingToken: token,
        status: 'PENDING_ONBOARDING',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        businessName: true,
        role: true,
        onboardingTokenExpiry: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid onboarding link', 400);
    }

    if (user.onboardingTokenExpiry && user.onboardingTokenExpiry < new Date()) {
      throw new AppError('Onboarding link has expired', 400);
    }

    return { user };
  },

  async completeOnboarding(token: string, data: any) {
    const user = await prisma.user.findFirst({
      where: {
        onboardingToken: token,
        status: 'PENDING_ONBOARDING',
      },
    });

    if (!user) {
      throw new AppError('Invalid onboarding link', 400);
    }

    if (user.onboardingTokenExpiry && user.onboardingTokenExpiry < new Date()) {
      throw new AppError('Onboarding link has expired', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Update user with onboarding data (only fields that exist in schema)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        phone: data.phone,
        businessName: data.businessName,
        panNumber: data.panNumber,
        status: 'PENDING_APPROVAL',
        onboardingToken: null,
        onboardingTokenExpiry: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    return {
      message: 'Onboarding completed successfully. Your account is pending approval.',
      user: updatedUser,
    };
  },
};

