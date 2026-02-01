import { Router } from 'express';
import { pgController } from '../controllers/pg.controller';
import { authenticate, authorize, checkPermission } from '../middleware/auth';

const router = Router();

// Public status pages for Mobile/Redirects
router.get('/status/success', (req, res) => {
    res.send(`
        <html>
            <head><title>Payment Successful</title></head>
            <body style="text-align: center; padding-top: 50px; font-family: sans-serif;">
                <div style="color: green; font-size: 50px;">✓</div>
                <h1>Payment Successful</h1>
                <p>Transaction ID: ${req.query.txnId || 'N/A'}</p>
                <p>You can close this window now.</p>
                <script>
                    // Try to communicate with React Native WebView
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'PAYMENT_SUCCESS',
                            txnId: '${req.query.txnId}'
                        }));
                    }
                </script>
            </body>
        </html>
    `);
});

router.get('/status/failure', (req, res) => {
    res.send(`
        <html>
            <head><title>Payment Failed</title></head>
            <body style="text-align: center; padding-top: 50px; font-family: sans-serif;">
                <div style="color: red; font-size: 50px;">✗</div>
                <h1>Payment Failed</h1>
                <p>Reason: ${req.query.reason || 'Unknown error'}</p>
                <p>Transaction ID: ${req.query.txnId || 'N/A'}</p>
                <p>Please try again.</p>
                <script>
                    // Try to communicate with React Native WebView
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'PAYMENT_FAILURE',
                            txnId: '${req.query.txnId}',
                            reason: '${req.query.reason}'
                        }));
                    }
                </script>
            </body>
        </html>
    `);
});

router.use(authenticate);

// Get available PGs for current user
router.get('/available', pgController.getAvailablePGs);

// Get payout slabs for a PG (based on user's schema)
router.get('/:pgId/payout-slabs', pgController.getPayoutSlabs);

// Admin only routes
router.post('/', authorize('ADMIN'), pgController.createPG);
router.get('/', pgController.getPGs);
router.get('/:pgId', pgController.getPGById);
router.patch('/:pgId', authorize('ADMIN'), pgController.updatePG);
router.delete('/:pgId', authorize('ADMIN'), pgController.deletePG);
router.post('/:pgId/toggle', authorize('ADMIN'), pgController.toggleStatus);
router.get('/:pgId/stats', authorize('ADMIN'), pgController.getStats);

export default router;

