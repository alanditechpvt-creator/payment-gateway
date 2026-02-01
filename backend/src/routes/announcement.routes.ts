/**
 * Announcement Routes
 * 
 * API endpoints for broadcast announcements/news ticker
 */

import { Router } from 'express';
import { announcementController } from '../controllers/announcement.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// User route - get active announcements for current user (news ticker)
router.get('/active', announcementController.getActiveForMe);

// Admin routes
router.get('/', authorize('ADMIN'), announcementController.getAll);
router.get('/stats', authorize('ADMIN'), announcementController.getStats);
router.get('/:id', authorize('ADMIN'), announcementController.getById);
router.post('/', authorize('ADMIN'), announcementController.create);
router.patch('/:id', authorize('ADMIN'), announcementController.update);
router.post('/:id/toggle', authorize('ADMIN'), announcementController.toggle);
router.delete('/:id', authorize('ADMIN'), announcementController.delete);

export default router;

