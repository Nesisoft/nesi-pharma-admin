import { Router } from 'express';
import pharmacyController from '../controllers/pharmacy.controller';
import { authenticate, requireSupport, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get pharmacy statistics
router.get('/stats', requireSupport, pharmacyController.getPharmacyStats);

// List and get pharmacies
router.get('/', requireSupport, pharmacyController.getPharmacies);
router.get('/:id', requireSupport, pharmacyController.getPharmacy);

// Create pharmacy (admin only)
router.post('/', requireAdmin, pharmacyController.createPharmacy);

// Update pharmacy (admin only)
router.put('/:id', requireAdmin, pharmacyController.updatePharmacy);

// Suspend/activate pharmacy (admin only)
router.post('/:id/suspend', requireAdmin, pharmacyController.suspendPharmacy);
router.post('/:id/activate', requireAdmin, pharmacyController.activatePharmacy);

// Delete pharmacy (admin only)
router.delete('/:id', requireAdmin, pharmacyController.deletePharmacy);

export default router;
