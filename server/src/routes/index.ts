import { Router } from 'express';
import authRoutes from './auth.routes';
import licenseRoutes from './license.routes';
import licensePublicRoutes from './licensePublic.routes';
import pharmacyRoutes from './pharmacy.routes';
import adminUserRoutes from './adminUser.routes';
import dashboardRoutes from './dashboard.routes';
import auditLogRoutes from './auditLog.routes';
import tierConfigRoutes from './tierConfig.routes';

const router = Router();

// Health check
router.get('/health', (_, res) => {
  res.json({
    success: true,
    message: 'NesiPharma Admin API is running',
    timestamp: new Date().toISOString(),
  });
});

// API version info
router.get('/', (_, res) => {
  res.json({
    success: true,
    name: 'NesiPharma Admin API',
    version: '1.0.0',
    description: 'Admin dashboard API for NesiPharma license management',
    endpoints: {
      auth: '/api/auth',
      licenses: '/api/licenses',
      'license-verification': '/api/public/license',
      pharmacies: '/api/pharmacies',
      'admin-users': '/api/admin-users',
      dashboard: '/api/dashboard',
      'audit-logs': '/api/audit-logs',
      'tier-configs': '/api/tier-configs',
    },
  });
});

// Auth routes
router.use('/auth', authRoutes);

// License management routes (admin)
router.use('/licenses', licenseRoutes);

// Public license verification routes (for pharmacy app)
router.use('/public/license', licensePublicRoutes);

// Pharmacy management routes
router.use('/pharmacies', pharmacyRoutes);

// Admin user management routes
router.use('/admin-users', adminUserRoutes);

// Dashboard routes
router.use('/dashboard', dashboardRoutes);

// Audit log routes
router.use('/audit-logs', auditLogRoutes);

// Tier configuration routes
router.use('/tier-configs', tierConfigRoutes);

export default router;
