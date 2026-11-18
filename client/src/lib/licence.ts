import { addMonths, addYears, format } from 'date-fns';

// Licence statuses as the server reports them. effectiveStatus is the status
// a licence really has now: an ACTIVE licence past its expiry date is EXPIRED
// even before the server has marked it.
export const licenceStatusColors: Record<string, string> = {
  ACTIVE: 'badge-success',
  INACTIVE: 'badge-gray',
  EXPIRED: 'badge-warning',
  REVOKED: 'badge-danger',
  SUSPENDED: 'badge-warning',
};

export const licenceStatusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Not activated',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
  SUSPENDED: 'Suspended',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from now to a date (negative once it has passed) */
export function daysUntil(date: string | Date, now = new Date()): number {
  return Math.ceil((new Date(date).getTime() - now.getTime()) / DAY_MS);
}

/** "in 12 days", "today", "3 days ago" */
export function expiryHint(expiresAt: string | null, now = new Date()): string | null {
  if (!expiresAt) return null;
  const days = daysUntil(expiresAt, now);
  if (days > 1) return `in ${days} days`;
  if (days === 1) return 'tomorrow';
  if (days === 0) return 'today';
  if (days === -1) return 'yesterday';
  return `${-days} days ago`;
}

export const EXPIRING_SOON_DAYS = 30;

export type ExtendUnit = 'days' | 'months' | 'years';

/**
 * Days to send to the server for "extend by N days/months/years". Months and
 * years are calendar months and years from where the extension starts: the
 * current expiry, or today if that has passed (the server's rule).
 */
export function extendDaysFor(amount: number, unit: ExtendUnit, expiresAt: string | null, now = new Date()): number {
  if (unit === 'days') return amount;
  const base = renewalBase(expiresAt, now);
  const target = unit === 'months' ? addMonths(base, amount) : addYears(base, amount);
  return Math.round((target.getTime() - base.getTime()) / DAY_MS);
}

/** Where an extension starts: the current expiry, or now if it has passed */
export function renewalBase(expiresAt: string | null, now = new Date()): Date {
  const expiry = expiresAt ? new Date(expiresAt) : null;
  return expiry && expiry.getTime() > now.getTime() ? expiry : now;
}

/** The new expiry an extension by `days` gives (null for a licence that hasn't started) */
export function extendedExpiry(expiresAt: string | null, days: number, now = new Date()): Date | null {
  if (!expiresAt) return null;
  return new Date(renewalBase(expiresAt, now).getTime() + days * DAY_MS);
}

/** The end of a picked calendar day (YYYY-MM-DD from a date input), local time */
export function endOfPickedDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const formatDate = (date: string | Date) => format(new Date(date), 'd MMM yyyy');
