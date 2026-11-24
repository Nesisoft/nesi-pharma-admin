import { Request, Response } from 'express';
import { LicenseStatus, AuditAction, PharmacyStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { validateLicenseKeyFormat } from '../utils/licenseKey';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { tierLimits } from '../utils/tierLimits';
import {
  LicenceRefusal,
  isRefusal,
  pharmacyActivationText,
  pharmacyRefusalCode,
  refuse,
  sendLicenceError,
  sendRefusal,
} from '../utils/licenseErrors';
import { addDays, effectiveStatus } from '../utils/licenseStatus';
import { LICENCE_TX_OPTIONS, countActiveActivations, lockLicence } from '../utils/licenseTx';
import { readPlanFeatures } from '../utils/licensePlan';
import { signFreePlanToken, signLicenceToken } from '../utils/licenceToken';

// The free plan (unlicensed PCs) in GET /plans
const FREE_PLAN_CODE = 'BASIC';

/** Does the request come from an app that wants a signed licence (desktop 1.4.0+)? */
const wantsToken = (body: unknown) => Number((body as { tokenVersion?: unknown } | undefined)?.tokenVersion) >= 1;

/** A short text from the request body, or null */
function bodyText(value: unknown, max = 255): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

/**
 * The licence key from the request: missing, malformed (format, tier prefix
 * or checksum) or the normalised key to look up
 */
function readLicenceKey(licenseKey: unknown): { key: string } | LicenceRefusal {
  if (licenseKey === undefined || licenseKey === null || licenseKey === '') {
    return refuse('LICENSE_KEY_REQUIRED');
  }
  if (typeof licenseKey !== 'string') return refuse('LICENSE_KEY_INVALID');
  const formatValidation = validateLicenseKeyFormat(licenseKey);
  if (!formatValidation.isValid) return refuse('LICENSE_KEY_INVALID', formatValidation.error);
  return { key: licenseKey.trim().toUpperCase() };
}

/**
 * Verify a license key (public endpoint for pharmacy app)
 *
 * Desktop apps call it on a timer and at sign-in. Opt-in: a request that names
 * its activation (activationId, sent by desktop 1.3.0 and later) is refused
 * when that activation is unknown or no longer active; 1.1.0/1.2.0 send none.
 *
 * Desktop 1.4.0 and later also send tokenVersion: 1 and their deviceId, and
 * get a signed licence (token) for that PC. The activation belongs to one PC:
 * another device id is refused (ACTIVATION_OTHER_DEVICE: a copy of the
 * pharmacy's data on another PC must be activated there). An activation that
 * never recorded its device (very old apps) takes the first one that asks.
 */
export async function verifyLicense(req: Request, res: Response): Promise<void> {
  try {
    const { licenseKey, activationId } = req.body ?? {};
    const deviceId = bodyText(req.body?.deviceId);
    const tokenWanted = wantsToken(req.body);

    const checked = readLicenceKey(licenseKey);
    if (isRefusal(checked)) {
      if (checked.refusal === 'LICENSE_KEY_INVALID' && typeof licenseKey === 'string') {
        await logVerification(licenseKey, req, false, checked.message || 'Invalid format');
      }
      sendRefusal(res, checked);
      return;
    }

    const license = await prisma.license.findUnique({
      where: { licenseKey: checked.key },
      include: {
        pharmacy: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!license) {
      sendLicenceError(res, 'LICENSE_NOT_FOUND');
      return;
    }

    const status = effectiveStatus(license);

    if (status === LicenseStatus.REVOKED) {
      await logVerificationById(license.id, req, false, 'License revoked');
      sendLicenceError(res, 'LICENSE_REVOKED');
      return;
    }

    if (status === LicenseStatus.SUSPENDED) {
      await logVerificationById(license.id, req, false, 'License suspended');
      sendLicenceError(res, 'LICENSE_SUSPENDED');
      return;
    }

    if (status === LicenseStatus.EXPIRED) {
      // Past its date but not marked yet: mark it, so admin pages agree
      if (license.status !== LicenseStatus.EXPIRED) {
        await prisma.license.update({
          where: { id: license.id },
          data: { status: LicenseStatus.EXPIRED },
        });
      }
      await logVerificationById(license.id, req, false, 'License expired');
      sendLicenceError(res, 'LICENSE_EXPIRED');
      return;
    }

    // Check pharmacy status if assigned
    if (license.pharmacy && license.pharmacy.status !== PharmacyStatus.ACTIVE) {
      await logVerificationById(license.id, req, false, 'Pharmacy not active');
      sendLicenceError(res, pharmacyRefusalCode(license.pharmacy.status));
      return;
    }

    // The PC the signed licence is for (desktop 1.4.0+ with its activation)
    let tokenDevice: { activationId: string; deviceId: string } | null = null;
    if (activationId !== undefined && activationId !== null && activationId !== '') {
      const activation =
        typeof activationId === 'string'
          ? await prisma.licenseActivation.findUnique({ where: { id: activationId } })
          : null;
      if (!activation || activation.licenseId !== license.id) {
        await logVerificationById(license.id, req, false, 'Activation not found');
        sendLicenceError(res, 'ACTIVATION_NOT_FOUND');
        return;
      }
      if (!activation.isActive) {
        await logVerificationById(license.id, req, false, 'Activation no longer active');
        sendLicenceError(res, 'ACTIVATION_INACTIVE');
        return;
      }
      if (tokenWanted && deviceId) {
        let boundDevice = activation.deviceId;
        if (!boundDevice) {
          // Never recorded: this PC takes it (unless another one just did)
          await prisma.licenseActivation.updateMany({
            where: { id: activation.id, deviceId: null },
            data: { deviceId },
          });
          boundDevice = (await prisma.licenseActivation.findUnique({ where: { id: activation.id } }))?.deviceId ?? null;
        }
        if (boundDevice !== deviceId) {
          await logVerificationById(license.id, req, false, 'Activation belongs to another device');
          sendLicenceError(res, 'ACTIVATION_OTHER_DEVICE');
          return;
        }
        tokenDevice = { activationId: activation.id, deviceId };
      }
    }

    // Fresh features from the plan: never "valid" without a plan
    const freshFeatures = await readPlanFeatures(prisma, license);
    if (!freshFeatures) {
      await logVerificationById(license.id, req, false, 'Plan unavailable');
      sendLicenceError(res, 'PLAN_UNAVAILABLE');
      return;
    }

    await logVerificationById(license.id, req, true, 'License valid');

    const token = tokenDevice
      ? signLicenceToken({
          licence: license,
          activationId: tokenDevice.activationId,
          deviceId: tokenDevice.deviceId,
          features: freshFeatures,
        })
      : null;

    sendSuccess(res, {
      valid: true,
      // A signed licence for this PC (desktop 1.4.0+), null without a signing key
      ...(tokenWanted ? { token } : {}),
      license: {
        tier: license.tier,
        tierCode: license.tierCode,
        status: license.status,
        features: freshFeatures,
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
    sendLicenceError(res, 'VERIFY_FAILED');
  }
}

type ActivationOutcome =
  | LicenceRefusal
  | {
      alreadyActivated: boolean;
      license: { id: string; tier: string; tierCode: string | null; validFrom: Date | null; expiresAt: Date | null };
      features: Record<string, unknown>;
      activation: { id: string; deviceName: string | null; activatedAt: Date };
      /** The PC the activation belongs to, for the signed licence */
      deviceId: string | null;
    };

/**
 * Activate a license key (public endpoint for pharmacy app)
 *
 * - Only the first activation starts the licence's term (expiresAt = now +
 *   durationDays). Later activations (another PC, or the same PC after
 *   deactivating) keep the expiry: extending a licence is the admin's Renew.
 * - Revoked, suspended and expired licences (by status or by date) are refused
 *   before any seat is looked at, and activation never lifts a status.
 * - A PC that already holds an active seat (same deviceId; the hardware
 *   fingerprint only when no deviceId is sent) gets that seat back.
 * - The seat check and the new activation happen in one transaction with the
 *   licence row locked, so concurrent requests can't exceed maxActivations.
 */
export async function activateLicense(req: Request, res: Response): Promise<void> {
  try {
    const { licenseKey, pharmacy: pharmacyData } = req.body ?? {};
    const deviceId = bodyText(req.body?.deviceId);
    const deviceName = bodyText(req.body?.deviceName);
    const deviceFingerprint = bodyText(req.body?.deviceFingerprint, 2000);

    const checked = readLicenceKey(licenseKey);
    if (isRefusal(checked)) {
      if (checked.refusal === 'LICENSE_KEY_INVALID' && typeof licenseKey === 'string') {
        await logVerification(licenseKey, req, false, checked.message || 'Invalid format');
      }
      sendRefusal(res, checked);
      return;
    }

    const found = await prisma.license.findUnique({
      where: { licenseKey: checked.key },
      select: { id: true },
    });
    if (!found) {
      sendLicenceError(res, 'LICENSE_NOT_FOUND');
      return;
    }

    const outcome = await prisma.$transaction(async (tx): Promise<ActivationOutcome> => {
      await lockLicence(tx, found.id);

      const license = await tx.license.findUnique({
        where: { id: found.id },
        include: {
          pharmacy: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });
      if (!license) return refuse('LICENSE_NOT_FOUND');

      const now = new Date();
      const status = effectiveStatus(license, now);
      if (status === LicenseStatus.REVOKED) return refuse('LICENSE_REVOKED');
      if (status === LicenseStatus.SUSPENDED) return refuse('LICENSE_SUSPENDED');
      if (status === LicenseStatus.EXPIRED) {
        if (license.status !== LicenseStatus.EXPIRED) {
          await tx.license.update({
            where: { id: license.id },
            data: { status: LicenseStatus.EXPIRED },
          });
        }
        return refuse('LICENSE_EXPIRED');
      }

      // Check pharmacy status if assigned
      if (license.pharmacy && license.pharmacy.status !== PharmacyStatus.ACTIVE) {
        return refuse(
          pharmacyRefusalCode(license.pharmacy.status),
          pharmacyActivationText(license.pharmacy.status)
        );
      }

      const activeActivations = await tx.licenseActivation.findMany({
        where: { licenseId: license.id, isActive: true },
        orderBy: { activatedAt: 'asc' },
      });

      // The plan, before anything is written: no seat for a licence without one
      const features = await readPlanFeatures(tx, license);
      if (!features) return refuse('PLAN_UNAVAILABLE');

      // This PC already holds a seat: give it back, change nothing
      const existingActivation = deviceId
        ? activeActivations.find((a) => a.deviceId === deviceId)
        : deviceFingerprint
          ? activeActivations.find((a) => a.deviceFingerprint === deviceFingerprint)
          : undefined;
      if (existingActivation) {
        return {
          alreadyActivated: true,
          license: {
            id: license.id,
            tier: license.tier,
            tierCode: license.tierCode,
            validFrom: license.validFrom,
            expiresAt: license.expiresAt,
          },
          features,
          activation: {
            id: existingActivation.id,
            deviceName: existingActivation.deviceName,
            activatedAt: existingActivation.activatedAt,
          },
          deviceId: existingActivation.deviceId,
        };
      }

      if (activeActivations.length >= license.maxActivations) {
        return refuse('ACTIVATION_LIMIT_REACHED');
      }

      // Create or find pharmacy if data provided
      let pharmacyId = license.pharmacyId;
      if (!pharmacyId && pharmacyData && typeof pharmacyData.email === 'string' && pharmacyData.email) {
        const pharmacyEmail = pharmacyData.email.toLowerCase();

        // Try to find existing pharmacy by email
        let pharmacy = await tx.pharmacy.findUnique({
          where: { email: pharmacyEmail },
        });

        if (!pharmacy) {
          // Create new pharmacy
          pharmacy = await tx.pharmacy.create({
            data: {
              name: pharmacyData.name || 'Unknown Pharmacy',
              email: pharmacyEmail,
              phone: pharmacyData.phone,
              address: pharmacyData.address,
              city: pharmacyData.city,
              region: pharmacyData.region,
              country: pharmacyData.country || 'Ghana',
              registrationNumber: pharmacyData.registrationNumber,
              status: PharmacyStatus.ACTIVE,
            },
          });
        } else if (pharmacy.status !== PharmacyStatus.ACTIVE) {
          // Existing pharmacy is not active
          return refuse(pharmacyRefusalCode(pharmacy.status), pharmacyActivationText(pharmacy.status));
        }
        pharmacyId = pharmacy.id;
      }

      // Only the first activation starts the term; an expiry set since (by
      // this or by Renew) is kept as it is
      const expiresAt = license.expiresAt ?? addDays(now, license.durationDays);
      const validFrom = license.validFrom ?? now;

      const activation = await tx.licenseActivation.create({
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

      await tx.license.update({
        where: { id: license.id },
        data: {
          // INACTIVE becomes ACTIVE; every other status was refused above
          status: LicenseStatus.ACTIVE,
          pharmacyId,
          currentActivations: activeActivations.length + 1,
          activatedAt: license.activatedAt ?? now,
          validFrom,
          validUntil: license.validUntil ?? expiresAt,
          expiresAt,
          features: features as Prisma.InputJsonValue, // cached copy of the plan
        },
      });

      await tx.auditLog.create({
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

      return {
        alreadyActivated: false,
        license: { id: license.id, tier: license.tier, tierCode: license.tierCode, validFrom, expiresAt },
        features,
        activation: {
          id: activation.id,
          deviceName: activation.deviceName,
          activatedAt: activation.activatedAt,
        },
        deviceId: activation.deviceId,
      };
    }, LICENCE_TX_OPTIONS);

    if (isRefusal(outcome)) {
      sendRefusal(res, outcome);
      return;
    }

    // A signed licence for the PC the seat belongs to (desktop 1.4.0+ trust
    // only this); null without a device id or a signing key
    const token = outcome.deviceId
      ? signLicenceToken({
          licence: { ...outcome.license, licenseKey: checked.key },
          activationId: outcome.activation.id,
          deviceId: outcome.deviceId,
          features: outcome.features,
        })
      : null;

    if (outcome.alreadyActivated) {
      sendSuccess(res, {
        activated: true,
        alreadyActivated: true,
        token,
        license: {
          tier: outcome.license.tier,
          tierCode: outcome.license.tierCode,
          features: outcome.features,
          expiresAt: outcome.license.expiresAt,
        },
        activation: outcome.activation,
      }, 'Device already activated');
      return;
    }

    sendSuccess(res, {
      activated: true,
      token,
      license: {
        tier: outcome.license.tier,
        tierCode: outcome.license.tierCode,
        features: outcome.features,
        validFrom: outcome.license.validFrom,
        expiresAt: outcome.license.expiresAt,
      },
      activation: outcome.activation,
    }, 'License activated successfully');
  } catch (error) {
    console.error('Activate license error:', error);
    sendLicenceError(res, 'ACTIVATE_FAILED');
  }
}

/**
 * Deactivate a license on a device (public endpoint)
 *
 * Works for every licence status: desktop 1.2.0's Deactivate relies on it to
 * put a suspended or expired PC back on the free plan. With a deviceId, every
 * active seat of that device is freed (older servers could give one PC two).
 */
export async function deactivateLicense(req: Request, res: Response): Promise<void> {
  try {
    const { licenseKey, deviceId, activationId } = req.body ?? {};

    if (!licenseKey) {
      sendLicenceError(res, 'LICENSE_KEY_REQUIRED');
      return;
    }
    if (typeof licenseKey !== 'string') {
      sendLicenceError(res, 'LICENSE_NOT_FOUND');
      return;
    }

    const license = await prisma.license.findUnique({
      where: { licenseKey: licenseKey.trim().toUpperCase() },
    });

    if (!license) {
      sendLicenceError(res, 'LICENSE_NOT_FOUND');
      return;
    }

    // Find the activation to deactivate
    const target: Prisma.LicenseActivationWhereInput = {
      licenseId: license.id,
      isActive: true,
    };
    if (activationId) {
      target.id = String(activationId);
    } else if (deviceId) {
      target.deviceId = String(deviceId);
    } else {
      sendLicenceError(res, 'DEVICE_ID_REQUIRED');
      return;
    }

    const deactivated = await prisma.$transaction(async (tx) => {
      await lockLicence(tx, license.id);

      const activations = await tx.licenseActivation.findMany({ where: target });
      if (activations.length === 0) return null;

      await tx.licenseActivation.updateMany({
        where: { id: { in: activations.map((a) => a.id) } },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
        },
      });

      // Seats in use, counted rather than decremented (never negative)
      await tx.license.update({
        where: { id: license.id },
        data: { currentActivations: await countActiveActivations(tx, license.id) },
      });

      const first = activations[0];
      await tx.auditLog.create({
        data: {
          action: AuditAction.DEACTIVATE,
          entityType: 'License',
          entityId: license.id,
          description: `License deactivated for device: ${first.deviceName || first.deviceId || 'Unknown'}`,
          newValue: { activationIds: activations.map((a) => a.id) },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      return activations;
    }, LICENCE_TX_OPTIONS);

    if (!deactivated) {
      sendLicenceError(res, 'ACTIVE_ACTIVATION_NOT_FOUND');
      return;
    }

    sendSuccess(res, null, 'License deactivated successfully');
  } catch (error) {
    console.error('Deactivate license error:', error);
    sendLicenceError(res, 'DEACTIVATE_FAILED');
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

/**
 * GET /api/public/license/plans
 * The plans on offer and what each one includes, for the pharmacy app's plan
 * comparison (Settings > License). Built from the same tier configs and tier
 * features as activation, so the app never shows a feature that a licence
 * for that plan wouldn't grant. Public, so only names, prices, limits and
 * feature switches.
 */
export async function getPlans(req: Request, res: Response): Promise<void> {
  try {
    const [tiers, catalogue] = await Promise.all([
      prisma.licenseTierConfig.findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }],
        include: {
          tierFeatures: { select: { isEnabled: true, feature: { select: { key: true } } } },
        },
      }),
      prisma.feature.findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: { key: true, name: true, description: true, category: true },
      }),
    ]);

    const plans = tiers.map((tier) => {
      const enabled = new Set(tier.tierFeatures.filter((tf) => tf.isEnabled).map((tf) => tf.feature.key));
      return {
        code: tier.code,
        name: tier.name,
        description: tier.description,
        price: tier.price.toString(),
        currency: tier.currency,
        durationDays: tier.durationDays,
        color: tier.color,
        limits: tierLimits(tier),
        // Every active feature, so a missing switch reads as "not included"
        features: Object.fromEntries(catalogue.map((feature) => [feature.key, enabled.has(feature.key)])),
      };
    });

    // The free plan, signed: desktop 1.4.0+ use only a signed copy (or their own built-in one)
    const free = plans.find((plan) => plan.code === FREE_PLAN_CODE);
    const freePlanToken = free
      ? signFreePlanToken({ code: free.code, limits: free.limits, features: free.features })
      : null;

    sendSuccess(res, { plans, features: catalogue, freePlanToken });
  } catch (error) {
    console.error('Get plans error:', error);
    sendError(res, 'Failed to fetch plans', 500);
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
      where: { licenseKey: licenseKey.trim().toUpperCase() },
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
        deviceId: bodyText(req.body?.deviceId),
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
  getPlans,
};
