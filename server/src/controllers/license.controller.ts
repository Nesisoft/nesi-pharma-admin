import { Request, Response } from 'express';
import { License, LicenseTier, LicenseStatus, AuditAction, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { tierLimits } from '../utils/tierLimits';
import {
  generateLicenseKey,
  generateBulkLicenseKeys,
  validateLicenseKeyFormat,
  maskLicenseKey,
} from '../utils/licenseKey';
import {
  sendSuccess,
  sendPaginatedSuccess,
  sendError,
  sendCodedError,
  sendNotFound,
} from '../utils/apiResponse';
import {
  effectiveStatusWhere,
  expiringWithinWhere,
  withEffectiveStatus,
} from '../utils/licenseStatus';
import {
  isRenewRefusal,
  parseRenewRequest,
  planRenewal,
  statusAfterSuspension,
} from '../utils/licenseRenewal';
import { LICENCE_TX_OPTIONS, countActiveActivations, lockLicence } from '../utils/licenseTx';

const ENUM_TIERS: string[] = Object.values(LicenseTier);
const STATUSES: string[] = Object.values(LicenseStatus);
const MAX_REASON_LENGTH = 500;

/** An admin action refused inside its transaction: HTTP status and message */
type ActionRefusal = { status: number; error: string };

/** An optional reason or note from the request body */
function reasonText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_REASON_LENGTH) : null;
}

/** The enum tier a plan code is stored with (custom plans: BASIC) */
function enumTierFor(tierCode: string): LicenseTier {
  return ENUM_TIERS.includes(tierCode) ? (tierCode as LicenseTier) : LicenseTier.BASIC;
}

/**
 * A new key for a plan. The key's first letter comes from the enum tier, so
 * a custom plan (GOLD_TIER) gets B like other non-standard plans; the plan
 * itself is the licence's tierCode. Checked before use: a key that fails
 * validation could never be verified or activated.
 */
function newLicenceKey(tierCode: string): string {
  const key = generateLicenseKey(enumTierFor(tierCode));
  if (!validateLicenseKeyFormat(key).isValid) {
    throw new Error(`Generated an invalid licence key for plan ${tierCode}`);
  }
  return key;
}

/**
 * Get all licenses with pagination and filters
 *
 * status filters by the effective status (a licence past its expiry date is
 * EXPIRED even before anyone verified it); expiringWithinDays lists active
 * licences whose expiry falls in the next N days. Each licence carries
 * effectiveStatus next to its stored status.
 */
export async function getLicenses(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const now = new Date();

    // Filters
    const tier = req.query.tier as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const pharmacyId = req.query.pharmacyId as string | undefined;
    const expiringWithinDays = parseInt(req.query.expiringWithinDays as string);

    const filters: Prisma.LicenseWhereInput[] = [];

    if (tier && ENUM_TIERS.includes(tier)) filters.push({ tier: tier as LicenseTier });
    if (status && STATUSES.includes(status)) filters.push(effectiveStatusWhere(status as LicenseStatus, now));
    if (expiringWithinDays > 0) filters.push(expiringWithinWhere(Math.min(expiringWithinDays, 3650), now));
    if (pharmacyId) filters.push({ pharmacyId });
    if (search) {
      filters.push({
        OR: [
          { licenseKey: { contains: search, mode: 'insensitive' } },
          { pharmacy: { name: { contains: search, mode: 'insensitive' } } },
          { pharmacy: { email: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.LicenseWhereInput = { AND: filters };

    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          pharmacy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          generatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { activations: true },
          },
        },
      }),
      prisma.license.count({ where }),
    ]);

    sendPaginatedSuccess(res, licenses.map((l) => withEffectiveStatus(l, now)), page, limit, total);
  } catch (error) {
    console.error('Get licenses error:', error);
    sendError(res, 'Failed to fetch licenses', 500);
  }
}

/**
 * Get a single license by ID
 */
