import { Router } from 'express';
import { sabPaisaController } from '../controllers/sabpaisa.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Callback route (Public)
router.post('/callback', sabPaisaController.handleCallback);

// Payment Page (Public - acts as a "link" for the frontend)
router.get('/pay/:transactionId', sabPaisaController.renderPaymentForm);

// All other routes require authentication
router.use(authenticate);

// Create payment
router.post('/create-payment', sabPaisaController.createPayment);

// Config status
router.get('/config/status', sabPaisaController.getConfigStatus);

export default router;
