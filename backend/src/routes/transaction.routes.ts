import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authenticate, checkPermission } from '../middleware/auth';

const router = Router();

// Webhook (no auth - will use signature verification)
router.post('/webhook/:transactionId', transactionController.processWebhook);

// Public endpoint for payment links (no auth required)
router.get('/public/:transactionId', transactionController.getTransactionByIdPublic);

router.use(authenticate);

// Create transaction
router.post('/', transactionController.createTransaction);

// Update transaction status (for manual status update after PG redirect)
router.patch('/:transactionId/status', transactionController.updateTransactionStatus);

// Check status with Payment Gateway (OFFLINE mode - no webhook needed)
router.post('/:transactionId/check-pg-status', transactionController.checkStatusWithPG);

// Get transactions
router.get('/', checkPermission('canViewTransactions'), transactionController.getTransactions);
router.get('/stats', transactionController.getStats);

// Get rate breakdown (including card type specific rates)
router.get('/rate-breakdown/:pgId', transactionController.getRateBreakdown);

router.get('/:transactionId', transactionController.getTransactionById);

export default router;

