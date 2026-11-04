import { Router } from 'express';
import featureController from '../controllers/feature.controller';
import { authenticate, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all feature categories
router.get('/categories', featureController.getFeatureCategories);

// Get all features
router.get('/', featureController.getFeatures);

// Get a single feature
router.get('/:id', featureController.getFeature);

// Create a new feature
router.post('/', requireSuperAdmin, featureController.createFeature);

// Update a feature
router.put('/:id', requireSuperAdmin, featureController.updateFeature);

// Archive a feature (soft delete)
router.post('/:id/archive', requireSuperAdmin, featureController.archiveFeature);

// Restore an archived feature
router.post('/:id/restore', requireSuperAdmin, featureController.restoreFeature);

// Permanently delete a feature
router.delete('/:id', requireSuperAdmin, featureController.deleteFeature);

export default router;
