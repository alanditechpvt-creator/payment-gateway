import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload, ROLE_HIERARCHY } from '../types';
import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, status: true },
      });
      
      if (!user || user.status === 'SUSPENDED') {
        res.status(401).json({ success: false, error: 'User not found or suspended' });
        return;
      }
      
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }
  } catch (error) {
    next(error);
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
};

export const authorizeHierarchy = (requiredLevel: UserRole) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    
    const userLevel = ROLE_HIERARCHY[req.user.role];
    const requiredLevelNum = ROLE_HIERARCHY[requiredLevel];
    
    if (userLevel > requiredLevelNum) {
      res.status(403).json({ success: false, error: 'Insufficient hierarchy level' });
      return;
    }
    
    next();
  };
};

export const checkPermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    
    // Admin has all permissions
    if (req.user.role === 'ADMIN') {
      next();
      return;
    }
    
    const userPermission = await prisma.userPermission.findUnique({
      where: { userId: req.user.userId },
    });
    
    if (!userPermission) {
      res.status(403).json({ success: false, error: 'No permissions found' });
      return;
    }
    
    const hasPermission = (userPermission as any)[permission] === true;
    
    if (!hasPermission) {
      res.status(403).json({ success: false, error: `Permission denied: ${permission}` });
      return;
    }
    
    next();
  };
};

