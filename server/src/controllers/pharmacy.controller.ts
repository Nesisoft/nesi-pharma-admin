import { Request, Response } from 'express';
import { PharmacyStatus, AuditAction } from '@prisma/client';
import prisma from '../lib/prisma';
import {
  sendSuccess,
  sendPaginatedSuccess,
  sendError,
  sendNotFound,
} from '../utils/apiResponse';

/**
 * Get all pharmacies with pagination and filters
 */
export async function getPharmacies(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const status = req.query.status as PharmacyStatus | undefined;
    const search = req.query.search as string | undefined;
    const region = req.query.region as string | undefined;

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (region) where.region = region;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [pharmacies, total] = await Promise.all([
      prisma.pharmacy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          licenses: {
            select: {
              id: true,
              tier: true,
              status: true,
              expiresAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              licenses: true,
              activations: true,
            },
          },
        },
      }),
      prisma.pharmacy.count({ where }),
    ]);

    sendPaginatedSuccess(res, pharmacies, page, limit, total);
  } catch (error) {
    console.error('Get pharmacies error:', error);
    sendError(res, 'Failed to fetch pharmacies', 500);
  }
}

/**
 * Get a single pharmacy by ID
 */
export async function getPharmacy(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id },
      include: {
        licenses: {
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { activations: true },
            },
          },
        },
        activations: {
          orderBy: { activatedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!pharmacy) {
      sendNotFound(res, 'Pharmacy');
      return;
    }

    sendSuccess(res, pharmacy);
  } catch (error) {
    console.error('Get pharmacy error:', error);
    sendError(res, 'Failed to fetch pharmacy', 500);
  }
}

/**
 * Create a new pharmacy
 */
export async function createPharmacy(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      email,
      phone,
      address,
      city,
      region,
      country = 'Ghana',
      registrationNumber,
      status = PharmacyStatus.PENDING,
    } = req.body;

    if (!name || !email) {
      sendError(res, 'Name and email are required', 400);
      return;
    }

    const pharmacy = await prisma.pharmacy.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone,
        address,
        city,
        region,
        country,
        registrationNumber,
        status,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entityType: 'Pharmacy',
        entityId: pharmacy.id,
        adminUserId: req.user?.id,
        description: `Created pharmacy: ${name}`,
        newValue: pharmacy,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, pharmacy, 'Pharmacy created successfully', 201);
  } catch (error) {
    console.error('Create pharmacy error:', error);
    sendError(res, 'Failed to create pharmacy', 500);
  }
}

/**
 * Update a pharmacy
 */
export async function updatePharmacy(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      address,
      city,
      region,
      country,
      registrationNumber,
      status,
    } = req.body;

    const existing = await prisma.pharmacy.findUnique({
      where: { id },
    });

    if (!existing) {
      sendNotFound(res, 'Pharmacy');
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (region !== undefined) updateData.region = region;
    if (country !== undefined) updateData.country = country;
    if (registrationNumber !== undefined) updateData.registrationNumber = registrationNumber;
    if (status && Object.values(PharmacyStatus).includes(status)) {
      updateData.status = status;
    }

    const pharmacy = await prisma.pharmacy.update({
      where: { id },
      data: updateData,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'Pharmacy',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Updated pharmacy: ${pharmacy.name}`,
        previousValue: existing,
        newValue: updateData,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, pharmacy, 'Pharmacy updated successfully');
  } catch (error) {
    console.error('Update pharmacy error:', error);
    sendError(res, 'Failed to update pharmacy', 500);
  }
}

/**
 * Suspend a pharmacy
 */
export async function suspendPharmacy(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id },
    });

    if (!pharmacy) {
      sendNotFound(res, 'Pharmacy');
      return;
    }

    if (pharmacy.status === PharmacyStatus.SUSPENDED) {
      sendError(res, 'Pharmacy is already suspended', 400);
      return;
    }

    const updated = await prisma.pharmacy.update({
      where: { id },
      data: { status: PharmacyStatus.SUSPENDED },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.DEACTIVATE,
        entityType: 'Pharmacy',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Suspended pharmacy: ${pharmacy.name}. Reason: ${reason || 'Not specified'}`,
        previousValue: { status: pharmacy.status },
        newValue: { status: PharmacyStatus.SUSPENDED, reason },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, updated, 'Pharmacy suspended successfully');
  } catch (error) {
    console.error('Suspend pharmacy error:', error);
    sendError(res, 'Failed to suspend pharmacy', 500);
  }
}

/**
 * Activate a pharmacy
 */
export async function activatePharmacy(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id },
    });

    if (!pharmacy) {
      sendNotFound(res, 'Pharmacy');
      return;
    }

    if (pharmacy.status === PharmacyStatus.ACTIVE) {
      sendError(res, 'Pharmacy is already active', 400);
      return;
    }

    const updated = await prisma.pharmacy.update({
      where: { id },
      data: { status: PharmacyStatus.ACTIVE },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.ACTIVATE,
        entityType: 'Pharmacy',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Activated pharmacy: ${pharmacy.name}`,
        previousValue: { status: pharmacy.status },
        newValue: { status: PharmacyStatus.ACTIVE },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, updated, 'Pharmacy activated successfully');
  } catch (error) {
    console.error('Activate pharmacy error:', error);
    sendError(res, 'Failed to activate pharmacy', 500);
  }
}

/**
 * Delete a pharmacy
 */
export async function deletePharmacy(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id },
      include: {
        _count: {
          select: { licenses: true },
        },
      },
    });

    if (!pharmacy) {
      sendNotFound(res, 'Pharmacy');
      return;
    }

    if (pharmacy._count.licenses > 0) {
      sendError(res, 'Cannot delete pharmacy with existing licenses', 400);
      return;
    }

    await prisma.pharmacy.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.DELETE,
        entityType: 'Pharmacy',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Deleted pharmacy: ${pharmacy.name}`,
        previousValue: pharmacy,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, null, 'Pharmacy deleted successfully');
  } catch (error) {
    console.error('Delete pharmacy error:', error);
    sendError(res, 'Failed to delete pharmacy', 500);
  }
}

/**
 * Get pharmacy statistics
 */
export async function getPharmacyStats(req: Request, res: Response): Promise<void> {
  try {
    const [total, byStatus, byRegion, recentlyCreated] = await Promise.all([
      prisma.pharmacy.count(),
      prisma.pharmacy.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.pharmacy.groupBy({
        by: ['region'],
        _count: { id: true },
        where: { region: { not: null } },
      }),
      prisma.pharmacy.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const statusStats = Object.fromEntries(
      byStatus.map((s) => [s.status, s._count.id])
    );

    const regionStats = Object.fromEntries(
      byRegion.map((r) => [r.region || 'Unknown', r._count.id])
    );

    sendSuccess(res, {
      total,
      byStatus: statusStats,
      byRegion: regionStats,
      last30Days: recentlyCreated,
    });
  } catch (error) {
    console.error('Get pharmacy stats error:', error);
    sendError(res, 'Failed to fetch pharmacy statistics', 500);
  }
}

export default {
  getPharmacies,
  getPharmacy,
  createPharmacy,
  updatePharmacy,
  suspendPharmacy,
  activatePharmacy,
  deletePharmacy,
  getPharmacyStats,
};
