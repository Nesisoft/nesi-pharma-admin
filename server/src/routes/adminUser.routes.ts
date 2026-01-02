import { Router } from 'express';
import adminUserController from '../controllers/adminUser.controller';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List and get admin users (admin only)
router.get('/', requireAdmin, adminUserController.getAdminUsers);
router.get('/:id', requireAdmin, adminUserController.getAdminUser);

// Create admin user (super admin only)
router.post('/', requireSuperAdmin, adminUserController.createAdminUser);

// Update admin user (admin for basic updates, super admin for role changes)
router.put('/:id', requireAdmin, adminUserController.updateAdminUser);

// Reset password (super admin only)
router.post('/:id/reset-password', requireSuperAdmin, adminUserController.resetPassword);

// Delete admin user (super admin only)
router.delete('/:id', requireSuperAdmin, adminUserController.deleteAdminUser);

export default router;
