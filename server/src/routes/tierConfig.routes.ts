import { Router } from 'express';
import tierConfigController from '../controllers/tierConfig.controller';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all tier configurations (admin and above)
router.get('/', requireAdmin, tierConfigController.getTierConfigs);

// Get single tier configuration
router.get('/:tier', requireAdmin, tierConfigController.getTierConfig);

// Update tier configuration (super admin only)
router.put('/:tier', requireSuperAdmin, tierConfigController.updateTierConfig);

// Reset tier configurations to defaults (super admin only)
router.post('/reset', requireSuperAdmin, tierConfigController.resetTierConfigs);

export default router;
