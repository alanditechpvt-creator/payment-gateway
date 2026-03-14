import { Response, NextFunction } from 'express';
import { bbpsService } from '../services/bbps.service';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';

export const bbpsController = {
  fetchBill: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log('BBPS Fetch Request Body:', req.body);
      const { category, mobileNumber, cardLast4, billerId } = req.body;
      const userId = req.user!.userId;
      
      const result = await bbpsService.fetchBill(userId, category, { 
        mobileNumber, 
        cardLast4, 
        billerId 
      });
      
      console.log('BBPS Fetch Result:', result);
      res.json(result);
    } catch (error) {
      console.error('BBPS Fetch Error:', error);
      next(error);
    }
  },

  payBill: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { amount, mobileNumber, cardLast4, billerName, pgId } = req.body;
      const userId = req.user!.userId;
      
      const result = await bbpsService.payBill(userId, {
        amount,
        mobileNumber,
        cardLast4,
        billerName,
        pgId
      });
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  refreshBill: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { billId } = req.params;
      const userId = req.user!.userId;
      
      const result = await bbpsService.refreshBill(billId, userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  getUserBills: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { status, fromDate, toDate } = req.query;
      
      const bills = await bbpsService.getUserBills(userId, {
        status: status as string,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
      });
      
      res.json({ success: true, data: bills });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/bbps/billers – List billers (banks) from DB. Query: category (e.g. CREDIT_CARD). Sync first via POST /api/bbps/billers/sync. */
  getBillers: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const billers = await bbpsService.getBillersFromDb(category);
      res.json({ success: true, data: billers });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/bbps/billers/sync – Fetch billers from Bill Avenue (Biller Info API) and store in DB. Uses BBPS_BILLER_IDS. */
  syncBillers: async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await bbpsService.syncBillersToDb();
      res.json({ success: true, ...result, message: `Synced ${result.synced} billers.` });
    } catch (error) {
      next(error);
    }
  },
};