export async function getLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const license = await prisma.license.findUnique({
      where: { id },
      include: {
        pharmacy: true,
        generatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        activations: {
          orderBy: { activatedAt: 'desc' },
        },
        verifications: {
          orderBy: { verifiedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!license) {
      sendNotFound(res, 'License');
      return;
    }

    sendSuccess(res, withEffectiveStatus(license));
  } catch (error) {
    console.error('Get license error:', error);
    sendError(res, 'Failed to fetch license', 500);
  }
}

/**
 * Generate a new license key
 */
export async function generateLicense(req: Request, res: Response): Promise<void> {
  try {
    const {
      tier,
      tierCode,
      pharmacyId,
      durationDays,
      maxActivations,
      notes,
      features,
    } = req.body;

    // Use tierCode if provided, otherwise fall back to tier
    const selectedTierCode = tierCode || tier;

    if (!selectedTierCode) {
      sendError(res, 'Tier code is required', 400);
      return;
    }

    // Validate tier code exists and is not BASIC
    if (selectedTierCode === 'BASIC') {
      sendError(res, 'Cannot generate license for BASIC tier (free tier)', 400);
      return;
    }

    // Get tier configuration for defaults
    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code: selectedTierCode },
    });

    if (!tierConfig) {
      sendError(res, `Invalid tier code: ${selectedTierCode}`, 400);
      return;
    }

    // Use tier config defaults if not explicitly provided
    const licenseDurationDays = durationDays ?? tierConfig?.durationDays ?? 365;
    const licenseMaxActivations = maxActivations ?? tierConfig?.maxActivations ?? 1;

    // Determine the enum tier for backwards compatibility (custom plans: BASIC)
    const enumTier = enumTierFor(selectedTierCode);

    // Generate unique license key
    let licenseKey = newLicenceKey(selectedTierCode);
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existing = await prisma.license.findUnique({
        where: { licenseKey },
      });
      if (!existing) break;
      licenseKey = newLicenceKey(selectedTierCode);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      sendError(res, 'Failed to generate unique license key', 500);
      return;
    }

    // Get features from database or fallback to defaults
    const licenseFeatures = features || await getTierFeaturesFromDb(selectedTierCode);

    // Create license
    const license = await prisma.license.create({
      data: {
        licenseKey,
        tier: enumTier,
        tierCode: selectedTierCode,
        status: LicenseStatus.INACTIVE,
        durationDays: licenseDurationDays,
        maxActivations: licenseMaxActivations,
        pharmacyId: pharmacyId || null,
        notes,
        features: licenseFeatures as Prisma.InputJsonValue,
        generatedById: req.user?.id,
      },
      include: {
        pharmacy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.GENERATE,
        entityType: 'License',
        entityId: license.id,
        adminUserId: req.user?.id,
        description: `Generated ${selectedTierCode} license: ${maskLicenseKey(licenseKey)}`,
        newValue: { tier: selectedTierCode, licenseKey: maskLicenseKey(licenseKey) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, license, 'License generated successfully', 201);
  } catch (error) {
    console.error('Generate license error:', error);
    sendError(res, 'Failed to generate license', 500);
  }
}

/**
 * Generate multiple licenses at once
 */
export async function generateBulkLicenses(req: Request, res: Response): Promise<void> {
  try {
    const {
      tier,
      tierCode,
      count,
      durationDays,
      maxActivations,
      notes,
    } = req.body;

    // Use tierCode if provided, otherwise fall back to tier
    const selectedTierCode = tierCode || tier;

    if (!selectedTierCode) {
      sendError(res, 'Tier code is required', 400);
      return;
    }

    if (selectedTierCode === 'BASIC') {
      sendError(res, 'Cannot generate license for BASIC tier', 400);
      return;
    }

    const requestedCount = parseInt(count) || 1;
    if (requestedCount < 1 || requestedCount > 100) {
      sendError(res, 'Count must be between 1 and 100', 400);
      return;
    }

    // Get tier configuration for defaults
    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code: selectedTierCode },
    });

    if (!tierConfig) {
      sendError(res, `Invalid tier code: ${selectedTierCode}`, 400);
      return;
    }

    // Use tier config defaults if not explicitly provided
    const licenseDurationDays = durationDays ?? tierConfig?.durationDays ?? 365;
    const licenseMaxActivations = maxActivations ?? tierConfig?.maxActivations ?? 1;

    // Determine the enum tier for backwards compatibility (custom plans: BASIC)
    const enumTier = enumTierFor(selectedTierCode);

    // Generate unique keys (the key's first letter comes from the enum tier)
    const licenseKeys = generateBulkLicenseKeys(enumTier, requestedCount);
    if (licenseKeys.some((key) => !validateLicenseKeyFormat(key).isValid)) {
      throw new Error(`Generated an invalid licence key for plan ${selectedTierCode}`);
    }
    const features = await getTierFeaturesFromDb(selectedTierCode);

    // Create licenses
    const licenses = await Promise.all(
      licenseKeys.map((licenseKey) =>
        prisma.license.create({
          data: {
            licenseKey,
            tier: enumTier,
            tierCode: selectedTierCode,
            status: LicenseStatus.INACTIVE,
            durationDays: licenseDurationDays,
            maxActivations: licenseMaxActivations,
            notes,
            features: features as Prisma.InputJsonValue,
            generatedById: req.user?.id,
          },
        })
      )
    );

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.GENERATE,
        entityType: 'License',
        adminUserId: req.user?.id,
        description: `Bulk generated ${requestedCount} ${selectedTierCode} licenses`,
        newValue: { tier: selectedTierCode, count: requestedCount },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(
      res,
      {
        count: licenses.length,
        licenses: licenses.map((l) => ({
          id: l.id,
          licenseKey: l.licenseKey,
          tier: l.tierCode || l.tier,
        })),
      },
      `Generated ${licenses.length} licenses`,
      201
    );
  } catch (error) {
    console.error('Bulk generate licenses error:', error);
    sendError(res, 'Failed to generate licenses', 500);
  }
}

