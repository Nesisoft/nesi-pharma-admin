import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Define all features with their categories
const featureDefinitions = [
  // Core features
  { key: 'stockAdjustments', name: 'Stock Adjustments', description: 'Adjust inventory stock levels', category: 'inventory' },
  { key: 'customers', name: 'Customer Management', description: 'Manage customer records and history', category: 'sales' },
  { key: 'prescriptions', name: 'Prescription Management', description: 'Handle and track prescriptions', category: 'pharmacy' },
  { key: 'suppliers', name: 'Supplier Management', description: 'Manage supplier relationships', category: 'inventory' },
  { key: 'barcodeScanning', name: 'Barcode Scanning', description: 'Scan barcodes for products', category: 'sales' },
  { key: 'multiUser', name: 'Multi-User Support', description: 'Support for multiple user accounts', category: 'system' },

  // Standard features
  { key: 'cartHolding', name: 'Cart Holding', description: 'Hold/park cart during sales for later', category: 'sales' },
  { key: 'cashReconciliation', name: 'Cash Reconciliation', description: 'End-of-day cash drawer reconciliation', category: 'sales' },
  { key: 'expiryAlerts', name: 'Expiry Alerts', description: 'Notifications for expiring products', category: 'inventory' },
  { key: 'expiryTracking', name: 'Expiry Tracking', description: 'Track product expiration dates', category: 'inventory' },
  { key: 'lowStockAlerts', name: 'Low Stock Alerts', description: 'Notifications for low inventory', category: 'inventory' },
  { key: 'dashboardAnalytics', name: 'Dashboard Analytics', description: 'Dashboard statistics and charts', category: 'reporting' },
  { key: 'salesRefund', name: 'Sales Refund', description: 'Process customer refunds', category: 'sales' },
  { key: 'salesReturns', name: 'Sales Returns', description: 'Process customer returns', category: 'sales' },
  { key: 'discounts', name: 'Discounts', description: 'Apply discounts to sales', category: 'sales' },
  { key: 'creditSales', name: 'Credit Sales', description: 'Allow sales on credit', category: 'sales' },
  { key: 'multiPayment', name: 'Multi-Payment', description: 'Accept multiple payment methods', category: 'sales' },
  { key: 'purchaseOrders', name: 'Purchase Orders', description: 'Create and manage purchase orders', category: 'inventory' },

  // Professional features
  { key: 'advancedReporting', name: 'Advanced Reporting', description: 'Detailed analytics and reports', category: 'reporting' },
  { key: 'auditLog', name: 'Audit Log', description: 'Track all system changes', category: 'system' },
  { key: 'fefoRecommendations', name: 'FEFO Recommendations', description: 'First-Expired-First-Out product suggestions', category: 'inventory' },
  { key: 'inventoryReports', name: 'Inventory Reports', description: 'Detailed inventory-specific reports', category: 'reporting' },
  { key: 'goodsReceiving', name: 'Goods Receiving', description: 'Receive and verify goods from suppliers', category: 'inventory' },
  { key: 'supplierInvoicing', name: 'Supplier Invoicing', description: 'Manage and track supplier invoices', category: 'inventory' },
  { key: 'notifications', name: 'Notifications', description: 'Push and email notifications', category: 'system' },
  { key: 'periodComparison', name: 'Period Comparison', description: 'Compare sales and metrics across periods', category: 'reporting' },
  { key: 'salesAnalytics', name: 'Sales Analytics', description: 'Detailed sales analytics and insights', category: 'reporting' },
  { key: 'customReports', name: 'Custom Reports', description: 'Create custom report templates', category: 'reporting' },
  { key: 'dataExport', name: 'Data Export', description: 'Export data to various formats', category: 'reporting' },
  { key: 'roleManagement', name: 'Role Management', description: 'Custom user roles and permissions', category: 'system' },
  { key: 'backupRestore', name: 'Backup & Restore', description: 'Database backup and restore', category: 'system' },

  // Enterprise features
  { key: 'multiBranch', name: 'Multi-Branch', description: 'Support for multiple locations', category: 'enterprise' },
  { key: 'branchTransfers', name: 'Branch Transfers', description: 'Transfer stock between branches', category: 'enterprise' },
  { key: 'apiAccess', name: 'API Access', description: 'External API integration', category: 'enterprise' },
  { key: 'prioritySupport', name: 'Priority Support', description: '24/7 priority customer support', category: 'support' },
];

