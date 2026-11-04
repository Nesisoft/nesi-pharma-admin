import { Request, Response } from 'express';
import { AuditAction, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendCreated,
} from '../utils/apiResponse';

/**
 * Get all license tier configurations
 */
export async function getTierConfigs(req: Request, res: Response): Promise<void> {
  try {
    const { includeArchived } = req.query;

    const where: Record<string, unknown> = {};
    if (includeArchived !== 'true') {
      where.archivedAt = null;
    }

    const tiers = await prisma.licenseTierConfig.findMany({
      where,
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
          where: {
            isEnabled: true,
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }],
    });

    // Transform to include features as a simple object for backwards compatibility
    const transformedTiers = tiers.map((tier) => ({
      ...tier,
      features: tier.tierFeatures.reduce((acc, tf) => {
        acc[tf.feature.key] = tf.isEnabled;
        return acc;
      }, {} as Record<string, boolean>),
    }));

    sendSuccess(res, transformedTiers);
  } catch (error) {
    console.error('Get tier configs error:', error);
    sendError(res, 'Failed to fetch tier configurations', 500);
  }
}

/**
 * Get a single tier configuration by code
 */
export async function getTierConfig(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;

    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code },
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (!tierConfig) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    // Transform to include features object
    const transformedTier = {
      ...tierConfig,
      features: tierConfig.tierFeatures.reduce((acc, tf) => {
        acc[tf.feature.key] = tf.isEnabled;
        return acc;
      }, {} as Record<string, boolean>),
    };

    sendSuccess(res, transformedTier);
  } catch (error) {
    console.error('Get tier config error:', error);
    sendError(res, 'Failed to fetch tier configuration', 500);
  }
}

/**
 * Create a new tier configuration
 */
