import { Router } from 'express';
import { ledgerController } from '../controllers/ledger.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Get own ledger
router.get('/my', ledgerController.getMyLedger);

// Export own ledger
router.get('/my/export', ledgerController.exportLedger);

// Get specific user's ledger (admin and hierarchy)
router.get('/user/:userId', authorize(['ADMIN', 'WHITE_LABEL', 'MASTER_DISTRIBUTOR']), ledgerController.getUserLedger);

// Export specific user's ledger (admin and hierarchy)
router.get('/user/:userId/export', authorize(['ADMIN', 'WHITE_LABEL', 'MASTER_DISTRIBUTOR']), ledgerController.exportLedger);

// Get global ledger (admin only)
router.get('/global', authorize('ADMIN'), ledgerController.getGlobalLedger);

export default router;

