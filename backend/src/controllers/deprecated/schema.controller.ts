import { Response, NextFunction } from 'express';
import { schemaService } from '../services/schema.service';
import { AuthRequest } from '../middleware/auth';

export const schemaController = {
  async createSchema(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schema = await schemaService.createSchema(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: schema });
    } catch (error) {
      next(error);
    }
  },
  
  async updateSchema(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const schema = await schemaService.updateSchema(schemaId, req.body);
      res.json({ success: true, data: schema });
    } catch (error) {
      next(error);
    }
  },
  
  async getSchemas(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const params = req.query.page ? {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'asc',
        role: req.query.role as any,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      } : undefined;
      const result = await schemaService.getSchemas(params);
      res.json({ success: true, ...(Array.isArray(result) ? { data: result } : result) });
    } catch (error) {
      next(error);
    }
  },
  
  async getSchemaById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const schema = await schemaService.getSchemaById(schemaId);
      res.json({ success: true, data: schema });
    } catch (error) {
      next(error);
    }
  },
  
  async setPGRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const { rates } = req.body;
      const schema = await schemaService.setPGRates(schemaId, rates);
      res.json({ success: true, data: schema });
    } catch (error) {
      next(error);
    }
  },
  
  async addPGRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const rate = await schemaService.addPGRate(schemaId, req.body);
      res.json({ success: true, data: rate });
    } catch (error) {
      next(error);
    }
  },
  
  async removePGRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId, pgId } = req.params;
      const result = await schemaService.removePGRate(schemaId, pgId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async toggleStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const { isActive } = req.body;
      const schema = await schemaService.toggleSchemaStatus(schemaId, isActive);
      res.json({ success: true, data: schema });
    } catch (error) {
      next(error);
    }
  },
  
  async deleteSchema(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const result = await schemaService.deleteSchema(schemaId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async assignToUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaId, userId } = req.params;
      const result = await schemaService.assignSchemaToUser(userId, schemaId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  // Payout Slab Management (Admin Only)
  
  async getPayoutSlabs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaPGRateId } = req.params;
      const slabs = await schemaService.getPayoutSlabs(schemaPGRateId);
      res.json({ success: true, data: slabs });
    } catch (error) {
      next(error);
    }
  },
  
  async setPayoutSlabs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaPGRateId } = req.params;
      const { slabs } = req.body;
      const result = await schemaService.setPayoutSlabs(schemaPGRateId, slabs);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  
  async upsertPayoutSlab(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaPGRateId } = req.params;
      const { slabId, minAmount, maxAmount, flatFee } = req.body;
      const slab = await schemaService.upsertPayoutSlab(schemaPGRateId, slabId, {
        minAmount,
        maxAmount,
        flatFee,
      });
      res.json({ success: true, data: slab });
    } catch (error) {
      next(error);
    }
  },
  
  async deletePayoutSlab(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { slabId } = req.params;
      const result = await schemaService.deletePayoutSlab(slabId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async updatePayoutSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schemaPGRateId } = req.params;
      const { payoutChargeType, payoutRate, slabs } = req.body;
      const result = await schemaService.updatePGRatePayoutSettings(
        schemaPGRateId,
        payoutChargeType,
        payoutRate,
        slabs
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};

