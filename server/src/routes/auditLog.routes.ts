import { Router } from 'express';
import auditLogController from '../controllers/auditLog.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Get audit logs
router.get('/', auditLogController.getAuditLogs);
router.get('/stats', auditLogController.getAuditStats);
router.get('/:entityType/:entityId', auditLogController.getEntityAuditLogs);

export default router;
