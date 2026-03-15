import { Router } from 'express';
import multer from 'multer';
import { bbpsController } from '../controllers/bbps.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// In-memory upload for biller Excel/CSV (max 5MB)
const billerFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname) ||
      ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Only Excel (.xlsx, .xls) or CSV allowed'));
  },
});

router.use(authenticate);

router.get('/billers', bbpsController.getBillers);
router.post('/billers/import', billerFileUpload.single('file'), bbpsController.importBillers);
router.post('/billers/sync', bbpsController.syncBillers);
router.post('/billers/fetch-one', bbpsController.fetchOneBiller);
router.post('/fetch', bbpsController.fetchBill);
router.post('/pay', bbpsController.payBill);
router.post('/refresh/:billId', bbpsController.refreshBill);
router.get('/bills', bbpsController.getUserBills);

export default router;
