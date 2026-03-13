import { Router } from 'express';
import { rateController } from '../controllers/rate.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get my rates (what I'm charged for each PG)
router.get('/my-rates', rateController.getMyRates);

// Get my payin rates by PG and channel (schema-based; for (i) modal)
router.get('/my-payin-rates', rateController.getMyPayinRates);

// Get my base rate for a specific PG
router.get('/my-base-rate/:pgId', rateController.getMyBaseRate);

// Get available PGs for rate assignment (with min assignable rates)
router.get('/available-pgs', rateController.getAvailablePGsForAssignment);

// Get children with their rates
router.get('/children', rateController.getChildrenRates);

// Get PG assignments for a specific user (admin: any user; others: direct child only)
router.get('/user/:userId/assignments', rateController.getRatesForUser);

// Commission stats (earned by me, day/month, from downline)
router.get('/commission-stats', rateController.getCommissionStats);

// Preview commission calculation
router.post('/preview-commissions', rateController.previewCommissions);

// Assign rate to a child (WL, MD only, or Admin)
router.post('/assign', rateController.assignRate);

// Bulk assign rates
router.post('/bulk-assign', rateController.bulkAssignRates);

// Toggle PG for a child
router.patch('/toggle/:targetUserId/:pgId', rateController.togglePGForUser);

// Get rate for a specific user (Admin or parent access)
router.get('/user/:userId/pg/:pgId', rateController.getUserRate);

// Get user's channel rates for a PG
router.get('/user/:userId/channels/:pgId', rateController.getUserChannelRates);

// Update single channel rate
router.put('/user/:userId/channel/:channelId', rateController.updateChannelRate);

// Bulk update channel rates
router.put('/user/:userId/channels', rateController.bulkUpdateChannelRates);

export default router;
