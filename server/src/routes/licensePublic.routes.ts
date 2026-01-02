import { Router } from 'express';
import licensePublicController from '../controllers/licensePublic.controller';

const router = Router();

// Public endpoints for the pharmacy app to use

// Verify a license key
router.post('/verify', licensePublicController.verifyLicense);

// Activate a license key
router.post('/activate', licensePublicController.activateLicense);

// Deactivate a license key
router.post('/deactivate', licensePublicController.deactivateLicense);

// Get tier features/pricing info
router.get('/tiers', licensePublicController.getTierFeatures);

export default router;
