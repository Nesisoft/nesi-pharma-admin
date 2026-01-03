import { Router } from 'express';
import tierConfigController from '../controllers/tierConfig.controller';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all tier configurations (admin and above)
router.get('/', requireAdmin, tierConfigController.getTierConfigs);

// Reset tier configurations to defaults (super admin only)
// This must be before /:tier to avoid matching "reset" as a tier
router.post('/reset', requireSuperAdmin, tierConfigController.resetTierConfigs);

// Get single tier configuration
router.get('/:tier', requireAdmin, tierConfigController.getTierConfig);

// Get features for a tier
router.get('/:tier/features', requireAdmin, tierConfigController.getTierFeatures);

// Update tier configuration (super admin only)
router.put('/:tier', requireSuperAdmin, tierConfigController.updateTierConfig);

// Archive tier (soft delete) - super admin only
router.post('/:tier/archive', requireSuperAdmin, tierConfigController.archiveTierConfig);

// Restore archived tier - super admin only
router.post('/:tier/restore', requireSuperAdmin, tierConfigController.restoreTierConfig);

// Update tier features (enable/disable individual features)
router.put('/:tier/features', requireSuperAdmin, tierConfigController.updateTierFeatures);

// Sync tier features (bulk update - replace all)
router.post('/:tier/features/sync', requireSuperAdmin, tierConfigController.syncTierFeatures);

export default router;
