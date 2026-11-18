import { LicenseStatus } from '@prisma/client';
import { DAY_MS, addDays, isPastExpiry } from './licenseStatus';

export const MAX_EXTEND_DAYS = 3650;
// An explicit expiry date further out than this is a typo (2207 for 2027)
export const MAX_EXPIRY_YEARS_AHEAD = 20;
const MAX_DURATION_DAYS = 36500;
const MAX_NOTE_LENGTH = 500;

/** What the admin asked for: extend by a number of days, or set an expiry date */
export interface RenewRequest {
  extendDays?: number;
  expiresAt?: Date;
  note: string | null;
  allowShorten: boolean;
}

export interface RenewRefusal {
  status: number;
  error: string;
  code?: string;
}

export interface RenewPlan {
  data: {
    expiresAt?: Date;
    validUntil?: Date;
    durationDays?: number;
    status?: LicenseStatus;
  };
  previous: { expiresAt: Date | null; status: LicenseStatus; durationDays: number };
  next: { expiresAt: Date | null; status: LicenseStatus; durationDays: number };
  summary: string;
}

const isBlank = (value: unknown) => value === undefined || value === null || value === '';
const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : 'none');

/** Read and check POST /licenses/:id/renew's body */
export function parseRenewRequest(body: unknown): RenewRequest | RenewRefusal {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const hasDays = !isBlank(input.extendDays);
  const hasDate = !isBlank(input.expiresAt);

  if (hasDays && hasDate) {
    return { status: 400, error: 'Give either a number of days to extend by or a new expiry date, not both.' };
  }
  if (!hasDays && !hasDate) {
    return { status: 400, error: 'Give a number of days to extend by or a new expiry date.' };
  }

  const note = typeof input.note === 'string' && input.note.trim()
    ? input.note.trim().slice(0, MAX_NOTE_LENGTH)
    : null;
  const allowShorten = input.allowShorten === true;

  if (hasDays) {
    const extendDays = Number(input.extendDays);
    if (!Number.isInteger(extendDays) || extendDays < 1 || extendDays > MAX_EXTEND_DAYS) {
      return { status: 400, error: `Extend by a whole number of days from 1 to ${MAX_EXTEND_DAYS}.` };
    }
    return { extendDays, note, allowShorten };
  }

  const expiresAt = typeof input.expiresAt === 'string' ? new Date(input.expiresAt) : new Date(NaN);
  if (Number.isNaN(expiresAt.getTime())) {
    return { status: 400, error: 'The new expiry date is not a valid date.' };
  }
  return { expiresAt, note, allowShorten };
}

export function isRenewRefusal(value: unknown): value is RenewRefusal {
  return typeof value === 'object' && value !== null && 'error' in value;
}

/**
 * What a renewal changes (pure).
 *
 * - Revoked licences can't be renewed (generate a new licence).
 * - A licence that has started (has an expiry date) is extended from its
 *   expiry, or from today if that has passed, so paying early never loses
 *   days. An expired licence becomes ACTIVE again; a suspended one stays
 *   suspended (lifting a suspension is its own action).
 * - A new expiry date earlier than the current one needs allowShorten.
 * - A licence that was never activated has no expiry yet: its term (days from
 *   the first activation) grows instead.
 */
export function planRenewal(
  license: {
    status: LicenseStatus;
    expiresAt: Date | null;
    activatedAt: Date | null;
    durationDays: number;
  },
  request: RenewRequest,
  now = new Date()
): RenewPlan | RenewRefusal {
  if (license.status === LicenseStatus.REVOKED) {
    return {
      status: 409,
      code: 'LICENSE_REVOKED',
      error: "This licence has been revoked, so it can't be renewed. Generate a new licence instead.",
    };
  }

  const previous = {
    expiresAt: license.expiresAt,
    status: license.status,
    durationDays: license.durationDays,
  };

  // Not started yet: the term starts at the first activation
  if (license.expiresAt === null) {
    if (request.expiresAt) {
      return {
        status: 400,
        error:
          "This licence hasn't been activated yet, so its term starts when it is first activated. Extend it by a number of days instead.",
      };
    }
    const durationDays = license.durationDays + (request.extendDays ?? 0);
    if (durationDays > MAX_DURATION_DAYS) {
      return { status: 400, error: 'That would make the licence term longer than 100 years.' };
    }
    // Marked expired by hand before it ever started: it can be activated again
    const status = license.status === LicenseStatus.EXPIRED ? LicenseStatus.INACTIVE : license.status;
    return {
      data: { durationDays, ...(status !== license.status ? { status } : {}) },
      previous,
      next: { expiresAt: null, status, durationDays },
      summary: `term ${license.durationDays} -> ${durationDays} days (starts at first activation)`,
    };
  }

  let expiresAt: Date;
  if (request.extendDays !== undefined) {
    const base = isPastExpiry(license, now) ? now : license.expiresAt;
    expiresAt = addDays(base, request.extendDays);
  } else {
    expiresAt = request.expiresAt as Date;
    if (expiresAt.getTime() <= now.getTime()) {
      return { status: 400, error: 'The new expiry date must be in the future.' };
    }
    if (expiresAt.getTime() > now.getTime() + MAX_EXPIRY_YEARS_AHEAD * 365 * DAY_MS) {
      return { status: 400, error: `The new expiry date must be within ${MAX_EXPIRY_YEARS_AHEAD} years.` };
    }
    if (expiresAt.getTime() === license.expiresAt.getTime()) {
      return { status: 400, error: 'The licence already expires on that date.' };
    }
    if (expiresAt.getTime() < license.expiresAt.getTime() && !request.allowShorten) {
      return {
        status: 400,
        error: `That date is earlier than the current expiry date (${day(license.expiresAt)}). Tick "Allow shortening" to shorten the licence.`,
      };
    }
  }

  const status = license.status === LicenseStatus.EXPIRED ? LicenseStatus.ACTIVE : license.status;
  return {
    data: { expiresAt, validUntil: expiresAt, ...(status !== license.status ? { status } : {}) },
    previous,
    next: { expiresAt, status, durationDays: license.durationDays },
    summary: `expiry ${day(license.expiresAt)} -> ${day(expiresAt)}`,
  };
}

/**
 * The status a licence goes back to when its suspension is lifted: never
 * activated -> INACTIVE, past its expiry -> EXPIRED, otherwise ACTIVE.
 */
export function statusAfterSuspension(
  license: { expiresAt: Date | null; activatedAt: Date | null },
  now = new Date()
): LicenseStatus {
  if (license.activatedAt === null && license.expiresAt === null) return LicenseStatus.INACTIVE;
  if (isPastExpiry(license, now)) return LicenseStatus.EXPIRED;
  return LicenseStatus.ACTIVE;
}
