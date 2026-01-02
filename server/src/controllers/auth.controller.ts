import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import {
  sendSuccess,
  sendError,
  sendUnauthorized,
} from '../utils/apiResponse';
import { AuditAction } from '@prisma/client';

/**
 * Admin login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendError(res, 'Email and password are required', 400);
      return;
    }

    // Find user by email
    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      sendUnauthorized(res, 'Invalid email or password');
      return;
    }

    if (!user.isActive) {
      sendUnauthorized(res, 'Account is disabled');
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      sendUnauthorized(res, 'Invalid email or password');
      return;
    }

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update last login
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.LOGIN,
        entityType: 'AdminUser',
        entityId: user.id,
        adminUserId: user.id,
        description: 'Admin user logged in',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 'Login failed', 500);
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      sendError(res, 'Refresh token is required', 400);
      return;
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      sendUnauthorized(res, 'Invalid or expired refresh token');
      return;
    }

    // Verify user still exists and is active
    const user = await prisma.adminUser.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      sendUnauthorized(res, 'User not found or inactive');
      return;
    }

    // Generate new tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    sendSuccess(res, tokens, 'Token refreshed');
  } catch (error) {
    console.error('Refresh token error:', error);
    sendError(res, 'Token refresh failed', 500);
  }
}

/**
 * Get current user profile
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }

    const user = await prisma.adminUser.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!user) {
      sendUnauthorized(res, 'User not found');
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    console.error('Get profile error:', error);
    sendError(res, 'Failed to fetch profile', 500);
  }
}

/**
 * Update current user profile
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }

    const { firstName, lastName } = req.body;

    const user = await prisma.adminUser.update({
      where: { id: req.user.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    sendSuccess(res, user, 'Profile updated');
  } catch (error) {
    console.error('Update profile error:', error);
    sendError(res, 'Failed to update profile', 500);
  }
}

/**
 * Change password
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      sendError(res, 'Current password and new password are required', 400);
      return;
    }

    if (newPassword.length < 8) {
      sendError(res, 'New password must be at least 8 characters', 400);
      return;
    }

    // Get user with password
    const user = await prisma.adminUser.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      sendUnauthorized(res, 'User not found');
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      sendError(res, 'Current password is incorrect', 400);
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.adminUser.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'AdminUser',
        entityId: req.user.id,
        adminUserId: req.user.id,
        description: 'Password changed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    sendError(res, 'Failed to change password', 500);
  }
}

/**
 * Logout (client should discard tokens)
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    if (req.user) {
      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: AuditAction.LOGOUT,
          entityType: 'AdminUser',
          entityId: req.user.id,
          adminUserId: req.user.id,
          description: 'Admin user logged out',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    }

    sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    sendSuccess(res, null, 'Logged out');
  }
}

export default {
  login,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  logout,
};
