import { Request, Response } from 'express';
import { LicenseStatus, AuditAction, PharmacyStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { validateLicenseKeyFormat } from '../utils/licenseKey';
import { sendSuccess, sendError } from '../utils/apiResponse';

/**
 * Verify a license key (public endpoint for pharmacy app)
 */
export async function verifyLicense(req: Request, res: Response): Promise<void> {
  try {
    const { licenseKey, deviceId } = req.body;

    if (!licenseKey) {
      sendError(res, 'License key is required', 400);
      return;
    }

    // Validate format
    const formatValidation = validateLicenseKeyFormat(licenseKey);
    if (!formatValidation.isValid) {
      // Log verification attempt
      await logVerification(licenseKey, req, false, formatValidation.error || 'Invalid format');
      sendError(res, formatValidation.error || 'Invalid license key format', 400);
      return;
    }

    // Find license
    const license = await prisma.license.findUnique({
      where: { licenseKey: licenseKey.toUpperCase() },
      include: {
        pharmacy: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        activations: {
          where: { isActive: true },
        },
      },
    });

    if (!license) {
      await logVerification(licenseKey, req, false, 'License not found');
      sendError(res, 'License key not found', 404);
      return;
    }

    // Check license status
    if (license.status === LicenseStatus.REVOKED) {
      await logVerificationById(license.id, req, false, 'License revoked');
      sendError(res, 'License has been revoked', 403);
      return;
    }

    if (license.status === LicenseStatus.SUSPENDED) {
      await logVerificationById(license.id, req, false, 'License suspended');
      sendError(res, 'License has been suspended', 403);
      return;
    }

    if (license.status === LicenseStatus.EXPIRED) {
      await logVerificationById(license.id, req, false, 'License expired');
      sendError(res, 'License has expired', 403);
      return;
    }

    // Check expiry date if set
    if (license.expiresAt && new Date() > license.expiresAt) {
      // Update status to expired
      await prisma.license.update({
        where: { id: license.id },
        data: { status: LicenseStatus.EXPIRED },
      });
      await logVerificationById(license.id, req, false, 'License expired');
      sendError(res, 'License has expired', 403);
      return;
    }

    // Check pharmacy status if assigned
    if (license.pharmacy && license.pharmacy.status !== PharmacyStatus.ACTIVE) {
      await logVerificationById(license.id, req, false, 'Pharmacy not active');
      sendError(res, 'Pharmacy account is not active', 403);
      return;
    }

    // Log successful verification
    await logVerificationById(license.id, req, true, 'License valid');

    // Return license info
    sendSuccess(res, {
      valid: true,
      license: {
        tier: license.tier,
        status: license.status,
        features: license.features,
        validFrom: license.validFrom,
        validUntil: license.validUntil,
        expiresAt: license.expiresAt,
      },
      pharmacy: license.pharmacy ? {
        id: license.pharmacy.id,
        name: license.pharmacy.name,
      } : null,
    }, 'License is valid');
  } catch (error) {
    console.error('Verify license error:', error);
    sendError(res, 'License verification failed', 500);
  }
}

/**
 * Activate a license key (public endpoint for pharmacy app)
 */
export async function activateLicense(req: Request, res: Response): Promise<void> {
  try {
    const {
      licenseKey,
      deviceId,
      deviceName,
      deviceFingerprint,
      pharmacy: pharmacyData,
    } = req.body;

    if (!licenseKey) {
      sendError(res, 'License key is required', 400);
      return;
    }

    // Validate format
    const formatValidation = validateLicenseKeyFormat(licenseKey);
    if (!formatValidation.isValid) {
      sendError(res, formatValidation.error || 'Invalid license key format', 400);
      return;
    }

    // Find license
    const license = await prisma.license.findUnique({
      where: { licenseKey: licenseKey.toUpperCase() },
      include: {
        activations: {
          where: { isActive: true },
        },
      },
    });

    if (!license) {
      sendError(res, 'License key not found', 404);
      return;
    }

    // Check if already revoked/expired
    if (license.status === LicenseStatus.REVOKED) {
      sendError(res, 'License has been revoked', 403);
      return;
    }

    if (license.status === LicenseStatus.EXPIRED) {
      sendError(res, 'License has expired', 403);
      return;
    }

    // Check activation limit
    if (license.activations.length >= license.maxActivations) {
      // Check if device is already activated
      const existingActivation = license.activations.find(
        (a) => a.deviceId === deviceId || a.deviceFingerprint === deviceFingerprint
      );

      if (existingActivation) {
        // Return existing activation info
        sendSuccess(res, {
          activated: true,
          alreadyActivated: true,
          license: {
            tier: license.tier,
            features: license.features,
            expiresAt: license.expiresAt,
          },
          activation: {
            id: existingActivation.id,
            deviceName: existingActivation.deviceName,
            activatedAt: existingActivation.activatedAt,
          },
        }, 'Device already activated');
        return;
      }

      sendError(res, 'Maximum activations reached for this license', 403);
      return;
    }

    // Create or find pharmacy if data provided
    let pharmacyId = license.pharmacyId;
    if (pharmacyData && !pharmacyId) {
      // Try to find existing pharmacy by email
      let pharmacy = await prisma.pharmacy.findUnique({
        where: { email: pharmacyData.email.toLowerCase() },
      });

      if (!pharmacy) {
        // Create new pharmacy
        pharmacy = await prisma.pharmacy.create({
          data: {
            name: pharmacyData.name,
            email: pharmacyData.email.toLowerCase(),
            phone: pharmacyData.phone,
            address: pharmacyData.address,
            city: pharmacyData.city,
            region: pharmacyData.region,
            country: pharmacyData.country || 'Ghana',
            registrationNumber: pharmacyData.registrationNumber,
            status: PharmacyStatus.ACTIVE,
          },
        });
      }
      pharmacyId = pharmacy.id;
    }

    // Calculate expiry date
    const now = new Date();
    const expiresAt = new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000);

    // Create activation
    const activation = await prisma.licenseActivation.create({
      data: {
        licenseId: license.id,
        pharmacyId,
        deviceId,
        deviceName,
        deviceFingerprint,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Update license
    await prisma.license.update({
      where: { id: license.id },
      data: {
        status: LicenseStatus.ACTIVE,
        pharmacyId,
        currentActivations: license.activations.length + 1,
        activatedAt: license.activatedAt || now,
        validFrom: license.validFrom || now,
        validUntil: expiresAt,
        expiresAt,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.ACTIVATE,
        entityType: 'License',
        entityId: license.id,
        description: `License activated for device: ${deviceName || deviceId || 'Unknown'}`,
        newValue: { deviceId, deviceName, pharmacyId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, {
      activated: true,
      license: {
        tier: license.tier,
        features: license.features,
        validFrom: now,
        expiresAt,
      },
      activation: {
        id: activation.id,
        deviceName: activation.deviceName,
        activatedAt: activation.activatedAt,
      },
    }, 'License activated successfully');
  } catch (error) {
    console.error('Activate license error:', error);
    sendError(res, 'License activation failed', 500);
  }
}

/**
 * Deactivate a license on a device (public endpoint)
 */
export async function deactivateLicense(req: Request, res: Response): Promise<void> {
  try {
    const { licenseKey, deviceId, activationId } = req.body;

    if (!licenseKey) {
      sendError(res, 'License key is required', 400);
      return;
    }

    const license = await prisma.license.findUnique({
      where: { licenseKey: licenseKey.toUpperCase() },
    });

    if (!license) {
      sendError(res, 'License key not found', 404);
      return;
    }

    // Find the activation to deactivate
    const whereClause: Record<string, unknown> = {
      licenseId: license.id,
      isActive: true,
    };

    if (activationId) {
      whereClause.id = activationId;
    } else if (deviceId) {
      whereClause.deviceId = deviceId;
    } else {
      sendError(res, 'Device ID or activation ID is required', 400);
      return;
    }

    const activation = await prisma.licenseActivation.findFirst({
      where: whereClause,
    });

    if (!activation) {
      sendError(res, 'Active activation not found', 404);
      return;
    }

    // Deactivate
    await prisma.licenseActivation.update({
      where: { id: activation.id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });

    // Update license activation count
    await prisma.license.update({
      where: { id: license.id },
      data: {
        currentActivations: { decrement: 1 },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.DEACTIVATE,
        entityType: 'License',
        entityId: license.id,
        description: `License deactivated for device: ${activation.deviceName || activation.deviceId || 'Unknown'}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, null, 'License deactivated successfully');
  } catch (error) {
    console.error('Deactivate license error:', error);
    sendError(res, 'License deactivation failed', 500);
  }
}

/**
 * Get license tier features (public endpoint)
 */
export async function getTierFeatures(req: Request, res: Response): Promise<void> {
  try {
    const tiers = await prisma.licenseTierConfig.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    sendSuccess(res, tiers);
  } catch (error) {
    console.error('Get tier features error:', error);
    sendError(res, 'Failed to fetch tier features', 500);
  }
}

// Helper functions
async function logVerification(
  licenseKey: string,
  req: Request,
  isValid: boolean,
  message: string
): Promise<void> {
  try {
    const license = await prisma.license.findUnique({
      where: { licenseKey: licenseKey.toUpperCase() },
    });

    if (license) {
      await logVerificationById(license.id, req, isValid, message);
    }
  } catch (error) {
    console.error('Log verification error:', error);
  }
}

async function logVerificationById(
  licenseId: string,
  req: Request,
  isValid: boolean,
  message: string
): Promise<void> {
  try {
    await prisma.licenseVerification.create({
      data: {
        licenseId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        deviceId: req.body.deviceId,
        isValid,
        message,
      },
    });
  } catch (error) {
    console.error('Log verification error:', error);
  }
}

export default {
  verifyLicense,
  activateLicense,
  deactivateLicense,
  getTierFeatures,
};
