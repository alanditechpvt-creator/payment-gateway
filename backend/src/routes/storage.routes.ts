import { Router } from 'express';
import { storageController } from '../controllers/storage.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Admin only routes
router.get('/stats', authorize('ADMIN'), storageController.getStats);
router.get('/config', authorize('ADMIN'), storageController.getConfig);
router.post('/cleanup', authorize('ADMIN'), storageController.cleanupOrphaned);

export default router;

