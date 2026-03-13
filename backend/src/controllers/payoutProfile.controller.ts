import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { payoutProfileService } from '../services/payoutProfile.service';

export const payoutProfileController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const profile = await payoutProfileService.createProfile(userId, req.body);
      res.status(201).json({ success: true, data: profile });
    } catch (e) {
      next(e);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const profiles = await payoutProfileService.getProfiles(userId);
      res.json({ success: true, data: profiles });
    } catch (e) {
      next(e);
    }
  },

  async getByMobile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { mobile } = req.params;
      const profile = await payoutProfileService.getProfileByMobile(userId, mobile);
      res.json({ success: true, data: profile });
    } catch (e) {
      next(e);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { profileId } = req.params;
      const profile = await payoutProfileService.getProfileById(userId, profileId);
      res.json({ success: true, data: profile });
    } catch (e) {
      next(e);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { profileId } = req.params;
      const profile = await payoutProfileService.updateProfile(userId, profileId, req.body);
      res.json({ success: true, data: profile });
    } catch (e) {
      next(e);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { profileId } = req.params;
      await payoutProfileService.deleteProfile(userId, profileId);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },
};
