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
    const tiers = await prisma.licenseTierConfig.findMany({
      orderBy: { price: 'asc' },
    });

    sendSuccess(res, tiers);
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
    });

    if (!tierConfig) {
      sendNotFound(res, 'Tier configuration');
      return;
    }

    sendSuccess(res, tierConfig);
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
      features,
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
    if (features !== undefined) updateData.features = features;
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
    if (maxProducts !== undefined) updateData.maxProducts = maxProducts;
    if (maxTransactions !== undefined) updateData.maxTransactions = maxTransactions;
    if (maxBranches !== undefined) updateData.maxBranches = maxBranches;
    if (maxActivations !== undefined) updateData.maxActivations = maxActivations;
    if (isActive !== undefined) updateData.isActive = isActive;

    const tierConfig = await prisma.licenseTierConfig.update({
      where: { tier: tier as LicenseTier },
      data: updateData,
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
 * Create or reset tier configurations to defaults
 */
export async function resetTierConfigs(req: Request, res: Response): Promise<void> {
  try {
    // Tier limits:
    // - Standard: 1 branch, 3 users, 3 activations (1 branch × 3 devices)
    // - Professional: 3 branches, 10 users, 9 activations (3 branches × 3 devices)
    // - Enterprise: unlimited branches, unlimited users, unlimited activations
    const defaultConfigs = [
      {
        tier: LicenseTier.BASIC,
        name: 'Basic',
        description: 'Free tier with essential features for small pharmacies',
        price: 0,
        currency: 'GHS',
        durationDays: 0,
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
        features: {
          maxUsers: -1,
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
    });

    sendSuccess(res, tiers, 'Tier configurations reset to defaults');
  } catch (error) {
    console.error('Reset tier configs error:', error);
    sendError(res, 'Failed to reset tier configurations', 500);
  }
}

export default {
  getTierConfigs,
  getTierConfig,
  updateTierConfig,
  resetTierConfigs,
};
