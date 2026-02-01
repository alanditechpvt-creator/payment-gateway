import { Router } from 'express';
import { schemaController } from '../controllers/schema.controller';
import { authenticate, checkPermission, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Schema CRUD
router.post('/', checkPermission('canCreateSchema'), schemaController.createSchema);
router.get('/', schemaController.getSchemas);
router.get('/:schemaId', schemaController.getSchemaById);
router.patch('/:schemaId', checkPermission('canCreateSchema'), schemaController.updateSchema);
router.delete('/:schemaId', checkPermission('canCreateSchema'), schemaController.deleteSchema);

// Schema status
router.post('/:schemaId/toggle', checkPermission('canCreateSchema'), schemaController.toggleStatus);

// Schema PG rates
router.put('/:schemaId/rates', checkPermission('canCreateSchema'), schemaController.setPGRates);
router.post('/:schemaId/rates', checkPermission('canCreateSchema'), schemaController.addPGRate);
router.delete('/:schemaId/rates/:pgId', checkPermission('canCreateSchema'), schemaController.removePGRate);

// Payout Slab Management (Admin Only)
router.get('/pg-rate/:schemaPGRateId/payout-slabs', authorize('ADMIN'), schemaController.getPayoutSlabs);
router.put('/pg-rate/:schemaPGRateId/payout-slabs', authorize('ADMIN'), schemaController.setPayoutSlabs);
router.post('/pg-rate/:schemaPGRateId/payout-slab', authorize('ADMIN'), schemaController.upsertPayoutSlab);
router.delete('/payout-slab/:slabId', authorize('ADMIN'), schemaController.deletePayoutSlab);
router.put('/pg-rate/:schemaPGRateId/payout-settings', authorize('ADMIN'), schemaController.updatePayoutSettings);

// Assign schema to user
router.post('/:schemaId/assign/:userId', schemaController.assignToUser);

export default router;

