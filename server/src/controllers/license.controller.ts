import { Request, Response } from 'express';
import { LicenseTier, LicenseStatus, AuditAction } from '@prisma/client';
import prisma from '../lib/prisma';
import {
  generateLicenseKey,
  generateBulkLicenseKeys,
  validateLicenseKeyFormat,
  maskLicenseKey,
} from '../utils/licenseKey';
import {
  sendSuccess,
  sendPaginatedSuccess,
  sendError,
  sendNotFound,
} from '../utils/apiResponse';

/**
 * Get all licenses with pagination and filters
 */
export async function getLicenses(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const tier = req.query.tier as LicenseTier | undefined;
    const status = req.query.status as LicenseStatus | undefined;
    const search = req.query.search as string | undefined;
    const pharmacyId = req.query.pharmacyId as string | undefined;

    const where: Record<string, unknown> = {};

    if (tier) where.tier = tier;
    if (status) where.status = status;
    if (pharmacyId) where.pharmacyId = pharmacyId;
    if (search) {
      where.OR = [
        { licenseKey: { contains: search, mode: 'insensitive' } },
        { pharmacy: { name: { contains: search, mode: 'insensitive' } } },
        { pharmacy: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          pharmacy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          generatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { activations: true },
          },
        },
      }),
      prisma.license.count({ where }),
    ]);

    sendPaginatedSuccess(res, licenses, page, limit, total);
  } catch (error) {
    console.error('Get licenses error:', error);
    sendError(res, 'Failed to fetch licenses', 500);
  }
}

/**
 * Get a single license by ID
 */
export async function getLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const license = await prisma.license.findUnique({
      where: { id },
      include: {
        pharmacy: true,
        generatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        activations: {
          orderBy: { activatedAt: 'desc' },
        },
        verifications: {
          orderBy: { verifiedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!license) {
      sendNotFound(res, 'License');
      return;
    }

    sendSuccess(res, license);
  } catch (error) {
    console.error('Get license error:', error);
    sendError(res, 'Failed to fetch license', 500);
  }
}

/**
 * Generate a new license key
 */
export async function generateLicense(req: Request, res: Response): Promise<void> {
  try {
    const {
      tier,
      tierCode,
      pharmacyId,
      durationDays,
      maxActivations,
      notes,
      features,
    } = req.body;

    // Use tierCode if provided, otherwise fall back to tier
    const selectedTierCode = tierCode || tier;

    if (!selectedTierCode) {
      sendError(res, 'Tier code is required', 400);
      return;
    }

    // Validate tier code exists and is not BASIC
    if (selectedTierCode === 'BASIC') {
      sendError(res, 'Cannot generate license for BASIC tier (free tier)', 400);
      return;
    }

    // Get tier configuration for defaults
    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code: selectedTierCode },
    });

    if (!tierConfig) {
      sendError(res, `Invalid tier code: ${selectedTierCode}`, 400);
      return;
    }

    // Use tier config defaults if not explicitly provided
    const licenseDurationDays = durationDays ?? tierConfig?.durationDays ?? 365;
    const licenseMaxActivations = maxActivations ?? tierConfig?.maxActivations ?? 1;

    // Determine the enum tier for backwards compatibility
    const enumTier = ['BASIC', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(selectedTierCode)
      ? selectedTierCode as LicenseTier
      : LicenseTier.BASIC; // Default for custom tiers

    // Generate unique license key
    let licenseKey = generateLicenseKey(selectedTierCode);
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existing = await prisma.license.findUnique({
        where: { licenseKey },
      });
      if (!existing) break;
      licenseKey = generateLicenseKey(selectedTierCode);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      sendError(res, 'Failed to generate unique license key', 500);
      return;
    }

    // Get features from database or fallback to defaults
    const licenseFeatures = features || await getTierFeaturesFromDb(selectedTierCode);

    // Create license
    const license = await prisma.license.create({
      data: {
        licenseKey,
        tier: enumTier,
        tierCode: selectedTierCode,
        status: LicenseStatus.INACTIVE,
        durationDays: licenseDurationDays,
        maxActivations: licenseMaxActivations,
        pharmacyId: pharmacyId || null,
        notes,
        features: licenseFeatures,
        generatedById: req.user?.id,
      },
      include: {
        pharmacy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.GENERATE,
        entityType: 'License',
        entityId: license.id,
        adminUserId: req.user?.id,
        description: `Generated ${selectedTierCode} license: ${maskLicenseKey(licenseKey)}`,
        newValue: { tier: selectedTierCode, licenseKey: maskLicenseKey(licenseKey) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, license, 'License generated successfully', 201);
  } catch (error) {
    console.error('Generate license error:', error);
    sendError(res, 'Failed to generate license', 500);
  }
}

/**
 * Generate multiple licenses at once
 */
export async function generateBulkLicenses(req: Request, res: Response): Promise<void> {
  try {
    const {
      tier,
      tierCode,
      count,
      durationDays,
      maxActivations,
      notes,
    } = req.body;

    // Use tierCode if provided, otherwise fall back to tier
    const selectedTierCode = tierCode || tier;

    if (!selectedTierCode) {
      sendError(res, 'Tier code is required', 400);
      return;
    }

    if (selectedTierCode === 'BASIC') {
      sendError(res, 'Cannot generate license for BASIC tier', 400);
      return;
    }

    const requestedCount = parseInt(count) || 1;
    if (requestedCount < 1 || requestedCount > 100) {
      sendError(res, 'Count must be between 1 and 100', 400);
      return;
    }

    // Get tier configuration for defaults
    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code: selectedTierCode },
    });

    if (!tierConfig) {
      sendError(res, `Invalid tier code: ${selectedTierCode}`, 400);
      return;
    }

    // Use tier config defaults if not explicitly provided
    const licenseDurationDays = durationDays ?? tierConfig?.durationDays ?? 365;
    const licenseMaxActivations = maxActivations ?? tierConfig?.maxActivations ?? 1;

    // Determine the enum tier for backwards compatibility
    const enumTier = ['BASIC', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(selectedTierCode)
      ? selectedTierCode as LicenseTier
      : LicenseTier.BASIC;

    // Generate unique keys
    const licenseKeys = generateBulkLicenseKeys(selectedTierCode, requestedCount);
    const features = await getTierFeaturesFromDb(selectedTierCode);

    // Create licenses
    const licenses = await Promise.all(
      licenseKeys.map((licenseKey) =>
        prisma.license.create({
          data: {
            licenseKey,
            tier: enumTier,
            tierCode: selectedTierCode,
            status: LicenseStatus.INACTIVE,
            durationDays: licenseDurationDays,
            maxActivations: licenseMaxActivations,
            notes,
            features,
            generatedById: req.user?.id,
          },
        })
      )
    );

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.GENERATE,
        entityType: 'License',
        adminUserId: req.user?.id,
        description: `Bulk generated ${requestedCount} ${selectedTierCode} licenses`,
        newValue: { tier: selectedTierCode, count: requestedCount },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(
      res,
      {
        count: licenses.length,
        licenses: licenses.map((l) => ({
          id: l.id,
          licenseKey: l.licenseKey,
          tier: l.tierCode || l.tier,
        })),
      },
      `Generated ${licenses.length} licenses`,
      201
    );
  } catch (error) {
    console.error('Bulk generate licenses error:', error);
    sendError(res, 'Failed to generate licenses', 500);
  }
}

