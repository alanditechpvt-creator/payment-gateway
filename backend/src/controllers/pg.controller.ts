import { Response, NextFunction } from 'express';
import { pgService } from '../services/pg.service';
import { AuthRequest } from '../middleware/auth';

export const pgController = {
  async createPG(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pg = await pgService.createPG(req.body);
      res.status(201).json({ success: true, data: pg });
    } catch (error) {
      next(error);
    }
  },
  
  async updatePG(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const pg = await pgService.updatePG(pgId, req.body);
      res.json({ success: true, data: pg });
    } catch (error) {
      next(error);
    }
  },
  
  async getPGs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const params = req.query.page ? {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'asc',
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      } : undefined;
      const result = await pgService.getPGs(params);
      res.json({ success: true, ...(Array.isArray(result) ? { data: result } : result) });
    } catch (error) {
      next(error);
    }
  },
  
  async getPGById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const pg = await pgService.getPGById(pgId);
      res.json({ success: true, data: pg });
    } catch (error) {
      next(error);
    }
  },
  
  async getAvailablePGs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pgs = await pgService.getAvailablePGsForUser(req.user!.userId);
      res.json({ success: true, data: pgs });
    } catch (error) {
      next(error);
    }
  },
  
  async toggleStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const { isActive } = req.body;
      const pg = await pgService.togglePGStatus(pgId, isActive);
      res.json({ success: true, data: pg });
    } catch (error) {
      next(error);
    }
  },
  
  async deletePG(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const result = await pgService.deletePG(pgId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const stats = await pgService.getPGStats(pgId, startDate, endDate);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },
  
  // Get payout slabs for a user's schema and specific PG
  async getPayoutSlabs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const slabs = await pgService.getPayoutSlabsForUser(req.user!.userId, pgId);
      res.json({ success: true, data: slabs });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Update PG base rate
  async updateBaseRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const { baseRate } = req.body;
      
      if (baseRate === undefined || baseRate === null) {
        return res.status(400).json({ 
          success: false, 
          error: 'baseRate is required' 
        });
      }
      
      const pg = await pgService.updateBaseRate(pgId, parseFloat(baseRate));
      res.json({ success: true, data: pg });
    } catch (error) {
      next(error);
    }
  },

  // Get all channels for a PG
  async getChannels(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const channels = await pgService.getChannelsForPG(pgId);
      res.json({ success: true, data: channels });
    } catch (error) {
      next(error);
    }
  },
};

