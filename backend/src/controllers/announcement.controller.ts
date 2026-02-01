/**
 * Announcement Controller
 * 
 * Handles API requests for broadcast announcements/news ticker
 */

import { Response, NextFunction } from 'express';
import { announcementService } from '../services/announcement.service';
import { AuthRequest } from '../middleware/auth';

export const announcementController = {
  /**
   * Create new announcement (Admin only)
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const announcement = await announcementService.create(req.user!.userId, req.body);
      res.status(201).json({
        success: true,
        data: announcement,
        message: 'Announcement created successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all announcements (Admin only)
   */
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { isActive, limit, offset } = req.query;
      const result = await announcementService.getAll({
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get active announcements for current user (for news ticker)
   */
  async getActiveForMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const announcements = await announcementService.getActiveForUser(
        req.user!.userId,
        req.user!.role
      );
      res.json({ success: true, data: announcements });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get announcement by ID
   */
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const announcement = await announcementService.getById(req.params.id);
      res.json({ success: true, data: announcement });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update announcement (Admin only)
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const announcement = await announcementService.update(req.params.id, req.body);
      res.json({
        success: true,
        data: announcement,
        message: 'Announcement updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Toggle announcement status (Admin only)
   */
  async toggle(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { isActive } = req.body;
      const announcement = await announcementService.toggle(req.params.id, isActive);
      res.json({
        success: true,
        data: announcement,
        message: `Announcement ${isActive ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete announcement (Admin only)
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await announcementService.delete(req.params.id);
      res.json({ success: true, message: 'Announcement deleted' });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get announcement statistics (Admin only)
   */
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await announcementService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },
};

