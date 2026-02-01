import { Request, Response, NextFunction } from 'express';
import { bbpsService } from '../services/bbps.service';
import { AuthRequest } from '../middleware/auth';

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
};