export async function createTierConfig(req: Request, res: Response): Promise<void> {
  try {
    const {
      code,
      name,
      description,
      price,
      currency,
      durationDays,
      maxUsers,
      maxProducts,
      maxTransactions,
      maxBranches,
      maxActivations,
      displayOrder,
      color,
      featureIds,
    } = req.body;

    // Validate required fields
    if (!code || !name) {
      sendError(res, 'Code and name are required', 400);
      return;
    }

    // Validate code format (uppercase alphanumeric with underscores)
    const codeRegex = /^[A-Z][A-Z0-9_]*$/;
    if (!codeRegex.test(code)) {
      sendError(res, 'Code must be uppercase alphanumeric with underscores (e.g., GOLD_TIER)', 400);
      return;
    }

    // Check if code already exists
    const existing = await prisma.licenseTierConfig.findUnique({
      where: { code },
    });

    if (existing) {
      sendError(res, 'A tier with this code already exists', 400);
      return;
    }

    // Get max display order if not provided
    let order = displayOrder;
    if (order === undefined) {
      const maxOrder = await prisma.licenseTierConfig.aggregate({
        _max: { displayOrder: true },
      });
      order = (maxOrder._max.displayOrder ?? 0) + 1;
    }

    // Create the tier
    const tierConfig = await prisma.licenseTierConfig.create({
      data: {
        code,
        name,
        description,
        price: price ?? 0,
        currency: currency ?? 'GHS',
        durationDays: durationDays ?? 365,
        maxUsers,
        maxProducts,
        maxTransactions,
        maxBranches,
        maxActivations,
        displayOrder: order,
        color,
        isDefault: false, // Custom tiers are never default
      },
    });

    // If feature IDs provided, create tier features
    if (featureIds && Array.isArray(featureIds) && featureIds.length > 0) {
      const allFeatures = await prisma.feature.findMany({
        where: { archivedAt: null },
      });

      const tierFeaturesToCreate = allFeatures.map((feature) => ({
        tierId: tierConfig.id,
        featureId: feature.id,
        isEnabled: featureIds.includes(feature.id),
      }));

      await prisma.tierFeature.createMany({
        data: tierFeaturesToCreate,
      });
    }

    // Fetch the complete tier with features
    const completeTier = await prisma.licenseTierConfig.findUnique({
      where: { id: tierConfig.id },
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entityType: 'LicenseTierConfig',
        entityId: tierConfig.id,
        adminUserId: req.user?.id,
        description: `Created new tier: ${name} (${code})`,
        newValue: tierConfig,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendCreated(res, completeTier, 'Tier configuration created successfully');
  } catch (error) {
    console.error('Create tier config error:', error);
    sendError(res, 'Failed to create tier configuration', 500);
  }
}

/**
 * Update a tier configuration
 */
export async function updateTierConfig(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;
    const {
      name,
      description,
      price,
      currency,
      durationDays,
      maxUsers,
      maxProducts,
      maxTransactions,
      maxBranches,
      maxActivations,
      displayOrder,
      color,
      isActive,
    } = req.body;

    const existing = await prisma.licenseTierConfig.findUnique({
      where: { code },
    });

    if (!existing) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (currency !== undefined) updateData.currency = currency;
    if (durationDays !== undefined) updateData.durationDays = durationDays;
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
    if (maxProducts !== undefined) updateData.maxProducts = maxProducts;
    if (maxTransactions !== undefined) updateData.maxTransactions = maxTransactions;
    if (maxBranches !== undefined) updateData.maxBranches = maxBranches;
    if (maxActivations !== undefined) updateData.maxActivations = maxActivations;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (color !== undefined) updateData.color = color;
    if (isActive !== undefined) updateData.isActive = isActive;

    const tierConfig = await prisma.licenseTierConfig.update({
      where: { code },
      data: updateData,
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'LicenseTierConfig',
        entityId: tierConfig.id,
        adminUserId: req.user?.id,
        description: `Updated ${code} tier configuration`,
        previousValue: existing as unknown as Prisma.InputJsonValue,
        newValue: updateData as Prisma.InputJsonValue,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, tierConfig, 'Tier configuration updated successfully');
  } catch (error) {
    console.error('Update tier config error:', error);
    sendError(res, 'Failed to update tier configuration', 500);
  }
}

/**
 * Archive a tier (soft delete)
 */
export async function archiveTierConfig(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;

    const existing = await prisma.licenseTierConfig.findUnique({
      where: { code },
    });

    if (!existing) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    if (existing.isDefault) {
      sendError(res, 'Cannot archive default tiers. You can only deactivate them.', 400);
      return;
    }

    if (existing.archivedAt) {
      sendError(res, 'Tier is already archived', 400);
      return;
    }

    // Check if any active licenses are using this tier
    const activeLicenses = await prisma.license.count({
      where: {
        tierCode: code,
        status: { in: ['ACTIVE', 'INACTIVE'] },
      },
    });

    if (activeLicenses > 0) {
      sendError(res, `Cannot archive tier with ${activeLicenses} active license(s). Reassign or revoke them first.`, 400);
      return;
    }

    const tierConfig = await prisma.licenseTierConfig.update({
      where: { code },
      data: {
        archivedAt: new Date(),
        isActive: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.DELETE,
        entityType: 'LicenseTierConfig',
        entityId: tierConfig.id,
        adminUserId: req.user?.id,
        description: `Archived ${code} tier configuration`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, tierConfig, 'Tier configuration archived successfully');
  } catch (error) {
    console.error('Archive tier config error:', error);
    sendError(res, 'Failed to archive tier configuration', 500);
  }
}

/**
 * Delete a tier permanently (only for non-default, archived tiers with no licenses)
 */
export async function deleteTierConfig(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;

    const existing = await prisma.licenseTierConfig.findUnique({
      where: { code },
    });

    if (!existing) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    if (existing.isDefault) {
      sendError(res, 'Cannot delete default tiers', 400);
      return;
    }

    // Check if any licenses are using this tier
    const licenses = await prisma.license.count({
      where: { tierCode: code },
    });

    if (licenses > 0) {
      sendError(res, `Cannot delete tier with ${licenses} license(s). Delete or reassign them first.`, 400);
      return;
    }

    // Delete tier features first
    await prisma.tierFeature.deleteMany({
      where: { tierId: existing.id },
    });

    // Delete the tier
    await prisma.licenseTierConfig.delete({
      where: { code },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.DELETE,
        entityType: 'LicenseTierConfig',
        adminUserId: req.user?.id,
        description: `Permanently deleted ${code} tier configuration`,
        previousValue: existing,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, null, 'Tier configuration deleted successfully');
  } catch (error) {
    console.error('Delete tier config error:', error);
    sendError(res, 'Failed to delete tier configuration', 500);
  }
}

/**
 * Restore an archived tier
 */
export async function restoreTierConfig(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;

    const existing = await prisma.licenseTierConfig.findUnique({
      where: { code },
    });

    if (!existing) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    if (!existing.archivedAt) {
      sendError(res, 'Tier is not archived', 400);
      return;
    }

    const tierConfig = await prisma.licenseTierConfig.update({
      where: { code },
      data: {
        archivedAt: null,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'LicenseTierConfig',
        entityId: tierConfig.id,
        adminUserId: req.user?.id,
        description: `Restored ${code} tier configuration`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, tierConfig, 'Tier configuration restored successfully');
  } catch (error) {
    console.error('Restore tier config error:', error);
    sendError(res, 'Failed to restore tier configuration', 500);
  }
}

/**
 * Update tier features (enable/disable features for a tier)
 */
export async function updateTierFeatures(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;
    const { features } = req.body; // Array of { featureId: string, isEnabled: boolean }

    if (!Array.isArray(features)) {
      sendError(res, 'Features must be an array', 400);
      return;
    }

    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code },
    });

    if (!tierConfig) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    // Process each feature
    for (const { featureId, isEnabled } of features) {
      await prisma.tierFeature.upsert({
        where: {
          tierId_featureId: {
            tierId: tierConfig.id,
            featureId,
          },
        },
        update: { isEnabled },
        create: {
          tierId: tierConfig.id,
          featureId,
          isEnabled,
        },
      });
    }

    // Fetch updated tier with features
    const updatedTier = await prisma.licenseTierConfig.findUnique({
      where: { code },
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'LicenseTierConfig',
        entityId: tierConfig.id,
        adminUserId: req.user?.id,
        description: `Updated features for ${code} tier`,
        newValue: { features },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, updatedTier, 'Tier features updated successfully');
  } catch (error) {
    console.error('Update tier features error:', error);
    sendError(res, 'Failed to update tier features', 500);
  }
}

/**
 * Sync all features to a tier (bulk update)
 */
export async function syncTierFeatures(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;
    const { featureIds } = req.body; // Array of feature IDs to enable

    if (!Array.isArray(featureIds)) {
      sendError(res, 'featureIds must be an array', 400);
      return;
    }

    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code },
    });

    if (!tierConfig) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    // Get all active features
    const allFeatures = await prisma.feature.findMany({
      where: { archivedAt: null },
    });

    // Delete existing tier features
    await prisma.tierFeature.deleteMany({
      where: { tierId: tierConfig.id },
    });

    // Create new tier features based on the provided feature IDs
    const tierFeaturesToCreate = allFeatures.map((feature) => ({
      tierId: tierConfig.id,
      featureId: feature.id,
      isEnabled: featureIds.includes(feature.id),
    }));

    await prisma.tierFeature.createMany({
      data: tierFeaturesToCreate,
    });

    // Fetch updated tier with features
    const updatedTier = await prisma.licenseTierConfig.findUnique({
      where: { code },
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'LicenseTierConfig',
        entityId: tierConfig.id,
        adminUserId: req.user?.id,
        description: `Synced features for ${code} tier`,
        newValue: { featureIds },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, updatedTier, 'Tier features synced successfully');
  } catch (error) {
    console.error('Sync tier features error:', error);
    sendError(res, 'Failed to sync tier features', 500);
  }
}

