import { Response, NextFunction } from 'express';
import { beneficiaryService } from '../services/beneficiary.service';
import { AuthRequest } from '../middleware/auth';

export const beneficiaryController = {
  async createBeneficiary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const beneficiary = await beneficiaryService.createBeneficiary(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: beneficiary });
    } catch (error) {
      next(error);
    }
  },

  async getBeneficiaries(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const params = {
        search: req.query.search as string,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      };
      const beneficiaries = await beneficiaryService.getBeneficiaries(req.user!.userId, params);
      res.json({ success: true, data: beneficiaries });
    } catch (error) {
      next(error);
    }
  },

  async getBeneficiaryById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { beneficiaryId } = req.params;
      const beneficiary = await beneficiaryService.getBeneficiaryById(req.user!.userId, beneficiaryId);
      res.json({ success: true, data: beneficiary });
    } catch (error) {
      next(error);
    }
  },

  async updateBeneficiary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { beneficiaryId } = req.params;
      const beneficiary = await beneficiaryService.updateBeneficiary(req.user!.userId, beneficiaryId, req.body);
      res.json({ success: true, data: beneficiary });
    } catch (error) {
      next(error);
    }
  },

  async deleteBeneficiary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { beneficiaryId } = req.params;
      const result = await beneficiaryService.deleteBeneficiary(req.user!.userId, beneficiaryId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async toggleBeneficiaryStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { beneficiaryId } = req.params;
      const beneficiary = await beneficiaryService.toggleBeneficiaryStatus(req.user!.userId, beneficiaryId);
      res.json({ success: true, data: beneficiary });
    } catch (error) {
      next(error);
    }
  },

  async verifyBeneficiary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { beneficiaryId } = req.params;
      const beneficiary = await beneficiaryService.verifyBeneficiary(req.user!.userId, beneficiaryId);
      res.json({ success: true, data: beneficiary });
    } catch (error) {
      next(error);
    }
  },
  
  // IFSC lookup endpoint
  async lookupIfsc(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { ifsc } = req.params;
      const details = await beneficiaryService.lookupIfsc(ifsc);
      res.json({ success: true, data: details });
    } catch (error) {
      next(error);
    }
  },
};

