import { Response } from 'express';
import { PharmacyStatus } from '@prisma/client';
import { sendCodedError } from './apiResponse';

/**
 * The public licence API's refusals (/api/public/license/*): an HTTP status, a
 * machine code and an English text, sent as { success: false, error, code }.
 *
 * Installed desktop apps (1.1.0 and 1.2.0) know no codes except
 * LICENSE_REVOKED/SUSPENDED/EXPIRED and match some texts exactly (nesi-pharma
 * backend/src/services/licenceCheck.js REJECTION_TEXTS, and
 * src/services/license.js ALREADY_FREE_ON_SERVER for deactivation), and they
 * show activation errors as they are. So never reword an existing text: add a
 * new code instead. An unknown 403 is "could not check" for them, any 400/404
 * is "key not recognised" and any 5xx is "server problem" (nothing changes).
 */
export const LICENCE_ERRORS = {
  LICENSE_KEY_REQUIRED: { status: 400, message: 'License key is required' },
  // Format, tier prefix or checksum (validateLicenseKeyFormat's own text is sent)
  LICENSE_KEY_INVALID: { status: 400, message: 'Invalid license key format' },
  LICENSE_NOT_FOUND: { status: 404, message: 'License key not found' },
  LICENSE_REVOKED: { status: 403, message: 'License has been revoked' },
  LICENSE_SUSPENDED: { status: 403, message: 'License has been suspended' },
  LICENSE_EXPIRED: { status: 403, message: 'License has expired' },
  // Verify says 'Pharmacy account is not active'; activation names the status
  PHARMACY_PENDING: { status: 403, message: 'Pharmacy account is not active' },
  PHARMACY_SUSPENDED: { status: 403, message: 'Pharmacy account is not active' },
  PHARMACY_DEACTIVATED: { status: 403, message: 'Pharmacy account is not active' },
  ACTIVATION_LIMIT_REACHED: { status: 403, message: 'Maximum activations reached for this license' },
  // Verify, only when the request names its activation (activationId)
  ACTIVATION_NOT_FOUND: { status: 403, message: 'This PC is not activated for this licence' },
  ACTIVATION_INACTIVE: { status: 403, message: "This PC's activation is no longer active" },
  // Deactivate
  DEVICE_ID_REQUIRED: { status: 400, message: 'Device ID or activation ID is required' },
  ACTIVE_ACTIVATION_NOT_FOUND: { status: 404, message: 'Active activation not found' },
  // The licence's plan (tier and its features) could not be read: never
  // answer "valid" without a plan, and never use a seat for one
  PLAN_UNAVAILABLE: {
    status: 500,
    message: "The licence server could not read this licence's plan. Try again later.",
  },
  VERIFY_FAILED: { status: 500, message: 'License verification failed' },
  ACTIVATE_FAILED: { status: 500, message: 'License activation failed' },
  DEACTIVATE_FAILED: { status: 500, message: 'License deactivation failed' },
} as const;

export type LicenceErrorCode = keyof typeof LICENCE_ERRORS;

/** A refusal decided inside a transaction, sent after it ends */
export interface LicenceRefusal {
  refusal: LicenceErrorCode;
  message?: string;
}

export function refuse(code: LicenceErrorCode, message?: string): LicenceRefusal {
  return { refusal: code, message };
}

export function isRefusal(value: unknown): value is LicenceRefusal {
  return typeof value === 'object' && value !== null && 'refusal' in value;
}

export function sendLicenceError(res: Response, code: LicenceErrorCode, message?: string): Response {
  const { status, message: text } = LICENCE_ERRORS[code];
  return sendCodedError(res, status, code, message ?? text);
}

export function sendRefusal(res: Response, refusal: LicenceRefusal): Response {
  return sendLicenceError(res, refusal.refusal, refusal.message);
}

/** The code for a pharmacy that is not ACTIVE */
export function pharmacyRefusalCode(status: PharmacyStatus): LicenceErrorCode {
  switch (status) {
    case PharmacyStatus.PENDING:
      return 'PHARMACY_PENDING';
    case PharmacyStatus.SUSPENDED:
      return 'PHARMACY_SUSPENDED';
    default:
      return 'PHARMACY_DEACTIVATED';
  }
}

/** Activation's text for a pharmacy that is not ACTIVE (unchanged since 1.1.0) */
export function pharmacyActivationText(status: PharmacyStatus | null | undefined): string {
  const statusText = status ? status.toLowerCase() : 'inactive';
  return `Pharmacy account is ${statusText}. Contact support to reactivate.`;
}
