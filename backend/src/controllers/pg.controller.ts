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

  async updateBaseRate(_req: AuthRequest, res: Response) {
    res.status(410).json({
      success: false,
      error: 'PG-level base rate removed. Set base rate per channel (card type) via PATCH /api/admin/channels/:channelId with baseCost.',
    });
  },

  async getChannels(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const channels = await pgService.getChannelsForPG(pgId);
      res.json({ success: true, data: channels });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sample payment response structure for a PG (for channel/card-type mapping).
   * Does not call the PG API; returns static examples of response shapes we use to build rawPaymentMethod.
   */
  async getSampleResponse(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const pg = await pgService.getPGById(pgId);
      if (!pg) {
        return res.status(404).json({ success: false, error: 'Payment gateway not found' });
      }
      const code = (pg as any).code || '';
      const samples: Record<string, any> = {
        RAZORPAY: {
          description: 'From Razorpay Payments API (e.g. GET /payments/:id) after payment',
          paymentDetails: {
            method: 'card',
            card: { network: 'visa', type: 'credit', last4: '4111' },
            amount: 10000,
            status: 'captured',
          },
          mapping: {
            rawPaymentMethod: 'Built from method + card.network + card.type',
            card: '→ credit_<network>_normal (e.g. credit_visa_normal)',
            debit: '→ rawPaymentMethod = "debitcard"',
            upi: '→ method "upi" → rawPaymentMethod = "upi"',
            netbanking: '→ method "netbanking" → rawPaymentMethod = "netbanking"',
          },
        },
        SABPAISA: {
          description: 'From Sabpaisa callback / response; map equivalent fields to method + card type',
          mapping: {
            rawPaymentMethod: 'Use TXN_MODE, CARD_TYPE, CARD_CATEGORY (or equivalent) to build same strings as Razorpay',
          },
        },
        RUNPAISA: {
          description: 'From Runpaisa ORDERSTATUS in webhook',
          orderStatus: {
            TXN_MODE: 'card',
            CARD_TYPE: 'VISA',
            CARD_CATEGORY: 'NORMAL',
            PG_PARTNER: 'razorpay',
          },
          mapping: {
            rawPaymentMethod: 'Built from TXN_MODE + CARD_TYPE + CARD_CATEGORY (e.g. credit_visa_normal)',
          },
        },
      };
      const sample = samples[code] || {
        description: 'No sample for this PG. Use Razorpay/Runpaisa samples as reference and map your PG response fields to method + card network + type.',
        mapping: { rawPaymentMethod: 'Must match TransactionChannel.pgResponseCodes for channel detection' },
      };
      res.json({ success: true, data: { pgCode: code, ...sample } });
    } catch (error) {
      next(error);
    }
  },
};