// Define which features are enabled for each tier (by code)
const tierFeatureMapping: Record<string, string[]> = {
  BASIC: [
    'stockAdjustments',
    'lowStockAlerts',
    'expiryTracking',
    'expiryAlerts',
  ],
  STANDARD: [
    'stockAdjustments',
    'customers',
    'prescriptions',
    'suppliers',
    'barcodeScanning',
    'multiUser',
    'cartHolding',
    'cashReconciliation',
    'expiryTracking',
    'expiryAlerts',
    'lowStockAlerts',
    'dashboardAnalytics',
    'salesRefund',
    'salesReturns',
    'discounts',
    'creditSales',
    'multiPayment',
    'purchaseOrders',
  ],
  PROFESSIONAL: [
    'stockAdjustments',
    'customers',
    'prescriptions',
    'suppliers',
    'barcodeScanning',
    'multiUser',
    'cartHolding',
    'cashReconciliation',
    'expiryTracking',
    'expiryAlerts',
    'lowStockAlerts',
    'dashboardAnalytics',
    'salesRefund',
    'salesReturns',
    'discounts',
    'creditSales',
    'multiPayment',
    'purchaseOrders',
    'advancedReporting',
    'auditLog',
    'fefoRecommendations',
    'inventoryReports',
    'goodsReceiving',
    'supplierInvoicing',
    'notifications',
    'periodComparison',
    'salesAnalytics',
    'customReports',
    'dataExport',
    'roleManagement',
    'backupRestore',
    'multiBranch',
    'branchTransfers',
  ],
  ENTERPRISE: [
    // All features enabled
    'stockAdjustments',
    'customers',
    'prescriptions',
    'suppliers',
    'barcodeScanning',
    'multiUser',
    'cartHolding',
    'cashReconciliation',
    'expiryTracking',
    'expiryAlerts',
    'lowStockAlerts',
    'dashboardAnalytics',
    'salesRefund',
    'salesReturns',
    'discounts',
    'creditSales',
    'multiPayment',
    'purchaseOrders',
    'advancedReporting',
    'auditLog',
    'fefoRecommendations',
    'inventoryReports',
    'goodsReceiving',
    'supplierInvoicing',
    'notifications',
    'periodComparison',
    'salesAnalytics',
    'customReports',
    'dataExport',
    'roleManagement',
    'backupRestore',
    'multiBranch',
    'branchTransfers',
    'apiAccess',
    'prioritySupport',
  ],
};

