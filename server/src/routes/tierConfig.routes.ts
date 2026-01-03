import { Router } from 'express';
import tierConfigController from '../controllers/tierConfig.controller';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all tier configurations (admin and above)
router.get('/', requireAdmin, tierConfigController.getTierConfigs);

// Create new tier configuration (super admin only)
router.post('/', requireSuperAdmin, tierConfigController.createTierConfig);

// Reset tier configurations to defaults (super admin only)
// This must be before /:code to avoid matching "reset" as a code
router.post('/reset', requireSuperAdmin, tierConfigController.resetTierConfigs);

// Reorder tiers (super admin only)
router.post('/reorder', requireSuperAdmin, tierConfigController.reorderTiers);

// Get single tier configuration
router.get('/:code', requireAdmin, tierConfigController.getTierConfig);

// Get features for a tier
router.get('/:code/features', requireAdmin, tierConfigController.getTierFeatures);

// Update tier configuration (super admin only)
router.put('/:code', requireSuperAdmin, tierConfigController.updateTierConfig);

// Delete tier permanently (super admin only)
router.delete('/:code', requireSuperAdmin, tierConfigController.deleteTierConfig);

// Archive tier (soft delete) - super admin only
router.post('/:code/archive', requireSuperAdmin, tierConfigController.archiveTierConfig);

// Restore archived tier - super admin only
router.post('/:code/restore', requireSuperAdmin, tierConfigController.restoreTierConfig);

// Update tier features (enable/disable individual features)
router.put('/:code/features', requireSuperAdmin, tierConfigController.updateTierFeatures);

// Sync tier features (bulk update - replace all)
router.post('/:code/features/sync', requireSuperAdmin, tierConfigController.syncTierFeatures);

export default router;
