import { Router } from 'express';
import { userRatesController } from '../controllers/userRates.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===================== GET USER RATES =====================

/**
 * @route GET /api/users/:userId/rates
 * @desc Get all rates for a user (both payin and payout)
 * @access MD, Admin
 */
router.get('/:userId/rates', authorize(['MD', 'ADMIN']), userRatesController.getUserRates);

/**
 * @route GET /api/users/:userId/available-channels
 * @desc Get available channels for a user (based on PG assignment)
 * @access MD, Admin
 */
router.get('/:userId/available-channels', authorize(['MD', 'ADMIN']), userRatesController.getAvailableChannels);

// ===================== ASSIGN PAYIN RATES =====================

/**
 * @route POST /api/users/:userId/payin-rates
 * @desc Assign custom payin rate to a user
 * @access MD, Admin only
 */
router.post('/:userId/payin-rates', authorize(['MD', 'ADMIN']), userRatesController.assignPayinRate);

/**
 * @route PUT /api/users/:userId/payin-rates/:rateId
 * @desc Update user's payin rate
 * @access MD, Admin only
 */
router.put('/:userId/payin-rates/:rateId', authorize(['MD', 'ADMIN']), userRatesController.updatePayinRate);

/**
 * @route DELETE /api/users/:userId/payin-rates/:rateId
 * @desc Remove user's custom payin rate (fallback to schema rate)
 * @access MD, Admin only
 */
router.delete('/:userId/payin-rates/:rateId', authorize(['MD', 'ADMIN']), userRatesController.removePayinRate);

// ===================== ASSIGN PAYOUT RATES =====================

/**
 * @route POST /api/users/:userId/payout-rate
 * @desc Assign custom payout rate slabs to a user
 * @access MD, Admin only
 */
router.post('/:userId/payout-rate', authorize(['MD', 'ADMIN']), userRatesController.assignPayoutRate);

/**
 * @route DELETE /api/users/:userId/payout-rate
 * @desc Remove user's custom payout rate (fallback to schema rate)
 * @access MD, Admin only
 */
router.delete('/:userId/payout-rate', authorize(['MD', 'ADMIN']), userRatesController.removePayoutRate);

// ===================== BULK OPERATIONS =====================

/**
 * @route POST /api/users/bulk-assign-payin-rates
 * @desc Assign same payin rate to multiple users
 * @access MD, Admin only
 */
router.post('/bulk-assign-payin-rates', authorize(['MD', 'ADMIN']), userRatesController.bulkAssignPayinRates);

export default router;
