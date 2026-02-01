import { Router } from 'express';
import multer from 'multer';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize, checkPermission } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.path);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Onboarding routes (public)
router.get('/onboarding/:token', userController.getOnboardingInfo);
router.post(
  '/onboarding/:token',
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
  ]),
  userController.completeOnboarding
);
router.post('/onboarding/:token/send-otp', userController.sendOnboardingOTP);
router.post('/onboarding/:token/verify-otp', userController.verifyOnboardingOTP);

// Protected routes
router.use(authenticate);

// User CRUD
router.post('/', checkPermission('canCreateUsers'), userController.createUser);
router.get('/', userController.getUsers);
router.get('/:userId', userController.getUserById);
router.patch('/:userId', userController.updateUser);

// User approval
router.post('/:userId/approve', checkPermission('canApproveUsers'), userController.approveUser);

// User status management
router.post('/:userId/suspend', userController.suspendUser);
router.post('/:userId/reactivate', userController.reactivateUser);

// Permissions
router.put('/:userId/permissions', userController.updatePermissions);

// PG assignments
router.post('/:userId/pg', userController.assignPG);
router.delete('/:userId/pg/:pgId', userController.removePGAssignment);

// Get onboarding link (admin only)
router.get('/:userId/onboarding-link', userController.getOnboardingLink);

export default router;

