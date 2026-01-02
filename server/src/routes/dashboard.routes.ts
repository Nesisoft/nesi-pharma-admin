import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { authenticate, requireSupport } from '../middleware/auth';

const router = Router();

// All routes require authentication and at least support role
router.use(authenticate);
router.use(requireSupport);

// Dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);
router.get('/recent-activity', dashboardController.getRecentActivity);
router.get('/license-trends', dashboardController.getLicenseTrends);
router.get('/activation-trends', dashboardController.getActivationTrends);

export default router;
