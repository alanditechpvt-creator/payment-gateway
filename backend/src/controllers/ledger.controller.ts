import { Response, NextFunction } from 'express';
import { ledgerService } from '../services/ledger.service';
import { AuthRequest } from '../middleware/auth';

export const ledgerController = {
  // Get own ledger
  async getMyLedger(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        type: req.query.type as string,
        search: req.query.search as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      
      const result = await ledgerService.getUserLedger(req.user!.userId, params);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  
  // Get specific user's ledger (admin/hierarchy)
  async getUserLedger(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        type: req.query.type as string,
        search: req.query.search as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      
      const result = await ledgerService.getUserLedger(userId, params);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  
  // Get global ledger (admin only)
  async getGlobalLedger(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        type: req.query.type as string,
        userId: req.query.userId as string,
        search: req.query.search as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      
      const result = await ledgerService.getGlobalLedger(params);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  
  // Export ledger
  async exportLedger(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId || req.user!.userId;
      const params = {
        format: (req.query.format as 'json' | 'csv') || 'csv',
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      
      const result = await ledgerService.exportLedger(userId, params);
      
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.content);
    } catch (error) {
      next(error);
    }
  },
};

