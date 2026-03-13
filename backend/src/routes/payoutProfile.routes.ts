import { Router } from 'express';
import { payoutProfileController } from '../controllers/payoutProfile.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', payoutProfileController.create);
router.get('/', payoutProfileController.list);
router.get('/by-mobile/:mobile', payoutProfileController.getByMobile);
router.get('/:profileId', payoutProfileController.getById);
router.patch('/:profileId', payoutProfileController.update);
router.delete('/:profileId', payoutProfileController.delete);

export default router;
