
import { Router } from 'express';
import { systemSettingsController } from '../controllers/system-settings.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Global Payout Config (Authenticated Users can read, Admin can write)
router.get('/payout-config', systemSettingsController.getGlobalPayoutConfig);
router.put('/payout-config', authorize('ADMIN'), systemSettingsController.updateGlobalPayoutConfig);

export default router;
