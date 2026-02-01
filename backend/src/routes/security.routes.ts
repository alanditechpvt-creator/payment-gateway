/**
 * Security Routes
 * 
 * Admin endpoints for security settings and account management
 * 
 * SECURITY MODEL:
 * 1. All routes require valid JWT token (authenticate middleware)
 * 2. All routes require ADMIN role (authorize middleware)
 * 3. Critical actions (unlock, settings change) require password re-confirmation
 * 4. Rate limiting on sensitive operations
 * 5. All actions are audit logged
 */

import { Router } from 'express';
import { securityController } from '../controllers/security.controller';
import { authenticate, authorize } from '../middleware/auth';
import { requireReauth, rateLimitSensitive } from '../middleware/sensitiveAction';

const router = Router();

// Public - Get CAPTCHA config (for login page)
router.get('/captcha-config', securityController.getCaptchaConfig);

// Protected routes (Admin only)
router.use(authenticate);
router.use(authorize('ADMIN'));

// Security settings (read) - no re-auth needed
router.get('/settings', securityController.getSettings);

// Security settings (modify) - requires password confirmation
router.patch(
  '/settings/:key',
  rateLimitSensitive('settings-update'),
  requireReauth,
  securityController.updateSetting
);

router.put(
  '/settings',
  rateLimitSensitive('settings-update'),
  requireReauth,
  securityController.bulkUpdateSettings
);

// Account management - requires password confirmation (CRITICAL ACTION)
router.post(
  '/unlock/:email',
  rateLimitSensitive('account-unlock'),
  requireReauth,
  securityController.unlockAccount
);

// Audit logs (read-only) - no re-auth needed
router.get('/login-history/:email', securityController.getLoginHistory);
router.get('/failed-login-stats', securityController.getFailedLoginStats);

export default router;

