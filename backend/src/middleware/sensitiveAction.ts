/**
 * Sensitive Action Middleware
 * 
 * Additional protection for critical admin operations:
 * - Re-authentication (password confirmation)
 * - Rate limiting
 * - Enhanced audit logging
 */

import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

// Simple in-memory rate limiter for sensitive actions
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = {
  maxAttempts: 5,           // Max 5 sensitive actions
  windowMs: 15 * 60 * 1000, // Per 15 minutes
};

/**
 * Rate limit check for sensitive operations
 */
function checkRateLimit(userId: string, action: string): { allowed: boolean; retryAfter?: number } {
  const key = `${userId}:${action}`;
  const now = Date.now();
  
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return { allowed: true };
  }
  
  if (record.count >= RATE_LIMIT.maxAttempts) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  return { allowed: true };
}

/**
 * Middleware: Require password re-confirmation for sensitive actions
 * 
 * Usage: router.post('/unlock/:email', requireReauth, securityController.unlockAccount)
 * 
 * Client must send: { confirmPassword: "admin's password" } in request body
 */
export const requireReauth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const { confirmPassword } = req.body;
    
    if (!userId) {
      throw new AppError('Authentication required', 401);
    }
    
    // Check rate limit
    const rateCheck = checkRateLimit(userId, 'sensitive-action');
    if (!rateCheck.allowed) {
      throw new AppError(
        `Too many attempts. Please try again in ${rateCheck.retryAfter} seconds.`,
        429
      );
    }
    
    // Require password confirmation
    if (!confirmPassword) {
      throw new AppError('Password confirmation required for this action', 400, {
        requiresConfirmation: true,
        message: 'Please enter your password to confirm this sensitive action.',
      });
    }
    
    // Verify the admin's password
    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true, role: true },
    });
    
    if (!admin || admin.role !== 'ADMIN') {
      throw new AppError('Admin access required', 403);
    }
    
    const isValidPassword = await bcrypt.compare(confirmPassword, admin.password);
    
    if (!isValidPassword) {
      // Log failed attempt
      logger.warn(`Failed re-authentication for admin ${admin.email} on sensitive action`);
      throw new AppError('Invalid password. Please try again.', 401);
    }
    
    // Log successful re-auth
    logger.info(`Admin ${admin.email} re-authenticated for sensitive action: ${req.path}`);
    
    // Remove confirmPassword from body to not pass it downstream
    delete req.body.confirmPassword;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Rate limit only (no re-auth)
 * 
 * For less critical but still sensitive operations
 */
export const rateLimitSensitive = (action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    
    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }
    
    const rateCheck = checkRateLimit(userId, action);
    
    if (!rateCheck.allowed) {
      return next(new AppError(
        `Too many requests. Please try again in ${rateCheck.retryAfter} seconds.`,
        429
      ));
    }
    
    next();
  };
};

/**
 * Audit log for sensitive actions
 */
export const auditSensitiveAction = async (
  adminId: string,
  action: string,
  target: string,
  details?: Record<string, any>
) => {
  try {
    await prisma.loginAttempt.create({
      data: {
        email: `ADMIN_ACTION:${action}`,
        ipAddress: details?.ipAddress,
        userAgent: details?.userAgent,
        success: true,
        failureReason: JSON.stringify({
          adminId,
          action,
          target,
          timestamp: new Date().toISOString(),
          ...details,
        }),
      },
    });
  } catch (error) {
    logger.error('Failed to log sensitive action:', error);
  }
};

