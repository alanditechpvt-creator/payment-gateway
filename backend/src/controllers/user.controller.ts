import { Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { AuthRequest } from '../middleware/auth';
import { processUploadedFiles } from '../middleware/upload';

export const userController = {
  async createUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.createUser(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },
  
  async getOnboardingInfo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const info = await userService.getOnboardingInfo(token);
      res.json({ success: true, data: info });
    } catch (error) {
      next(error);
    }
  },
  
  async completeOnboarding(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      
      // Get onboarding info to get user ID for organized storage
      const onboardingInfo = await userService.getOnboardingInfo(token);
      const userId = onboardingInfo.userId;
      
      // Process files through optimized storage service
      // Falls back to simple filename if processing fails
      let files: { [key: string]: string } = {};
      
      if (req.files) {
        try {
          files = await processUploadedFiles(req.files as any, userId);
        } catch (error) {
          console.warn('[Upload] Failed to process files through storage service, using legacy storage:', error);
          // Fallback to simple filename storage
          files = {
            profilePhoto: (req.files as any)?.profilePhoto?.[0]?.filename || undefined,
            aadhaarFront: (req.files as any)?.aadhaarFront?.[0]?.filename || undefined,
            aadhaarBack: (req.files as any)?.aadhaarBack?.[0]?.filename || undefined,
          };
        }
      }
      
      const user = await userService.completeOnboarding(token, req.body, files as any);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },
  
  async approveUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { approved, reason } = req.body;
      const result = await userService.approveUser(req.user!.userId, userId, approved, reason);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async getUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
        role: req.query.role as any,
        status: req.query.status as any,
        search: req.query.search as string,
      };
      const result = await userService.getUsers(req.user!.userId, params);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async getUserById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const user = await userService.getUserById(req.user!.userId, userId);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },
  
  async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const user = await userService.updateUser(req.user!.userId, userId, req.body);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },
  
  async updatePermissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const permissions = await userService.updatePermissions(req.user!.userId, userId, req.body);
      res.json({ success: true, data: permissions });
    } catch (error) {
      next(error);
    }
  },
  
  async assignPG(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { pgId, customRate } = req.body;
      const assignment = await userService.assignPG(req.user!.userId, userId, pgId, customRate);
      res.json({ success: true, data: assignment });
    } catch (error) {
      next(error);
    }
  },
  
  async removePGAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId, pgId } = req.params;
      const result = await userService.removePGAssignment(req.user!.userId, userId, pgId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async suspendUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const result = await userService.suspendUser(req.user!.userId, userId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async reactivateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const result = await userService.reactivateUser(req.user!.userId, userId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async sendOnboardingOTP(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const result = await userService.sendOnboardingOTP(token);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async verifyOnboardingOTP(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const { otp } = req.body;
      const result = await userService.verifyOnboardingOTP(token, otp);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async getOnboardingLink(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const result = await userService.getOnboardingLink(req.user!.userId, userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};