async function main() {
  console.log('Starting database seed...');

  // Create default super admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@nesipharma.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const adminFirstName = process.env.ADMIN_FIRST_NAME || 'System';
  const adminLastName = process.env.ADMIN_LAST_NAME || 'Administrator';

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log(`Created super admin user: ${adminEmail}`);
  } else {
    console.log(`Super admin already exists: ${adminEmail}`);
  }

  // Create features
  console.log('Creating features...');
  const featureMap: Record<string, string> = {}; // key -> id mapping

  for (const featureDef of featureDefinitions) {
    const existing = await prisma.feature.findUnique({
      where: { key: featureDef.key },
    });

    if (!existing) {
      const feature = await prisma.feature.create({
        data: featureDef,
      });
      featureMap[feature.key] = feature.id;
      console.log(`  Created feature: ${featureDef.name}`);
    } else {
      // Update existing feature
      const feature = await prisma.feature.update({
        where: { key: featureDef.key },
        data: {
          name: featureDef.name,
          description: featureDef.description,
          category: featureDef.category,
        },
      });
      featureMap[feature.key] = feature.id;
      console.log(`  Updated feature: ${featureDef.name}`);
    }
  }

  // Create license tier configurations
  // Tier limits:
  // - Basic: 1 branch, 1 user, 500 products
  // - Standard: 1 branch, 3 users, 5000 products
  // - Professional: 3 branches, 10 users, unlimited products
  // - Enterprise: unlimited everything
  const tierConfigs = [
    {
      code: 'BASIC',
      name: 'Basic',
      description: 'Free tier with essential features for small pharmacies',
      price: 0,
      currency: 'GHS',
      durationDays: 0, // Unlimited for free tier
      maxUsers: 1,
      maxProducts: 500,
      maxTransactions: null,
      maxBranches: 1,
      maxActivations: 1,
      isDefault: true,
      displayOrder: 0,
      color: '#6B7280', // Gray
    },
    {
      code: 'STANDARD',
      name: 'Standard',
      description: 'Enhanced features for growing pharmacies - 1 branch, up to 3 users',
      price: 500,
      currency: 'GHS',
      durationDays: 365,
      maxUsers: 3,
      maxProducts: 5000,
      maxTransactions: null,
      maxBranches: 1,
      maxActivations: 3,
      isDefault: true,
      displayOrder: 1,
      color: '#3B82F6', // Blue
    },
    {
      code: 'PROFESSIONAL',
      name: 'Professional',
      description: 'Advanced features for established pharmacies - 3 branches, up to 10 users',
      price: 1200,
      currency: 'GHS',
      durationDays: 365,
      maxUsers: 10,
      maxProducts: null, // Unlimited
      maxTransactions: null,
      maxBranches: 3,
      maxActivations: 9,
      isDefault: true,
      displayOrder: 2,
      color: '#10B981', // Green
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Full-featured solution for pharmacy chains - unlimited branches and users',
      price: 3000,
      currency: 'GHS',
      durationDays: 365,
      maxUsers: null, // Unlimited
      maxProducts: null,
      maxTransactions: null,
      maxBranches: null, // Unlimited
      maxActivations: null, // Unlimited
      isDefault: true,
      displayOrder: 3,
      color: '#8B5CF6', // Purple
    },
  ];

  console.log('Creating tier configurations...');
  const tierIdMap: Record<string, string> = {};

  for (const config of tierConfigs) {
    const existing = await prisma.licenseTierConfig.findUnique({
      where: { code: config.code },
    });

    if (!existing) {
      const tierConfig = await prisma.licenseTierConfig.create({
        data: config,
      });
      tierIdMap[config.code] = tierConfig.id;
      console.log(`  Created tier config: ${config.name}`);
    } else {
      const tierConfig = await prisma.licenseTierConfig.update({
        where: { code: config.code },
        data: config,
      });
      tierIdMap[config.code] = tierConfig.id;
      console.log(`  Updated tier config: ${config.name}`);
    }
  }

  // Create tier-feature associations
  console.log('Creating tier-feature associations...');

  for (const tierCode of Object.keys(tierIdMap)) {
    const tierId = tierIdMap[tierCode];
    const enabledFeatures = tierFeatureMapping[tierCode] || [];

    // Delete existing tier features for this tier
    await prisma.tierFeature.deleteMany({
      where: { tierId },
    });

    // Create new tier features
    for (const featureKey of Object.keys(featureMap)) {
      const featureId = featureMap[featureKey];
      const isEnabled = enabledFeatures.includes(featureKey);

      await prisma.tierFeature.create({
        data: {
          tierId,
          featureId,
          isEnabled,
        },
      });
    }

    console.log(`  Configured ${enabledFeatures.length} features for ${tierCode} tier`);
  }

  // Create some default system settings
  const systemSettings = [
    {
      key: 'license_grace_period_days',
      value: '7',
      description: 'Grace period (in days) after license expiration before features are disabled',
    },
    {
      key: 'max_failed_verifications',
      value: '5',
      description: 'Maximum failed verification attempts before temporary lockout',
    },
    {
      key: 'verification_lockout_minutes',
      value: '30',
      description: 'Lockout duration (in minutes) after max failed verifications',
    },
    {
      key: 'license_reminder_days',
      value: '30,14,7,1',
      description: 'Days before expiration to send reminder emails',
    },
  ];

  console.log('Creating system settings...');
  for (const setting of systemSettings) {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: setting.key },
    });

    if (!existing) {
      await prisma.systemSetting.create({
        data: setting,
      });
      console.log(`  Created system setting: ${setting.key}`);
    }
  }

  console.log('');
  console.log('Database seed completed!');
  console.log('');
  console.log('Default Admin Credentials:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log('');
  console.log('Please change the default password after first login!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
