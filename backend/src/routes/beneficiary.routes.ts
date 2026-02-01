import { Router } from 'express';
import { beneficiaryController } from '../controllers/beneficiary.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// IFSC lookup (before :beneficiaryId to avoid conflict)
router.get('/ifsc/:ifsc', beneficiaryController.lookupIfsc);

// CRUD operations
router.post('/', beneficiaryController.createBeneficiary);
router.get('/', beneficiaryController.getBeneficiaries);
router.get('/:beneficiaryId', beneficiaryController.getBeneficiaryById);
router.patch('/:beneficiaryId', beneficiaryController.updateBeneficiary);
router.delete('/:beneficiaryId', beneficiaryController.deleteBeneficiary);

// Actions
router.post('/:beneficiaryId/toggle', beneficiaryController.toggleBeneficiaryStatus);
router.post('/:beneficiaryId/verify', beneficiaryController.verifyBeneficiary);

export default router;

