
import { Router } from 'express';
import { cashfreeController } from '../controllers/cashfree.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Create Order (Protected)
router.post('/orders', authenticate, cashfreeController.createOrder);

// Verify Payment (Protected)
router.post('/verify', authenticate, cashfreeController.verifyPayment);

// Webhook (Public)
router.post('/webhook', cashfreeController.webhook);

// Get Status (Public/Protected - making it protected for security, or check if it needs to be public)
// Usually status check might be needed by admin or user, so protected is safer.
router.get('/status/:orderId', authenticate, cashfreeController.getStatus);

export default router;