/**
 * Update license details
 */
export async function updateLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, pharmacyId, durationDays, maxActivations, notes, features } = req.body;

    const existing = await prisma.license.findUnique({
      where: { id },
    });

    if (!existing) {
      sendNotFound(res, 'License');
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (status && Object.values(LicenseStatus).includes(status)) {
      updateData.status = status;
    }
    if (pharmacyId !== undefined) updateData.pharmacyId = pharmacyId || null;
    if (durationDays) updateData.durationDays = durationDays;
    if (maxActivations) updateData.maxActivations = maxActivations;
    if (notes !== undefined) updateData.notes = notes;
    if (features) updateData.features = features;

    const license = await prisma.license.update({
      where: { id },
      data: updateData,
      include: {
        pharmacy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'License',
        entityId: license.id,
        adminUserId: req.user?.id,
        description: `Updated license: ${maskLicenseKey(license.licenseKey)}`,
        previousValue: existing,
        newValue: updateData,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, license, 'License updated successfully');
  } catch (error) {
    console.error('Update license error:', error);
    sendError(res, 'Failed to update license', 500);
  }
}

/**
 * Revoke a license
 */
export async function revokeLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const license = await prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      sendNotFound(res, 'License');
      return;
    }

    if (license.status === LicenseStatus.REVOKED) {
      sendError(res, 'License is already revoked', 400);
      return;
    }

    const updated = await prisma.license.update({
      where: { id },
      data: {
        status: LicenseStatus.REVOKED,
        notes: reason ? `${license.notes || ''}\nRevoked: ${reason}`.trim() : license.notes,
      },
    });

    // Deactivate all activations
    await prisma.licenseActivation.updateMany({
      where: { licenseId: id, isActive: true },
      data: { isActive: false, deactivatedAt: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.REVOKE,
        entityType: 'License',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Revoked license: ${maskLicenseKey(license.licenseKey)}`,
        previousValue: { status: license.status },
        newValue: { status: LicenseStatus.REVOKED, reason },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, updated, 'License revoked successfully');
  } catch (error) {
    console.error('Revoke license error:', error);
    sendError(res, 'Failed to revoke license', 500);
  }
}

/**
 * Delete a license (soft delete by setting status)
 */
export async function deleteLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const license = await prisma.license.findUnique({
      where: { id },
      include: { _count: { select: { activations: true } } },
    });

    if (!license) {
      sendNotFound(res, 'License');
      return;
    }

    // Only allow deletion if never activated
    if (license._count.activations > 0) {
      sendError(res, 'Cannot delete license that has been activated. Revoke it instead.', 400);
      return;
    }

    await prisma.license.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.DELETE,
        entityType: 'License',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Deleted license: ${maskLicenseKey(license.licenseKey)}`,
        previousValue: { tier: license.tier, status: license.status },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, null, 'License deleted successfully');
  } catch (error) {
    console.error('Delete license error:', error);
    sendError(res, 'Failed to delete license', 500);
  }
}

