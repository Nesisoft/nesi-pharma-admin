import { Request, Response } from 'express';
import { LicenseTier, AuditAction } from '@prisma/client';
import prisma from '../lib/prisma';
import {
  sendSuccess,
  sendError,
  sendNotFound,
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
      orderBy: { price: 'asc' },
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
 * Get a single tier configuration
 */
export async function getTierConfig(req: Request, res: Response): Promise<void> {
  try {
    const { tier } = req.params;

    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { tier: tier as LicenseTier },
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
 * Update a tier configuration
 */
export async function updateTierConfig(req: Request, res: Response): Promise<void> {
  try {
    const { tier } = req.params;
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
      isActive,
    } = req.body;

    const existing = await prisma.licenseTierConfig.findUnique({
      where: { tier: tier as LicenseTier },
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
    if (isActive !== undefined) updateData.isActive = isActive;

    const tierConfig = await prisma.licenseTierConfig.update({
      where: { tier: tier as LicenseTier },
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
        description: `Updated ${tier} tier configuration`,
        previousValue: existing,
        newValue: updateData,
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
    const { tier } = req.params;

    const existing = await prisma.licenseTierConfig.findUnique({
      where: { tier: tier as LicenseTier },
    });

    if (!existing) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    if (existing.archivedAt) {
      sendError(res, 'Tier is already archived', 400);
      return;
    }

    const tierConfig = await prisma.licenseTierConfig.update({
      where: { tier: tier as LicenseTier },
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
        description: `Archived ${tier} tier configuration`,
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
 * Restore an archived tier
 */
export async function restoreTierConfig(req: Request, res: Response): Promise<void> {
  try {
    const { tier } = req.params;

    const existing = await prisma.licenseTierConfig.findUnique({
      where: { tier: tier as LicenseTier },
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
      where: { tier: tier as LicenseTier },
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
        description: `Restored ${tier} tier configuration`,
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
    const { tier } = req.params;
    const { features } = req.body; // Array of { featureId: string, isEnabled: boolean }

    if (!Array.isArray(features)) {
      sendError(res, 'Features must be an array', 400);
      return;
    }

    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { tier: tier as LicenseTier },
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
      where: { tier: tier as LicenseTier },
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
        description: `Updated features for ${tier} tier`,
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
    const { tier } = req.params;
    const { featureIds } = req.body; // Array of feature IDs to enable

    if (!Array.isArray(featureIds)) {
      sendError(res, 'featureIds must be an array', 400);
      return;
    }

    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { tier: tier as LicenseTier },
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
      where: { tier: tier as LicenseTier },
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
        description: `Synced features for ${tier} tier`,
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
 * Create or reset tier configurations to defaults
 */
export async function resetTierConfigs(req: Request, res: Response): Promise<void> {
  try {
    const defaultConfigs = [
      {
        tier: LicenseTier.BASIC,
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
        maxProducts: null,
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
        maxUsers: null,
        maxProducts: null,
        maxTransactions: null,
        maxBranches: null,
        maxActivations: null,
      },
    ];

    for (const config of defaultConfigs) {
      await prisma.licenseTierConfig.upsert({
        where: { tier: config.tier },
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
        description: 'Reset all tier configurations to defaults',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    const tiers = await prisma.licenseTierConfig.findMany({
      orderBy: { price: 'asc' },
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
    const { tier } = req.params;

    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { tier: tier as LicenseTier },
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

export default {
  getTierConfigs,
  getTierConfig,
  updateTierConfig,
  archiveTierConfig,
  restoreTierConfig,
  updateTierFeatures,
  syncTierFeatures,
  resetTierConfigs,
  getTierFeatures,
};
