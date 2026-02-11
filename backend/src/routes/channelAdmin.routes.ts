import { Router } from 'express';
import { channelAdminController } from '../controllers/channelAdmin.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// ===================== TRANSACTION CHANNEL CRUD =====================

/**
 * @route GET /api/admin/channels
 * @desc List all transaction channels
 * @access Admin only
 */
router.get('/', channelAdminController.listChannels);

/**
 * @route GET /api/admin/channels/statistics
 * @desc Get channel usage statistics
 * @access Admin only
 */
router.get('/statistics', channelAdminController.getChannelStatistics);

/**
 * @route GET /api/admin/channels/:id
 * @desc Get single channel details
 * @access Admin only
 */
router.get('/:id', channelAdminController.getChannel);

/**
 * @route POST /api/admin/channels
 * @desc Create new transaction channel
 * @access Admin only
 */
router.post('/', channelAdminController.createChannel);

/**
 * @route PATCH /api/admin/channels/:id/response-codes
 * @desc Update pgResponseCodes for a channel
 * @access Admin only
 */
router.patch('/:id/response-codes', channelAdminController.updateChannelResponseCodes);

/**
 * @route PUT /api/admin/channels/:id
 * @desc Update transaction channel
 * @access Admin only
 */
router.put('/:id', channelAdminController.updateChannel);

/**
 * @route DELETE /api/admin/channels/:id
 * @desc Delete transaction channel (only if no transactions)
 * @access Admin only
 */
router.delete('/:id', channelAdminController.deleteChannel);

// ===================== SCHEMA PAYIN RATES =====================

/**
 * @route GET /api/admin/schemas/:schemaId/payin-rates
 * @desc Get all payin rates for a schema
 * @access Admin only
 */
router.get('/schemas/:schemaId/payin-rates', channelAdminController.getSchemaPayinRates);

/**
 * @route POST /api/admin/schemas/:schemaId/payin-rates
 * @desc Set payin rate for a schema + channel
 * @access Admin only
 */
router.post('/schemas/:schemaId/payin-rates', channelAdminController.setSchemaPayinRate);

// ===================== SCHEMA PAYOUT CONFIG =====================

/**
 * @route GET /api/admin/channels/schemas/:schemaId/payout-config/:pgId
 * @desc Get payout configuration for a schema + PG
 * @access Admin only
 */
router.get('/schemas/:schemaId/payout-config/:pgId', channelAdminController.getSchemaPayoutConfig);

/**
 * @route POST /api/admin/schemas/:schemaId/payout-config
 * @desc Set payout configuration for a schema
 * @access Admin only
 */
router.post('/schemas/:schemaId/payout-config', channelAdminController.setSchemaPayoutConfig);

export default router;
