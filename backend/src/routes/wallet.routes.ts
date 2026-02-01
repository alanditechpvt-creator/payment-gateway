import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authenticate, authorize, checkPermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Get own wallet
router.get('/', walletController.getWallet);
router.get('/transactions', walletController.getTransactions);

// Get specific user's wallet (for hierarchy)
router.get('/:userId', walletController.getWallet);
router.get('/:userId/transactions', walletController.getTransactions);

// Transfer funds
router.post('/transfer', checkPermission('canTransferWallet'), walletController.transfer);

// Admin only - add/deduct funds
router.post('/add', authorize('ADMIN'), walletController.addFunds);
router.post('/deduct', authorize('ADMIN'), walletController.deductFunds);

export default router;

