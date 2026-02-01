import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { rateService } from '../services/rate.service';

export const rateController = {
  /**
   * Get current user's rates (what they are charged for each PG)
   */
  async getMyRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rates = await rateService.getUserRates(req.user!.userId);
      res.json({ success: true, data: rates });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get base rate visible to current user for a specific PG
   */
  async getMyBaseRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const baseRate = await rateService.getBaseRateForUser(req.user!.userId, pgId);
      res.json({ success: true, data: baseRate });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get available PGs for rate assignment (with minimum assignable rates)
   */
  async getAvailablePGsForAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pgs = await rateService.getAvailablePGsForAssignment(req.user!.userId);
      res.json({ success: true, data: pgs });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get children with their assigned rates
   */
  async getChildrenRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.query;
      const children = await rateService.getChildrenRates(
        req.user!.userId, 
        pgId as string | undefined
      );
      res.json({ success: true, data: children });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Assign rate to a child user
   */
  async assignRate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetUserId, pgId, payinRate, payoutRate } = req.body;
      
      if (!targetUserId || !pgId) {
        return res.status(400).json({ 
          success: false, 
          error: 'targetUserId and pgId are required' 
        });
      }
      
      const rate = await rateService.assignRate(
        req.user!.userId,
        targetUserId,
        pgId,
        parseFloat(payinRate) || 0,
        parseFloat(payoutRate) || 0
      );
      
      res.json({ success: true, data: rate });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Bulk assign rates to multiple children
   */
  async bulkAssignRates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignments } = req.body;
      
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'assignments array is required' 
        });
      }
      
      const result = await rateService.bulkAssignRates(req.user!.userId, assignments);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Toggle PG enablement for a child user
   */
  async togglePGForUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { targetUserId, pgId } = req.params;
      const { isEnabled } = req.body;
      
      const rate = await rateService.togglePGForUser(
        req.user!.userId,
        targetUserId,
        pgId,
        isEnabled
      );
      
      res.json({ success: true, data: rate });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get rate for a specific user (Admin only or parent)
   */
  async getUserRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId, pgId } = req.params;
      const payinRate = await rateService.getUserRate(userId, pgId, 'PAYIN');
      const payoutRate = await rateService.getUserRate(userId, pgId, 'PAYOUT');
      
      res.json({ 
        success: true, 
        data: { payinRate, payoutRate } 
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Preview commission calculation for a transaction amount
   */
  async previewCommissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pgId, amount, type } = req.body;
      
      if (!pgId || !amount || !type) {
        return res.status(400).json({ 
          success: false, 
          error: 'pgId, amount, and type are required' 
        });
      }
      
      const commissions = await rateService.calculateHierarchicalCommissions(
        'preview',
        req.user!.userId,
        pgId,
        parseFloat(amount),
        type
      );
      
      res.json({ success: true, data: commissions });
    } catch (error) {
      next(error);
    }
  },
};
