import { Router } from 'express';
import { bbpsController } from '../controllers/bbps.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/fetch', bbpsController.fetchBill);
router.post('/pay', bbpsController.payBill);
router.post('/refresh/:billId', bbpsController.refreshBill);
router.get('/bills', bbpsController.getUserBills);

export default router;