/**
 * Get license statistics
 */
export async function getLicenseStats(req: Request, res: Response): Promise<void> {
  try {
    const [
      totalLicenses,
      byTier,
      byStatus,
      recentActivations,
      recentVerifications,
    ] = await Promise.all([
      prisma.license.count(),
      prisma.license.groupBy({
        by: ['tier'],
        _count: { id: true },
      }),
      prisma.license.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.licenseActivation.count({
        where: {
          activatedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
      prisma.licenseVerification.count({
        where: {
          verifiedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const tierStats = Object.fromEntries(
      byTier.map((t) => [t.tier, t._count.id])
    );

    const statusStats = Object.fromEntries(
      byStatus.map((s) => [s.status, s._count.id])
    );

    sendSuccess(res, {
      total: totalLicenses,
      byTier: tierStats,
      byStatus: statusStats,
      last30Days: {
        activations: recentActivations,
        verifications: recentVerifications,
      },
    });
  } catch (error) {
    console.error('Get license stats error:', error);
    sendError(res, 'Failed to fetch license statistics', 500);
  }
}

const BASE_FEATURES = {
  stockAdjustments: true,
};

const STANDARD_FEATURES = {
  barcodeScanning: true,
  multiUser: true,
  cartHolding: true,
  cashReconciliation: true,
  expiryAlerts: true,
  lowStockAlerts: true,
  dashboardAnalytics: true,
  salesRefund: true,
};

const PROFESSIONAL_FEATURES = {
  fefoRecommendations: true,
  inventoryReports: true,
  suppliers: true,
  purchaseOrders: true,
  goodsReceiving: true,
  supplierInvoicing: true,
  notifications: true,
  customers: true,
  prescriptions: true,
  periodComparison: true,
  salesAnalytics: true,
  backupRestore: true,
  advancedReporting: true,
  auditLog: true,
  apiAccess: true,
  prioritySupport: true,
};


/**
 * Get features for a tier from the database
 * Falls back to hardcoded defaults if database features are not configured
 */
async function getTierFeaturesFromDb(tierCode: string): Promise<Record<string, unknown>> {
  try {
    // Fetch tier configuration with features
    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code: tierCode },
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (tierConfig && tierConfig.tierFeatures.length > 0) {
      // Build features object from database
      const features: Record<string, unknown> = {
        // Include limits from tier config
        maxUsers: tierConfig.maxUsers ?? (tierCode === 'ENTERPRISE' ? -1 : 1),
        maxBranches: tierConfig.maxBranches ?? (tierCode === 'ENTERPRISE' ? -1 : 1),
        maxProducts: tierConfig.maxProducts ?? 500,
      };

      // Add feature flags
      for (const tf of tierConfig.tierFeatures) {
        features[tf.feature.key] = tf.isEnabled;
      }

      return features;
    }

    // Fall back to hardcoded defaults if no DB features configured
    // Only use fallback for known tiers
    if (['BASIC', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(tierCode)) {
      return getDefaultFeatures(tierCode as LicenseTier);
    }

    // For custom tiers without features, return minimal defaults
    return {
      maxUsers: 1,
      maxBranches: 1,
      maxProducts: 500,
    };
  } catch (error) {
    console.error('Error fetching tier features from DB:', error);
    if (['BASIC', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(tierCode)) {
      return getDefaultFeatures(tierCode as LicenseTier);
    }
    return { maxUsers: 1, maxBranches: 1, maxProducts: 500 };
  }
}

/**
 * Get default features for a tier (hardcoded fallback)
 * These feature keys map directly to the frontend's feature configuration
 */
function getDefaultFeatures(tier: LicenseTier) {
  switch (tier) {
    case 'BASIC':
      return {
        maxUsers: 1,
        maxBranches: 1,
        maxProducts: 500,
        ...BASE_FEATURES,
      };

    case 'STANDARD':
      return {
        maxUsers: 3,
        maxBranches: 1,
        maxProducts: 5000,
        ...BASE_FEATURES,
        ...STANDARD_FEATURES,
      };

    case 'PROFESSIONAL':
      return {
        maxUsers: 10,
        maxBranches: 3,
        maxProducts: -1,
        ...BASE_FEATURES,
        ...STANDARD_FEATURES,
        ...PROFESSIONAL_FEATURES,
      };

    case 'ENTERPRISE':
      return {
        maxUsers: -1,
        maxBranches: -1,
        maxProducts: -1,
        ...BASE_FEATURES,
        ...STANDARD_FEATURES,
        ...PROFESSIONAL_FEATURES,
      };
  }
}


export default {
  getLicenses,
  getLicense,
  generateLicense,
  generateBulkLicenses,
  updateLicense,
  revokeLicense,
  deleteLicense,
  getLicenseStats,
};