/**
 * Create or reset default tier configurations
 */
export async function resetTierConfigs(req: Request, res: Response): Promise<void> {
  try {
    const defaultConfigs = [
      {
        code: 'BASIC',
        name: 'Basic',
        description: 'Free tier with essential features for small pharmacies',
        price: 0,
        currency: 'GHS',
        durationDays: 0,
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
        maxProducts: null,
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
        maxUsers: null,
        maxProducts: null,
        maxTransactions: null,
        maxBranches: null,
        maxActivations: null,
        isDefault: true,
        displayOrder: 3,
        color: '#8B5CF6', // Purple
      },
    ];

    for (const config of defaultConfigs) {
      await prisma.licenseTierConfig.upsert({
        where: { code: config.code },
        update: config,
        create: config,
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'LicenseTierConfig',
        adminUserId: req.user?.id,
        description: 'Reset default tier configurations',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    const tiers = await prisma.licenseTierConfig.findMany({
      orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }],
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    sendSuccess(res, tiers, 'Tier configurations reset to defaults');
  } catch (error) {
    console.error('Reset tier configs error:', error);
    sendError(res, 'Failed to reset tier configurations', 500);
  }
}

/**
 * Get features for a specific tier
 */
export async function getTierFeatures(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;

    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code },
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (!tierConfig) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    // Also get all available features to show which are not assigned
    const allFeatures = await prisma.feature.findMany({
      where: { archivedAt: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const assignedFeatureIds = tierConfig.tierFeatures.map((tf) => tf.featureId);

    const featuresWithStatus = allFeatures.map((feature) => {
      const tierFeature = tierConfig.tierFeatures.find((tf) => tf.featureId === feature.id);
      return {
        ...feature,
        isEnabled: tierFeature?.isEnabled ?? false,
        isAssigned: assignedFeatureIds.includes(feature.id),
      };
    });

    sendSuccess(res, {
      tier: tierConfig,
      features: featuresWithStatus,
    });
  } catch (error) {
    console.error('Get tier features error:', error);
    sendError(res, 'Failed to fetch tier features', 500);
  }
}

/**
 * Reorder tiers
 */
export async function reorderTiers(req: Request, res: Response): Promise<void> {
  try {
    const { orders } = req.body; // Array of { code: string, displayOrder: number }

    if (!Array.isArray(orders)) {
      sendError(res, 'Orders must be an array', 400);
      return;
    }

    for (const { code, displayOrder } of orders) {
      await prisma.licenseTierConfig.update({
        where: { code },
        data: { displayOrder },
      });
    }

    const tiers = await prisma.licenseTierConfig.findMany({
      where: { archivedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }],
    });

    sendSuccess(res, tiers, 'Tier order updated successfully');
  } catch (error) {
    console.error('Reorder tiers error:', error);
    sendError(res, 'Failed to reorder tiers', 500);
  }
}

export default {
  getTierConfigs,
  getTierConfig,
  createTierConfig,
  updateTierConfig,
  archiveTierConfig,
  deleteTierConfig,
  restoreTierConfig,
  updateTierFeatures,
  syncTierFeatures,
  resetTierConfigs,
  getTierFeatures,
  reorderTiers,
};