/**
 * Update license details
 *
 * Notes, pharmacy, seats (maxActivations), the cached features, and the term
 * (durationDays) while the licence has never been activated. The status is
 * not changed here: Renew / extend, Suspend, Lift suspension and Revoke each
 * have their own rules. The audit row records only what changed.
 */
export async function updateLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, pharmacyId, durationDays, maxActivations, notes, features } = req.body ?? {};

    const existing = await prisma.license.findUnique({
      where: { id },
    });

    if (!existing) {
      sendNotFound(res, 'License');
      return;
    }

    if (status !== undefined && status !== null && status !== existing.status) {
      sendError(
        res,
        "A licence's status can't be changed here. Use Renew / extend, Suspend, Lift suspension or Revoke on the licence page.",
        400
      );
      return;
    }

    const updateData: Prisma.LicenseUncheckedUpdateInput = {};
    const previous: Record<string, unknown> = {};
    const change = (field: keyof typeof existing, value: unknown) => {
      (updateData as Record<string, unknown>)[field] = value;
      previous[field] = existing[field];
    };

    if (pharmacyId !== undefined) change('pharmacyId', pharmacyId || null);
    if (durationDays !== undefined && durationDays !== null && durationDays !== existing.durationDays) {
      const days = Number(durationDays);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        sendError(res, 'The term must be a whole number of days from 1 to 3650.', 400);
        return;
      }
      if (existing.expiresAt || existing.activatedAt) {
        sendError(
          res,
          'This licence has already been activated, so its term no longer applies. Use Renew / extend to change its expiry date.',
          400
        );
        return;
      }
      change('durationDays', days);
    }
    if (maxActivations !== undefined && maxActivations !== null && maxActivations !== existing.maxActivations) {
      const seats = Number(maxActivations);
      if (!Number.isInteger(seats) || seats < 1 || seats > 1000) {
        sendError(res, 'The number of PCs must be a whole number from 1 to 1000.', 400);
        return;
      }
      change('maxActivations', seats);
    }
    if (notes !== undefined) change('notes', typeof notes === 'string' ? notes : null);
    if (features) change('features', features);

    const license = await prisma.license.update({
      where: { id },
      data: updateData,
      include: {
        pharmacy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'License',
        entityId: license.id,
        adminUserId: req.user?.id,
        description: `Updated license: ${maskLicenseKey(license.licenseKey)}`,
        previousValue: previous as Prisma.InputJsonValue,
        newValue: updateData as Prisma.InputJsonValue,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, withEffectiveStatus(license), 'License updated successfully');
  } catch (error) {
    console.error('Update license error:', error);
    sendError(res, 'Failed to update license', 500);
  }
}

