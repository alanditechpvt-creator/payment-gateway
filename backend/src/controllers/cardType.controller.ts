import { Response, NextFunction } from 'express';
import { cardTypeService } from '../services/cardType.service';
import { AuthRequest } from '../middleware/auth';

export const cardTypeController = {
  // ==================== CARD TYPE CRUD ====================
  
  async createCardType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const cardType = await cardTypeService.createCardType(req.body);
      res.status(201).json({ success: true, data: cardType });
    } catch (error) {
      next(error);
    }
  },
  
  async updateCardType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cardTypeId } = req.params;
      const cardType = await cardTypeService.updateCardType(cardTypeId, req.body);
      res.json({ success: true, data: cardType });
    } catch (error) {
      next(error);
    }
  },
  
  async getCardTypesByPG(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const cardTypes = await cardTypeService.getCardTypesByPG(pgId);
      res.json({ success: true, data: cardTypes });
    } catch (error) {
      next(error);
    }
  },
  
  async getAllCardTypes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filters = {
        pgId: req.query.pgId as string,
        internalPG: req.query.internalPG as string,
        cardNetwork: req.query.cardNetwork as string,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      };
      const cardTypes = await cardTypeService.getAllCardTypes(filters);
      res.json({ success: true, data: cardTypes });
    } catch (error) {
      next(error);
    }
  },
  
  async getCardTypeById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cardTypeId } = req.params;
      const cardType = await cardTypeService.getCardTypeById(cardTypeId);
      res.json({ success: true, data: cardType });
    } catch (error) {
      next(error);
    }
  },
  
  async toggleCardTypeStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cardTypeId } = req.params;
      const { isActive } = req.body;
      const cardType = await cardTypeService.toggleCardTypeStatus(cardTypeId, isActive);
      res.json({ success: true, data: cardType });
    } catch (error) {
      next(error);
    }
  },
  
  async deleteCardType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cardTypeId } = req.params;
      const result = await cardTypeService.deleteCardType(cardTypeId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  // ==================== SCHEMA CARD TYPE RATES ====================
  
  async setSchemaCardTypeRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId, cardTypeId } = req.params;
      const { payinRate } = req.body;
      const rate = await cardTypeService.setSchemaCardTypeRate(schemaId, cardTypeId, payinRate);
      res.json({ success: true, data: rate });
    } catch (error) {
      next(error);
    }
  },
  
  async getSchemaCardTypeRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const rates = await cardTypeService.getSchemaCardTypeRates(schemaId);
      res.json({ success: true, data: rates });
    } catch (error) {
      next(error);
    }
  },
  
  async bulkSetSchemaCardTypeRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const { rates } = req.body;
      const results = await cardTypeService.bulkSetSchemaCardTypeRates(schemaId, rates);
      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  },
  
  // ==================== USER CARD TYPE RATES ====================
  
  async assignUserCardTypeRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId, cardTypeId } = req.params;
      const { payinRate } = req.body;
      const rate = await cardTypeService.assignUserCardTypeRate(
        req.user!.userId,
        userId,
        cardTypeId,
        payinRate
      );
      res.json({ success: true, data: rate });
    } catch (error) {
      next(error);
    }
  },
  
  async getUserCardTypeRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const rates = await cardTypeService.getUserCardTypeRates(userId || req.user!.userId);
      res.json({ success: true, data: rates });
    } catch (error) {
      next(error);
    }
  },
  
  async getMyCardTypeRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rates = await cardTypeService.getUserCardTypeRates(req.user!.userId);
      res.json({ success: true, data: rates });
    } catch (error) {
      next(error);
    }
  },
  
  async getCardTypeRatesAssignedByMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rates = await cardTypeService.getCardTypeRatesAssignedByMe(req.user!.userId);
      res.json({ success: true, data: rates });
    } catch (error) {
      next(error);
    }
  },
  
  // ==================== RATE LOOKUP ====================
  
  async getTransactionRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pgId } = req.params;
      const { cardTypeCode } = req.query;
      const result = await cardTypeService.getTransactionRate(
        req.user!.userId,
        pgId,
        cardTypeCode as string
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};

