import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { rateService } from '../services/rate.service';
import { channelRateService } from '../services/channelRate.service';

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
   * Get current user's payin rates by PG and channel (for schema-based rate display and (i) modal)
   */
  async getMyPayinRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ratesByPG = await channelRateService.getUserPayinRates(req.user!.userId);
      const out: Record<string, { paymentGateway?: { code: string }; rates: { channelName: string; channelCode: string; rate: number; rateDisplay: string; schemaRate: number; schemaRateDisplay: string }[] }> = {};
      for (const [pgCode, channels] of Object.entries(ratesByPG)) {
        out[pgCode] = {
          paymentGateway: { code: pgCode },
          rates: (channels as any[]).map((c: any) => {
            // Always use schema rate for (i) modal display (never effective/override rate)
            const schemaRate = c.schemaRate != null ? Number(c.schemaRate) : Number(c.rate);
            return {
              channelName: c.channelName,
              channelCode: c.channelCode,
              rate: c.rate,
              rateDisplay: `${(Number(c.rate) * 100).toFixed(2)}%`,
              schemaRate,
              schemaRateDisplay: `${(schemaRate * 100).toFixed(2)}%`,
            };
          }),
        };
      }
      res.json({ success: true, data: { ratesByPG: out } });
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
   * Get PG assignments for a specific user (admin: any user; others: direct child only).
   * Use this in admin Manage Rates popup so assigned PGs show for any user.
   */
  async getRatesForUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const rates = await rateService.getRatesForUser(req.user!.userId, userId);
      res.json({ success: true, data: rates });
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
      
      const payin = payinRate != null && payinRate !== '' ? parseFloat(payinRate) : undefined;
      const payout = payoutRate != null && payoutRate !== '' ? parseFloat(payoutRate) : undefined;
      
      const rate = await rateService.assignRate(
        req.user!.userId,
        targetUserId,
        pgId,
        payin,
        payout
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

  /**
   * Get user's channel rates for a PG (MD/Admin can view child rates)
   */
  async getUserChannelRates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, pgId } = req.params;
      
      const rates = await rateService.getUserChannelRates(
        req.user!.userId,
        userId,
        pgId
      );
      
      res.json({ success: true, data: rates });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get commission stats (earned by current user, day/month, from downline)
   */
  async getCommissionStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const groupBy = (req.query.groupBy as 'day' | 'month') || 'day';
      const stats = await rateService.getCommissionStats(req.user!.userId, {
        startDate,
        endDate,
        groupBy,
      });
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update single channel rate for a user
   */
  async updateChannelRate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, channelId } = req.params;
      const { payinRate } = req.body;
      
      if (payinRate === undefined || payinRate === null) {
        return res.status(400).json({ 
          success: false, 
          error: 'payinRate is required' 
        });
      }
      
      const rate = await rateService.updateChannelRate(
        req.user!.userId,
        userId,
        channelId,
        parseFloat(payinRate)
      );
      
      res.json({ success: true, data: rate });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Bulk update channel rates for a user
   */
  async bulkUpdateChannelRates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { pgId, rates } = req.body;
      
      if (!pgId || !rates || !Array.isArray(rates)) {
        return res.status(400).json({ 
          success: false, 
          error: 'pgId and rates array are required' 
        });
      }
      
      const updatedRates = await rateService.bulkUpdateChannelRates(
        req.user!.userId,
        userId,
        pgId,
        rates
      );
      
      res.json({ success: true, data: updatedRates });
    } catch (error) {
      next(error);
    }
  },
};
