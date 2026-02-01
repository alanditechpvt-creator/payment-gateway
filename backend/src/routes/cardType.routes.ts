import { Router } from 'express';
import { cardTypeController } from '../controllers/cardType.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ==================== CARD TYPE CRUD (Admin Only) ====================

// Get all card types
router.get('/', cardTypeController.getAllCardTypes);

// Get card types for a specific PG
router.get('/pg/:pgId', cardTypeController.getCardTypesByPG);

// Get single card type
router.get('/:cardTypeId', cardTypeController.getCardTypeById);

// Create card type (Admin only)
router.post('/', authorize('ADMIN'), cardTypeController.createCardType);

// Update card type (Admin only)
router.patch('/:cardTypeId', authorize('ADMIN'), cardTypeController.updateCardType);

// Toggle card type status (Admin only)
router.post('/:cardTypeId/toggle', authorize('ADMIN'), cardTypeController.toggleCardTypeStatus);

// Delete card type (Admin only)
router.delete('/:cardTypeId', authorize('ADMIN'), cardTypeController.deleteCardType);

// ==================== SCHEMA CARD TYPE RATES (Admin Only) ====================

// Get schema card type rates
router.get('/schema/:schemaId/rates', cardTypeController.getSchemaCardTypeRates);

// Set schema card type rate
router.post('/schema/:schemaId/rate/:cardTypeId', authorize('ADMIN'), cardTypeController.setSchemaCardTypeRate);

// Bulk set schema card type rates
router.put('/schema/:schemaId/rates', authorize('ADMIN'), cardTypeController.bulkSetSchemaCardTypeRates);

// ==================== USER CARD TYPE RATES ====================

// Get my card type rates
router.get('/my-rates', cardTypeController.getMyCardTypeRates);

// Get rates I assigned to children
router.get('/assigned-by-me', authorize(['ADMIN', 'WHITE_LABEL', 'MASTER_DISTRIBUTOR']), cardTypeController.getCardTypeRatesAssignedByMe);

// Get user's card type rates
router.get('/user/:userId/rates', cardTypeController.getUserCardTypeRates);

// Assign card type rate to user
router.post('/user/:userId/rate/:cardTypeId', authorize(['ADMIN', 'WHITE_LABEL', 'MASTER_DISTRIBUTOR']), cardTypeController.assignUserCardTypeRate);

// ==================== RATE LOOKUP ====================

// Get effective rate for a transaction
router.get('/rate/:pgId', cardTypeController.getTransactionRate);

export default router;

