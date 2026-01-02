import { PrismaClient, AdminRole, LicenseTier } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

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
    console.log(`✅ Created super admin user: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Super admin already exists: ${adminEmail}`);
  }

  // Create license tier configurations
  const tierConfigs = [
    {
      tier: LicenseTier.BASIC,
      name: 'Basic',
      description: 'Free tier with essential features for small pharmacies',
      price: 0,
      currency: 'GHS',
      durationDays: 0, // Unlimited for free tier
      features: {
        maxUsers: 1,
        maxProducts: 100,
        salesTracking: true,
        inventoryManagement: true,
        basicReports: true,
        advancedAnalytics: false,
        multiLocation: false,
        apiAccess: false,
        prioritySupport: false,
      },
      maxUsers: 1,
      maxProducts: 100,
      maxTransactions: null,
    },
    {
      tier: LicenseTier.STANDARD,
      name: 'Standard',
      description: 'Enhanced features for growing pharmacies',
      price: 500,
      currency: 'GHS',
      durationDays: 365,
      features: {
        maxUsers: 3,
        maxProducts: 500,
        salesTracking: true,
        inventoryManagement: true,
        basicReports: true,
        advancedAnalytics: true,
        multiLocation: false,
        apiAccess: false,
        prioritySupport: false,
        prescriptionManagement: true,
        customerManagement: true,
        expiryAlerts: true,
      },
      maxUsers: 3,
      maxProducts: 500,
      maxTransactions: null,
    },
    {
      tier: LicenseTier.PROFESSIONAL,
      name: 'Professional',
      description: 'Advanced features for established pharmacies',
      price: 1200,
      currency: 'GHS',
      durationDays: 365,
      features: {
        maxUsers: 10,
        maxProducts: 2000,
        salesTracking: true,
        inventoryManagement: true,
        basicReports: true,
        advancedAnalytics: true,
        multiLocation: true,
        maxLocations: 3,
        apiAccess: true,
        prioritySupport: true,
        prescriptionManagement: true,
        customerManagement: true,
        expiryAlerts: true,
        purchaseOrders: true,
        supplierManagement: true,
        cashReconciliation: true,
      },
      maxUsers: 10,
      maxProducts: 2000,
      maxTransactions: null,
    },
    {
      tier: LicenseTier.ENTERPRISE,
      name: 'Enterprise',
      description: 'Full-featured solution for pharmacy chains',
      price: 3000,
      currency: 'GHS',
      durationDays: 365,
      features: {
        maxUsers: -1, // Unlimited
        maxProducts: -1,
        salesTracking: true,
        inventoryManagement: true,
        basicReports: true,
        advancedAnalytics: true,
        multiLocation: true,
        maxLocations: -1,
        apiAccess: true,
        prioritySupport: true,
        dedicatedSupport: true,
        prescriptionManagement: true,
        customerManagement: true,
        expiryAlerts: true,
        purchaseOrders: true,
        supplierManagement: true,
        cashReconciliation: true,
        customIntegrations: true,
        whiteLabeling: true,
        auditTrail: true,
      },
      maxUsers: null, // Unlimited
      maxProducts: null,
      maxTransactions: null,
    },
  ];

  for (const config of tierConfigs) {
    const existing = await prisma.licenseTierConfig.findUnique({
      where: { tier: config.tier },
    });

    if (!existing) {
      await prisma.licenseTierConfig.create({
        data: config,
      });
      console.log(`✅ Created tier config: ${config.name}`);
    } else {
      await prisma.licenseTierConfig.update({
        where: { tier: config.tier },
        data: config,
      });
      console.log(`✅ Updated tier config: ${config.name}`);
    }
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

  for (const setting of systemSettings) {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: setting.key },
    });

    if (!existing) {
      await prisma.systemSetting.create({
        data: setting,
      });
      console.log(`✅ Created system setting: ${setting.key}`);
    }
  }

  console.log('');
  console.log('🎉 Database seed completed!');
  console.log('');
  console.log('📋 Default Admin Credentials:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log('');
  console.log('⚠️  Please change the default password after first login!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
