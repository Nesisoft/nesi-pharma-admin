import { PrismaClient, AdminRole, LicenseTier } from '@prisma/client';
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

  // Advanced features
  { key: 'advancedReporting', name: 'Advanced Reporting', description: 'Detailed analytics and reports', category: 'reporting' },
  { key: 'auditLog', name: 'Audit Log', description: 'Track all system changes', category: 'system' },
  { key: 'expiryTracking', name: 'Expiry Tracking', description: 'Track product expiration dates', category: 'inventory' },
  { key: 'lowStockAlerts', name: 'Low Stock Alerts', description: 'Notifications for low inventory', category: 'inventory' },
  { key: 'purchaseOrders', name: 'Purchase Orders', description: 'Create and manage purchase orders', category: 'inventory' },
  { key: 'salesReturns', name: 'Sales Returns', description: 'Process customer returns', category: 'sales' },
  { key: 'discounts', name: 'Discounts', description: 'Apply discounts to sales', category: 'sales' },
  { key: 'creditSales', name: 'Credit Sales', description: 'Allow sales on credit', category: 'sales' },
  { key: 'multiPayment', name: 'Multi-Payment', description: 'Accept multiple payment methods', category: 'sales' },

  // Enterprise features
  { key: 'multiBranch', name: 'Multi-Branch', description: 'Support for multiple locations', category: 'enterprise' },
  { key: 'branchTransfers', name: 'Branch Transfers', description: 'Transfer stock between branches', category: 'enterprise' },
  { key: 'apiAccess', name: 'API Access', description: 'External API integration', category: 'enterprise' },
  { key: 'customReports', name: 'Custom Reports', description: 'Create custom report templates', category: 'reporting' },
  { key: 'dataExport', name: 'Data Export', description: 'Export data to various formats', category: 'reporting' },
  { key: 'roleManagement', name: 'Role Management', description: 'Custom user roles and permissions', category: 'system' },
  { key: 'backupRestore', name: 'Backup & Restore', description: 'Database backup and restore', category: 'system' },
  { key: 'prioritySupport', name: 'Priority Support', description: '24/7 priority customer support', category: 'support' },
];

// Define which features are enabled for each tier
const tierFeatureMapping: Record<LicenseTier, string[]> = {
  [LicenseTier.BASIC]: [
    'stockAdjustments',
    'lowStockAlerts',
    'expiryTracking',
  ],
  [LicenseTier.STANDARD]: [
    'stockAdjustments',
    'customers',
    'prescriptions',
    'suppliers',
    'barcodeScanning',
    'multiUser',
    'expiryTracking',
    'lowStockAlerts',
    'purchaseOrders',
    'salesReturns',
    'discounts',
    'creditSales',
    'multiPayment',
  ],
  [LicenseTier.PROFESSIONAL]: [
    'stockAdjustments',
    'customers',
    'prescriptions',
    'suppliers',
    'barcodeScanning',
    'multiUser',
    'advancedReporting',
    'auditLog',
    'expiryTracking',
    'lowStockAlerts',
    'purchaseOrders',
    'salesReturns',
    'discounts',
    'creditSales',
    'multiPayment',
    'multiBranch',
    'branchTransfers',
    'customReports',
    'dataExport',
    'roleManagement',
    'backupRestore',
  ],
  [LicenseTier.ENTERPRISE]: [
    // All features enabled
    'stockAdjustments',
    'customers',
    'prescriptions',
    'suppliers',
    'barcodeScanning',
    'multiUser',
    'advancedReporting',
    'auditLog',
    'expiryTracking',
    'lowStockAlerts',
    'purchaseOrders',
    'salesReturns',
    'discounts',
    'creditSales',
    'multiPayment',
    'multiBranch',
    'branchTransfers',
    'apiAccess',
    'customReports',
    'dataExport',
    'roleManagement',
    'backupRestore',
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
      tier: LicenseTier.BASIC,
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
    },
    {
      tier: LicenseTier.STANDARD,
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
    },
    {
      tier: LicenseTier.PROFESSIONAL,
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
    },
    {
      tier: LicenseTier.ENTERPRISE,
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
    },
  ];

  console.log('Creating tier configurations...');
  const tierIdMap: Record<LicenseTier, string> = {} as Record<LicenseTier, string>;

  for (const config of tierConfigs) {
    const existing = await prisma.licenseTierConfig.findUnique({
      where: { tier: config.tier },
    });

    if (!existing) {
      const tierConfig = await prisma.licenseTierConfig.create({
        data: config,
      });
      tierIdMap[config.tier] = tierConfig.id;
      console.log(`  Created tier config: ${config.name}`);
    } else {
      const tierConfig = await prisma.licenseTierConfig.update({
        where: { tier: config.tier },
        data: config,
      });
      tierIdMap[config.tier] = tierConfig.id;
      console.log(`  Updated tier config: ${config.name}`);
    }
  }

  // Create tier-feature associations
  console.log('Creating tier-feature associations...');

  for (const tier of Object.values(LicenseTier)) {
    const tierId = tierIdMap[tier];
    const enabledFeatures = tierFeatureMapping[tier];

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

    console.log(`  Configured ${enabledFeatures.length} features for ${tier} tier`);
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
