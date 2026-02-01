import { Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { AuthRequest } from '../middleware/auth';

export const walletController = {
  async getWallet(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId || req.user!.userId;
      const wallet = await walletService.getWallet(userId);
      res.json({ success: true, data: wallet });
    } catch (error) {
      next(error);
    }
  },
  
  async getTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId || req.user!.userId;
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as any,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      const result = await walletService.getWalletTransactions(userId, params);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async transfer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { toUserId, amount, description } = req.body;
      const result = await walletService.transfer(req.user!.userId, { toUserId, amount, description });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async addFunds(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId, amount, description } = req.body;
      const wallet = await walletService.addFunds(req.user!.userId, userId, amount, description);
      res.json({ success: true, data: wallet });
    } catch (error) {
      next(error);
    }
  },
  
  async deductFunds(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId, amount, description } = req.body;
      const wallet = await walletService.deductFunds(req.user!.userId, userId, amount, description);
      res.json({ success: true, data: wallet });
    } catch (error) {
      next(error);
    }
  },
};