/**
 * Revoke a license
 *
 * Final: every PC's activation is ended and the seats count drops to 0.
 */
export async function revokeLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const reason = reasonText(req.body?.reason);

    const outcome = await prisma.$transaction(async (tx): Promise<License | ActionRefusal | null> => {
      await lockLicence(tx, id);

      const license = await tx.license.findUnique({ where: { id } });
      if (!license) return null;
      if (license.status === LicenseStatus.REVOKED) {
        return { status: 400, error: 'License is already revoked' };
      }

      // Deactivate all activations (their ids go in the audit row, so a
      // mistaken revoke can be traced and undone by hand)
      const ended = await tx.licenseActivation.findMany({
        where: { licenseId: id, isActive: true },
        select: { id: true },
      });
      await tx.licenseActivation.updateMany({
        where: { id: { in: ended.map((a) => a.id) } },
        data: { isActive: false, deactivatedAt: new Date() },
      });

      const revoked = await tx.license.update({
        where: { id },
        data: {
          status: LicenseStatus.REVOKED,
          currentActivations: 0,
          notes: reason ? `${license.notes || ''}\nRevoked: ${reason}`.trim() : license.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.REVOKE,
          entityType: 'License',
          entityId: id,
          adminUserId: req.user?.id,
          description: `Revoked license: ${maskLicenseKey(license.licenseKey)}`,
          previousValue: { status: license.status, currentActivations: license.currentActivations },
          newValue: {
            status: LicenseStatus.REVOKED,
            reason,
            deactivatedActivationIds: ended.map((a) => a.id),
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      return revoked;
    }, LICENCE_TX_OPTIONS);

    if (!outcome) {
      sendNotFound(res, 'License');
      return;
    }
    if ('error' in outcome) {
      sendError(res, outcome.error, outcome.status);
      return;
    }

    sendSuccess(res, withEffectiveStatus(outcome), 'License revoked successfully');
  } catch (error) {
    console.error('Revoke license error:', error);
    sendError(res, 'Failed to revoke license', 500);
  }
}

/**
 * POST /licenses/:id/renew - renew or extend a licence
 *
 * Body: { extendDays } (1-3650) or { expiresAt } (ISO date), plus optional
 * note and allowShorten. See planRenewal for the rules: extends from the
 * expiry or today, whichever is later; EXPIRED becomes ACTIVE; SUSPENDED
 * stays SUSPENDED; REVOKED is refused (409, code LICENSE_REVOKED); an earlier
 * date needs allowShorten. Desktop apps pick the new expiry up at their next
 * check. Audited as UPDATE with newValue.kind 'renew'.
 */
export async function renewLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const request = parseRenewRequest(req.body);
    if (isRenewRefusal(request)) {
      sendError(res, request.error, request.status);
      return;
    }

    const outcome = await prisma.$transaction(async (tx) => {
      await lockLicence(tx, id);

      const license = await tx.license.findUnique({ where: { id } });
      if (!license) return null;

      const plan = planRenewal(license, request);
      if (isRenewRefusal(plan)) return plan;

      const updated = await tx.license.update({ where: { id }, data: plan.data });

      await tx.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entityType: 'License',
          entityId: id,
          adminUserId: req.user?.id,
          description: `Renewed licence ${maskLicenseKey(license.licenseKey)}: ${plan.summary}`,
          previousValue: plan.previous as unknown as Prisma.InputJsonValue,
          newValue: {
            kind: 'renew',
            ...(request.extendDays !== undefined
              ? { extendDays: request.extendDays }
              : { requestedExpiresAt: request.expiresAt?.toISOString(), allowShorten: request.allowShorten }),
            ...plan.next,
            expiresAt: plan.next.expiresAt?.toISOString() ?? null,
            note: request.note,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      return updated;
    }, LICENCE_TX_OPTIONS);

    if (!outcome) {
      sendNotFound(res, 'License');
      return;
    }
    if (isRenewRefusal(outcome)) {
      if (outcome.code) sendCodedError(res, outcome.status, outcome.code, outcome.error);
      else sendError(res, outcome.error, outcome.status);
      return;
    }

    sendSuccess(res, withEffectiveStatus(outcome), 'Licence renewed');
  } catch (error) {
    console.error('Renew license error:', error);
    sendError(res, 'Failed to renew the licence', 500);
  }
}

/**
 * POST /licenses/:id/suspend - stop a licence until the suspension is lifted
 *
 * Verify and activation answer 'License has been suspended'. Activations are
 * kept, so lifting the suspension puts every PC back as it was. Revoked
 * licences can't be suspended.
 */
export async function suspendLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const reason = reasonText(req.body?.reason);

    const outcome = await prisma.$transaction(async (tx): Promise<License | ActionRefusal | null> => {
      await lockLicence(tx, id);

      const license = await tx.license.findUnique({ where: { id } });
      if (!license) return null;
      if (license.status === LicenseStatus.REVOKED) {
        return { status: 409, error: "This licence has been revoked, so it can't be suspended." };
      }
      if (license.status === LicenseStatus.SUSPENDED) {
        return { status: 400, error: 'This licence is already suspended.' };
      }

      const updated = await tx.license.update({
        where: { id },
        data: {
          status: LicenseStatus.SUSPENDED,
          notes: reason ? `${license.notes || ''}\nSuspended: ${reason}`.trim() : license.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.DEACTIVATE,
          entityType: 'License',
          entityId: id,
          adminUserId: req.user?.id,
          description: `Suspended licence ${maskLicenseKey(license.licenseKey)}`,
          previousValue: { status: license.status },
          newValue: { kind: 'suspend', status: LicenseStatus.SUSPENDED, reason },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      return updated;
    }, LICENCE_TX_OPTIONS);

    if (!outcome) {
      sendNotFound(res, 'License');
      return;
    }
    if ('error' in outcome) {
      sendError(res, outcome.error, outcome.status);
      return;
    }

    sendSuccess(res, withEffectiveStatus(outcome), 'Licence suspended');
  } catch (error) {
    console.error('Suspend license error:', error);
    sendError(res, 'Failed to suspend the licence', 500);
  }
}

/**
 * POST /licenses/:id/unsuspend - lift a suspension
 *
 * The licence goes back to ACTIVE, or EXPIRED if its expiry date passed
 * meanwhile (renew it too), or INACTIVE if it was never activated.
 */
export async function unsuspendLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const reason = reasonText(req.body?.reason);

    const outcome = await prisma.$transaction(async (tx): Promise<License | ActionRefusal | null> => {
      await lockLicence(tx, id);

      const license = await tx.license.findUnique({ where: { id } });
      if (!license) return null;
      if (license.status !== LicenseStatus.SUSPENDED) {
        return { status: 400, error: 'This licence is not suspended.' };
      }

      const status = statusAfterSuspension(license);
      const updated = await tx.license.update({
        where: { id },
        data: {
          status,
          notes: reason ? `${license.notes || ''}\nSuspension lifted: ${reason}`.trim() : license.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.ACTIVATE,
          entityType: 'License',
          entityId: id,
          adminUserId: req.user?.id,
          description: `Lifted the suspension of licence ${maskLicenseKey(license.licenseKey)}`,
          previousValue: { status: license.status },
          newValue: { kind: 'unsuspend', status, reason },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      return updated;
    }, LICENCE_TX_OPTIONS);

    if (!outcome) {
      sendNotFound(res, 'License');
      return;
    }
    if ('error' in outcome) {
      sendError(res, outcome.error, outcome.status);
      return;
    }

    sendSuccess(res, withEffectiveStatus(outcome), 'Suspension lifted');
  } catch (error) {
    console.error('Unsuspend license error:', error);
    sendError(res, 'Failed to lift the suspension', 500);
  }
}

/**
 * POST /licenses/:id/activations/:activationId/deactivate - free one PC's seat
 *
 * For a PC that was replaced or lost: another PC can then be activated. The
 * licence itself is unchanged. Desktop apps up to 1.2.0 don't send their
 * activation when they check, so the old PC is not stopped by this.
 */
export async function deactivateActivation(req: Request, res: Response): Promise<void> {
  try {
    const { id, activationId } = req.params;
    const reason = reasonText(req.body?.reason);

    const outcome = await prisma.$transaction(async (tx): Promise<{ currentActivations: number } | ActionRefusal | null> => {
      await lockLicence(tx, id);

      const license = await tx.license.findUnique({ where: { id } });
      if (!license) return null;
      const activation = await tx.licenseActivation.findUnique({ where: { id: activationId } });
      if (!activation || activation.licenseId !== id) {
        return { status: 404, error: 'Activation not found for this licence.' };
      }
      if (!activation.isActive) {
        return { status: 400, error: 'This PC is already deactivated.' };
      }

      await tx.licenseActivation.update({
        where: { id: activationId },
        data: { isActive: false, deactivatedAt: new Date() },
      });
      const currentActivations = await countActiveActivations(tx, id);
      await tx.license.update({ where: { id }, data: { currentActivations } });

      await tx.auditLog.create({
        data: {
          action: AuditAction.DEACTIVATE,
          entityType: 'License',
          entityId: id,
          adminUserId: req.user?.id,
          description: `Deactivated PC ${activation.deviceName || activation.deviceId || activation.id} on licence ${maskLicenseKey(license.licenseKey)}`,
          newValue: {
            kind: 'deactivate-activation',
            activationId,
            deviceId: activation.deviceId,
            deviceName: activation.deviceName,
            reason,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      return { currentActivations };
    }, LICENCE_TX_OPTIONS);

    if (!outcome) {
      sendNotFound(res, 'License');
      return;
    }
    if ('error' in outcome) {
      sendError(res, outcome.error, outcome.status);
      return;
    }

    sendSuccess(res, outcome, 'PC deactivated');
  } catch (error) {
    console.error('Deactivate activation error:', error);
    sendError(res, 'Failed to deactivate the PC', 500);
  }
}

/**
 * Delete a license (soft delete by setting status)
 */
export async function deleteLicense(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const license = await prisma.license.findUnique({
      where: { id },
      include: { _count: { select: { activations: true } } },
    });

    if (!license) {
      sendNotFound(res, 'License');
      return;
    }

    // Only allow deletion if never activated
    if (license._count.activations > 0) {
      sendError(res, 'Cannot delete license that has been activated. Revoke it instead.', 400);
      return;
    }

    await prisma.license.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.DELETE,
        entityType: 'License',
        entityId: id,
        adminUserId: req.user?.id,
        description: `Deleted license: ${maskLicenseKey(license.licenseKey)}`,
        previousValue: { tier: license.tier, status: license.status },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    sendSuccess(res, null, 'License deleted successfully');
  } catch (error) {
    console.error('Delete license error:', error);
    sendError(res, 'Failed to delete license', 500);
  }
}

/**
 * Get license statistics
 */
export async function getLicenseStats(req: Request, res: Response): Promise<void> {
  try {
    const [
      totalLicenses,
      byTier,
      byStatus,
      recentActivations,
      recentVerifications,
    ] = await Promise.all([
      prisma.license.count(),
      prisma.license.groupBy({
        by: ['tier'],
        _count: { id: true },
      }),
      prisma.license.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.licenseActivation.count({
        where: {
          activatedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
      prisma.licenseVerification.count({
        where: {
          verifiedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const tierStats = Object.fromEntries(
      byTier.map((t) => [t.tier, t._count.id])
    );

    const statusStats = Object.fromEntries(
      byStatus.map((s) => [s.status, s._count.id])
    );

    sendSuccess(res, {
      total: totalLicenses,
      byTier: tierStats,
      byStatus: statusStats,
      last30Days: {
        activations: recentActivations,
        verifications: recentVerifications,
      },
    });
  } catch (error) {
    console.error('Get license stats error:', error);
    sendError(res, 'Failed to fetch license statistics', 500);
  }
}

const BASE_FEATURES = {
  stockAdjustments: true,
};

const STANDARD_FEATURES = {
  barcodeScanning: true,
  multiUser: true,
  cartHolding: true,
  cashReconciliation: true,
  expiryAlerts: true,
  lowStockAlerts: true,
  dashboardAnalytics: true,
  salesRefund: true,
};

const PROFESSIONAL_FEATURES = {
  fefoRecommendations: true,
  inventoryReports: true,
  suppliers: true,
  purchaseOrders: true,
  goodsReceiving: true,
  supplierInvoicing: true,
  notifications: true,
  customers: true,
  prescriptions: true,
  periodComparison: true,
  salesAnalytics: true,
  backupRestore: true,
  advancedReporting: true,
  auditLog: true,
  apiAccess: true,
  prioritySupport: true,
};


/**
 * Get features for a tier from the database
 * Falls back to hardcoded defaults if database features are not configured
 */
async function getTierFeaturesFromDb(tierCode: string): Promise<Record<string, unknown>> {
  try {
    // Fetch tier configuration with features
    const tierConfig = await prisma.licenseTierConfig.findUnique({
      where: { code: tierCode },
      include: {
        tierFeatures: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (tierConfig && tierConfig.tierFeatures.length > 0) {
      // Build features object from database
      const features: Record<string, unknown> = {
        // Include limits from tier config (the same values activation sends)
        ...tierLimits(tierConfig),
      };

      // Add feature flags
      for (const tf of tierConfig.tierFeatures) {
        features[tf.feature.key] = tf.isEnabled;
      }

      return features;
    }

    // Fall back to hardcoded defaults if no DB features configured
    // Only use fallback for known tiers
    if (['BASIC', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(tierCode)) {
      return getDefaultFeatures(tierCode as LicenseTier);
    }

    // For custom tiers without features, return minimal defaults
    return {
      maxUsers: 1,
      maxBranches: 1,
      maxProducts: 500,
    };
  } catch (error) {
    console.error('Error fetching tier features from DB:', error);
    if (['BASIC', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(tierCode)) {
      return getDefaultFeatures(tierCode as LicenseTier);
    }
    return { maxUsers: 1, maxBranches: 1, maxProducts: 500 };
  }
}

/**
 * Get default features for a tier (hardcoded fallback)
 * These feature keys map directly to the frontend's feature configuration
 */
function getDefaultFeatures(tier: LicenseTier) {
  switch (tier) {
    case 'BASIC':
      return {
        maxUsers: 1,
        maxBranches: 1,
        maxProducts: 500,
        ...BASE_FEATURES,
      };

    case 'STANDARD':
      return {
        maxUsers: 3,
        maxBranches: 1,
        maxProducts: 5000,
        ...BASE_FEATURES,
        ...STANDARD_FEATURES,
      };

    case 'PROFESSIONAL':
      return {
        maxUsers: 10,
        maxBranches: 3,
        maxProducts: -1,
        ...BASE_FEATURES,
        ...STANDARD_FEATURES,
        ...PROFESSIONAL_FEATURES,
      };

    case 'ENTERPRISE':
      return {
        maxUsers: -1,
        maxBranches: -1,
        maxProducts: -1,
        ...BASE_FEATURES,
        ...STANDARD_FEATURES,
        ...PROFESSIONAL_FEATURES,
      };
  }
}


export default {
  getLicenses,
  getLicense,
  generateLicense,
  generateBulkLicenses,
  updateLicense,
  revokeLicense,
  renewLicense,
  suspendLicense,
  unsuspendLicense,
  deactivateActivation,
  deleteLicense,
  getLicenseStats,
};
