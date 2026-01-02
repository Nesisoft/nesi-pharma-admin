import { Request, Response, NextFunction } from 'express';
import { AdminRole } from '@prisma/client';
import { verifyAccessToken, JWTPayload } from '../utils/jwt';
import { sendUnauthorized, sendForbidden } from '../utils/apiResponse';
import prisma from '../lib/prisma';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: AdminRole;
        firstName: string;
        lastName: string;
      };
    }
  }
}

/**
 * Authentication middleware - verifies JWT token
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendUnauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.split(' ')[1];

    let decoded: JWTPayload;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      sendUnauthorized(res, 'Invalid or expired token');
      return;
    }

    // Verify user still exists and is active
    const user = await prisma.adminUser.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      sendUnauthorized(res, 'User not found or inactive');
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    sendUnauthorized(res, 'Authentication failed');
  }
}

/**
 * Authorization middleware - checks if user has required role
 */
export function authorize(...allowedRoles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendForbidden(res, 'Insufficient permissions');
      return;
    }

    next();
  };
}

/**
 * Require admin role (ADMIN or SUPER_ADMIN)
 */
export const requireAdmin = authorize(AdminRole.ADMIN, AdminRole.SUPER_ADMIN);

/**
 * Require super admin role
 */
export const requireSuperAdmin = authorize(AdminRole.SUPER_ADMIN);

/**
 * Require support or higher role
 */
export const requireSupport = authorize(
  AdminRole.SUPPORT,
  AdminRole.ADMIN,
  AdminRole.SUPER_ADMIN
);

export default {
  authenticate,
  authorize,
  requireAdmin,
  requireSuperAdmin,
  requireSupport,
};
