import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AdminRole, AuditAction, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import {
  sendSuccess,
  sendPaginatedSuccess,
  sendError,
  sendNotFound,
  sendForbidden,
} from '../utils/apiResponse';

/**
 * Get all admin users with pagination
 */
export async function getAdminUsers(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const role = req.query.role as AdminRole | undefined;
    const isActive = req.query.isActive as string | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.adminUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
      }),
      prisma.adminUser.count({ where }),
    ]);

    sendPaginatedSuccess(res, users, page, limit, total);
  } catch (error) {
    console.error('Get admin users error:', error);
    sendError(res, 'Failed to fetch admin users', 500);
  }
}

/**
 * Get a single admin user by ID
 */
export async function getAdminUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const user = await prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            generatedLicenses: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!user) {
      sendNotFound(res, 'Admin user');
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    console.error('Get admin user error:', error);
    sendError(res, 'Failed to fetch admin user', 500);
  }
}

/**
 * Create a new admin user (Super Admin only)
 */
export async function createAdminUser(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, firstName, lastName, role = AdminRole.VIEWER } = req.body;

    if (!email || !password || !firstName || !lastName) {
      sendError(res, 'Email, password, first name, and last name are required', 400);
      return;
    }

    if (password.length < 8) {
      sendError(res, 'Password must be at least 8 characters', 400);
      return;
    }

    // Only super admin can create admins or super admins
    if (
      (role === AdminRole.ADMIN || role === AdminRole.SUPER_ADMIN) &&
      req.user?.role !== AdminRole.SUPER_ADMIN
    ) {
      sendForbidden(res, 'Only super admin can create admin users');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.adminUser.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entityType: 'AdminUser',
        entityId: user.id,
        adminUserId: req.user?.id,
        description: `Created admin user: ${email}`,
        newValue: { email, firstName, lastName, role },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, user, 'Admin user created successfully', 201);
  } catch (error) {
    console.error('Create admin user error:', error);
    sendError(res, 'Failed to create admin user', 500);
  }
}

/**
 * Update an admin user
 */
export async function updateAdminUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, isActive } = req.body;

    const existing = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      sendNotFound(res, 'Admin user');
      return;
    }

    // Prevent modifying super admin unless you are super admin
    if (
      existing.role === AdminRole.SUPER_ADMIN &&
      req.user?.role !== AdminRole.SUPER_ADMIN
    ) {
      sendForbidden(res, 'Cannot modify super admin user');
      return;
    }

    // Only super admin can change roles to admin/super admin
    if (
      role &&
      (role === AdminRole.ADMIN || role === AdminRole.SUPER_ADMIN) &&
      req.user?.role !== AdminRole.SUPER_ADMIN
    ) {
      sendForbidden(res, 'Only super admin can assign admin roles');
      return;
    }

    // Prevent self-demotion for super admin
    if (
      id === req.user?.id &&
      role &&
      role !== AdminRole.SUPER_ADMIN &&
      req.user?.role === AdminRole.SUPER_ADMIN
    ) {
      sendError(res, 'Cannot demote yourself from super admin', 400);
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (role && Object.values(AdminRole).includes(role)) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'AdminUser',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Updated admin user: ${existing.email}`,
        previousValue: { firstName: existing.firstName, lastName: existing.lastName, role: existing.role } as Prisma.InputJsonValue,
        newValue: updateData as Prisma.InputJsonValue,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, user, 'Admin user updated successfully');
  } catch (error) {
    console.error('Update admin user error:', error);
    sendError(res, 'Failed to update admin user', 500);
  }
}

/**
 * Reset admin user password (Super Admin only)
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      sendError(res, 'New password must be at least 8 characters', 400);
      return;
    }

    const existing = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      sendNotFound(res, 'Admin user');
      return;
    }

    // Prevent resetting super admin password unless you are super admin
    if (
      existing.role === AdminRole.SUPER_ADMIN &&
      req.user?.role !== AdminRole.SUPER_ADMIN
    ) {
      sendForbidden(res, 'Cannot reset super admin password');
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.adminUser.update({
      where: { id },
      data: { password: hashedPassword },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'AdminUser',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Reset password for admin user: ${existing.email}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, null, 'Password reset successfully');
  } catch (error) {
    console.error('Reset password error:', error);
    sendError(res, 'Failed to reset password', 500);
  }
}

/**
 * Delete an admin user (Super Admin only)
 */
export async function deleteAdminUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === req.user?.id) {
      sendError(res, 'Cannot delete your own account', 400);
      return;
    }

    const existing = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      sendNotFound(res, 'Admin user');
      return;
    }

    // Prevent deleting super admin
    if (existing.role === AdminRole.SUPER_ADMIN) {
      sendForbidden(res, 'Cannot delete super admin user');
      return;
    }

    await prisma.adminUser.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.DELETE,
        entityType: 'AdminUser',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Deleted admin user: ${existing.email}`,
        previousValue: { email: existing.email, role: existing.role },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, null, 'Admin user deleted successfully');
  } catch (error) {
    console.error('Delete admin user error:', error);
    sendError(res, 'Failed to delete admin user', 500);
  }
}

export default {
  getAdminUsers,
  getAdminUser,
  createAdminUser,
  updateAdminUser,
  resetPassword,
  deleteAdminUser,
};
