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

  /** POST /api/bbps/billers/sync – Fetch billers from Bill Avenue (Biller Info API) and store in DB. Body: { billerIds?: string[] } or uses BBPS_BILLER_IDS. */
  syncBillers: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const billerIds = req.body?.billerIds;
      const result = await bbpsService.syncBillersToDb(billerIds);
      res.json({ success: true, ...result, message: `Synced ${result.synced} billers.` });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/bbps/billers/fetch-one – Call Biller Info API for one billerId, store in DB, return biller. Body: { billerId: string }. */
  fetchOneBiller: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { billerId } = req.body || {};
      if (!billerId || typeof billerId !== 'string') {
        return res.status(400).json({ success: false, error: 'billerId (14 characters) is required in body.' });
      }
      const biller = await bbpsService.fetchOneBillerAndStore(billerId);
      res.json({ success: true, data: biller, message: 'Biller fetched from Bill Avenue and saved.' });
    } catch (error) {
      next(error);
    }
  },
};
