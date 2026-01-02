import { Router } from 'express';
import licenseController from '../controllers/license.controller';
import { authenticate, requireSupport, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get license statistics
router.get('/stats', requireSupport, licenseController.getLicenseStats);

// List and get licenses
router.get('/', requireSupport, licenseController.getLicenses);
router.get('/:id', requireSupport, licenseController.getLicense);

// Generate licenses (admin only)
router.post('/generate', requireAdmin, licenseController.generateLicense);
router.post('/generate-bulk', requireAdmin, licenseController.generateBulkLicenses);

// Update and manage licenses (admin only)
router.put('/:id', requireAdmin, licenseController.updateLicense);
router.post('/:id/revoke', requireAdmin, licenseController.revokeLicense);
router.delete('/:id', requireAdmin, licenseController.deleteLicense);

export default router;
