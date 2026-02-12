import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

/**
 * Card Type Controller - DEPRECATED
 * Card types are now managed through Transaction Channels
 * Use /api/admin/channels endpoints instead
 */
export const cardTypeController = {
  // All methods return deprecation notices or empty data for backward compatibility
  
  async createCardType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      throw new AppError('Card Types are deprecated. Use POST /api/admin/channels', 410);
    } catch (error) {
      next(error);
    }
  },
  
  async updateCardType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      throw new AppError('Card Types are deprecated. Use PUT /api/admin/channels/:id', 410);
    } catch (error) {
      next(error);
    }
  },
  
  async getCardTypesByPG(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: [], message: 'Card Types deprecated. Use GET /api/admin/channels' });
    } catch (error) {
      next(error);
    }
  },
  
  async getAllCardTypes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: [], message: 'Card Types deprecated. Use GET /api/admin/channels' });
    } catch (error) {
      next(error);
    }
  },
  
  async getCardTypeById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      throw new AppError('Card Types deprecated. Use GET /api/admin/channels/:id', 410);
    } catch (error) {
      next(error);
    }
  },
  
  async toggleCardTypeStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      throw new AppError('Card Types deprecated. Use PUT /api/admin/channels/:id', 410);
    } catch (error) {
      next(error);
    }
  },
  
  async deleteCardType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      throw new AppError('Card Types deprecated. Use DELETE /api/admin/channels/:id', 410);
    } catch (error) {
      next(error);
    }
  },
  
  async setSchemaCardTypeRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      throw new AppError('Schema Card Type Rates deprecated. Use POST /api/admin/channels/schemas/:schemaId/payin-rates', 410);
    } catch (error) {
      next(error);
    }
  },
  
  async getSchemaCardTypeRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: [], message: 'Use GET /api/admin/channels/schemas/:schemaId/payin-rates' });
    } catch (error) {
      next(error);
    }
  },
  
  async bulkSetSchemaCardTypeRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      throw new AppError('Deprecated. Use new channels API', 410);
    } catch (error) {
      next(error);
    }
  },
  
  async assignUserCardTypeRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      throw new AppError('User Card Type Rates deprecated. Use POST /api/user-rates/:userId/payin-rates', 410);
    } catch (error) {
      next(error);
    }
  },
  
  async getUserCardTypeRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: [], message: 'Use GET /api/user-rates/:userId/rates' });
    } catch (error) {
      next(error);
    }
  },
  
  async getMyCardTypeRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: [], message: 'Use GET /api/user-rates/:userId/rates' });
    } catch (error) {
      next(error);
    }
  },
  
  async getCardTypeRatesAssignedByMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: [] });
    } catch (error) {
      next(error);
    }
  },
  
  async getTransactionRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      throw new AppError('Deprecated. Rates are now automatically calculated via channels', 410);
    } catch (error) {
      next(error);
    }
  },
};

