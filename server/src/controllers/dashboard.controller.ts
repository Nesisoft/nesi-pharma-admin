import { Request, Response } from 'express';
import { LicenseStatus, PharmacyStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/apiResponse';

/**
 * Get dashboard overview statistics
 */
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      // License stats
      totalLicenses,
      activeLicenses,
      licensesByTier,
      licensesGeneratedLast30Days,

      // Pharmacy stats
      totalPharmacies,
      activePharmacies,
      pharmaciesCreatedLast30Days,

      // Activation stats
      totalActivations,
      activationsLast7Days,
      activationsLast30Days,

      // Verification stats
      verificationsLast7Days,
      verificationsLast30Days,

      // Expiring soon (next 30 days)
      expiringSoon,
    ] = await Promise.all([
      // Licenses
      prisma.license.count(),
      prisma.license.count({ where: { status: LicenseStatus.ACTIVE } }),
      prisma.license.groupBy({
        by: ['tier'],
        _count: { id: true },
      }),
      prisma.license.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),

      // Pharmacies
      prisma.pharmacy.count(),
      prisma.pharmacy.count({ where: { status: PharmacyStatus.ACTIVE } }),
      prisma.pharmacy.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),

      // Activations
      prisma.licenseActivation.count(),
      prisma.licenseActivation.count({
        where: { activatedAt: { gte: sevenDaysAgo } },
      }),
      prisma.licenseActivation.count({
        where: { activatedAt: { gte: thirtyDaysAgo } },
      }),

      // Verifications
      prisma.licenseVerification.count({
        where: { verifiedAt: { gte: sevenDaysAgo } },
      }),
      prisma.licenseVerification.count({
        where: { verifiedAt: { gte: thirtyDaysAgo } },
      }),

      // Expiring soon
      prisma.license.count({
        where: {
          status: LicenseStatus.ACTIVE,
          expiresAt: {
            gte: now,
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const tierStats = Object.fromEntries(
      licensesByTier.map((t) => [t.tier, t._count.id])
    );

    sendSuccess(res, {
      licenses: {
        total: totalLicenses,
        active: activeLicenses,
        byTier: tierStats,
        generatedLast30Days: licensesGeneratedLast30Days,
        expiringSoon,
      },
      pharmacies: {
        total: totalPharmacies,
        active: activePharmacies,
        createdLast30Days: pharmaciesCreatedLast30Days,
      },
      activations: {
        total: totalActivations,
        last7Days: activationsLast7Days,
        last30Days: activationsLast30Days,
      },
      verifications: {
        last7Days: verificationsLast7Days,
        last30Days: verificationsLast30Days,
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    sendError(res, 'Failed to fetch dashboard statistics', 500);
  }
}

/**
 * Get recent activity
 */
export async function getRecentActivity(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const [recentLicenses, recentActivations, recentAuditLogs] = await Promise.all([
      prisma.license.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          licenseKey: true,
          tier: true,
          status: true,
          createdAt: true,
          pharmacy: {
            select: { name: true },
          },
        },
      }),
      prisma.licenseActivation.findMany({
        take: limit,
        orderBy: { activatedAt: 'desc' },
        select: {
          id: true,
          deviceName: true,
          activatedAt: true,
          license: {
            select: {
              licenseKey: true,
              tier: true,
            },
          },
          pharmacy: {
            select: { name: true },
          },
        },
      }),
      prisma.auditLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          description: true,
          createdAt: true,
          adminUser: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    sendSuccess(res, {
      recentLicenses,
      recentActivations,
      recentAuditLogs,
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    sendError(res, 'Failed to fetch recent activity', 500);
  }
}

/**
 * Get license generation trends (for charts)
 */
export async function getLicenseTrends(req: Request, res: Response): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get daily license generation counts
    const licenses = await prisma.license.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        tier: true,
      },
    });

    // Group by date
    const dailyCounts: Record<string, Record<string, number>> = {};

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyCounts[dateStr] = { total: 0, STANDARD: 0, PROFESSIONAL: 0, ENTERPRISE: 0 };
    }

    licenses.forEach((license) => {
      const dateStr = license.createdAt.toISOString().split('T')[0];
      if (dailyCounts[dateStr]) {
        dailyCounts[dateStr].total++;
        dailyCounts[dateStr][license.tier]++;
      }
    });

    const trends = Object.entries(dailyCounts).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    sendSuccess(res, trends);
  } catch (error) {
    console.error('Get license trends error:', error);
    sendError(res, 'Failed to fetch license trends', 500);
  }
}

/**
 * Get activation trends (for charts)
 */
export async function getActivationTrends(req: Request, res: Response): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const activations = await prisma.licenseActivation.findMany({
      where: {
        activatedAt: { gte: startDate },
      },
      select: {
        activatedAt: true,
      },
    });

    // Group by date
    const dailyCounts: Record<string, number> = {};

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyCounts[dateStr] = 0;
    }

    activations.forEach((activation) => {
      const dateStr = activation.activatedAt.toISOString().split('T')[0];
      if (dailyCounts[dateStr] !== undefined) {
        dailyCounts[dateStr]++;
      }
    });

    const trends = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      activations: count,
    }));

    sendSuccess(res, trends);
  } catch (error) {
    console.error('Get activation trends error:', error);
    sendError(res, 'Failed to fetch activation trends', 500);
  }
}

export default {
  getDashboardStats,
  getRecentActivity,
  getLicenseTrends,
  getActivationTrends,
};
