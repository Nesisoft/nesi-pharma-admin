import { LicenseStatus, Prisma } from '@prisma/client';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Has the licence's expiry date passed? A licence without an expiry date
 * (never activated) never expires.
 */
export function isPastExpiry(license: { expiresAt: Date | null }, now = new Date()): boolean {
  return license.expiresAt !== null && license.expiresAt.getTime() <= now.getTime();
}

/**
 * The status a licence really has now. The stored status only becomes
 * EXPIRED when someone verifies or activates it after its expiry date, so an
 * ACTIVE (or INACTIVE) licence past its date is EXPIRED here. REVOKED and
 * SUSPENDED win over the date.
 */
export function effectiveStatus(
  license: { status: LicenseStatus; expiresAt: Date | null },
  now = new Date()
): LicenseStatus {
  if (
    (license.status === LicenseStatus.ACTIVE || license.status === LicenseStatus.INACTIVE) &&
    isPastExpiry(license, now)
  ) {
    return LicenseStatus.EXPIRED;
  }
  return license.status;
}

/** A licence as admin pages see it: the stored row plus its effective status */
export function withEffectiveStatus<T extends { status: LicenseStatus; expiresAt: Date | null }>(
  license: T,
  now = new Date()
): T & { effectiveStatus: LicenseStatus } {
  return { ...license, effectiveStatus: effectiveStatus(license, now) };
}

const notPastExpiry = (now: Date): Prisma.LicenseWhereInput => ({
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

/**
 * The where clause for "effective status is X", so list filters and their
 * counts agree with the badges (effectiveStatus above).
 */
export function effectiveStatusWhere(status: LicenseStatus, now = new Date()): Prisma.LicenseWhereInput {
  switch (status) {
    case LicenseStatus.EXPIRED:
      return {
        OR: [
          { status: LicenseStatus.EXPIRED },
          {
            status: { in: [LicenseStatus.ACTIVE, LicenseStatus.INACTIVE] },
            expiresAt: { lte: now },
          },
        ],
      };
    case LicenseStatus.ACTIVE:
    case LicenseStatus.INACTIVE:
      return { AND: [{ status }, notPastExpiry(now)] };
    default:
      return { status };
  }
}

/** Active licences whose expiry date falls within the next `days` days */
export function expiringWithinWhere(days: number, now = new Date()): Prisma.LicenseWhereInput {
  return {
    status: LicenseStatus.ACTIVE,
    expiresAt: { gt: now, lte: addDays(now, days) },
  };
}

/** Active licences that have not passed their expiry date */
export function activeNowWhere(now = new Date()): Prisma.LicenseWhereInput {
  return effectiveStatusWhere(LicenseStatus.ACTIVE, now);
}
