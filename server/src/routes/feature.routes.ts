import { Router } from 'express';
import featureController from '../controllers/feature.controller';
import { authenticate } from '../middleware/auth';

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
router.post('/', featureController.createFeature);

// Update a feature
router.put('/:id', featureController.updateFeature);

// Archive a feature (soft delete)
router.post('/:id/archive', featureController.archiveFeature);

// Restore an archived feature
router.post('/:id/restore', featureController.restoreFeature);

// Permanently delete a feature
router.delete('/:id', featureController.deleteFeature);

export default router;
