import { Request, Response } from 'express';
import { AuditAction } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendSuccess, sendPaginatedSuccess, sendError } from '../utils/apiResponse';

/**
 * Get audit logs with pagination and filters
 */
export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Filters
    const action = req.query.action as AuditAction | undefined;
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    const adminUserId = req.query.adminUserId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: Record<string, unknown> = {};

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (adminUserId) where.adminUserId = adminUserId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          adminUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    sendPaginatedSuccess(res, logs, page, limit, total);
  } catch (error) {
    console.error('Get audit logs error:', error);
    sendError(res, 'Failed to fetch audit logs', 500);
  }
}

/**
 * Get audit log for a specific entity
 */
export async function getEntityAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { entityType, entityId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        adminUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    sendSuccess(res, logs);
  } catch (error) {
    console.error('Get entity audit logs error:', error);
    sendError(res, 'Failed to fetch audit logs', 500);
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(req: Request, res: Response): Promise<void> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [byAction, byEntityType, totalLast30Days] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { id: true },
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.auditLog.groupBy({
        by: ['entityType'],
        _count: { id: true },
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.auditLog.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const actionStats = Object.fromEntries(
      byAction.map((a) => [a.action, a._count.id])
    );

    const entityStats = Object.fromEntries(
      byEntityType.map((e) => [e.entityType, e._count.id])
    );

    sendSuccess(res, {
      totalLast30Days,
      byAction: actionStats,
      byEntityType: entityStats,
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    sendError(res, 'Failed to fetch audit statistics', 500);
  }
}

export default {
  getAuditLogs,
  getEntityAuditLogs,
  getAuditStats,
};
