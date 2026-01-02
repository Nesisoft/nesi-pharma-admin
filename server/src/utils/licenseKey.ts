import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { LicenseTier } from '@prisma/client';
import config from '../config';

// License key format: XXXX-XXXX-XXXX-XXXX-XXXX (25 chars, 5 groups of 4)
// Prefix indicates tier: S=Standard, P=Professional, E=Enterprise

const TIER_PREFIXES: Record<LicenseTier, string> = {
  BASIC: 'B',
  STANDARD: 'S',
  PROFESSIONAL: 'P',
  ENTERPRISE: 'E',
};

const VALID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars like 0, O, I, 1

/**
 * Generate a random string of specified length using valid characters
 */
function generateRandomString(length: number): string {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += VALID_CHARS[bytes[i] % VALID_CHARS.length];
  }
  return result;
}

/**
 * Calculate checksum for license key validation
 */
function calculateChecksum(keyWithoutChecksum: string): string {
  const hash = crypto
    .createHmac('sha256', config.license.secretKey)
    .update(keyWithoutChecksum)
    .digest('hex');

  // Take first 4 characters and convert to our character set
  let checksum = '';
  for (let i = 0; i < 4; i++) {
    const charCode = parseInt(hash.substring(i * 2, i * 2 + 2), 16);
    checksum += VALID_CHARS[charCode % VALID_CHARS.length];
  }
  return checksum;
}

/**
 * Generate a new license key for the specified tier
 */
export function generateLicenseKey(tier: LicenseTier): string {
  const prefix = TIER_PREFIXES[tier];

  // Generate 4 groups of 4 random characters (total 16)
  const group1 = prefix + generateRandomString(3); // Tier prefix + 3 random
  const group2 = generateRandomString(4);
  const group3 = generateRandomString(4);
  const group4 = generateRandomString(4);

  // Calculate checksum based on first 4 groups
  const keyBase = `${group1}-${group2}-${group3}-${group4}`;
  const checksum = calculateChecksum(keyBase);

  return `${keyBase}-${checksum}`;
}

/**
 * Validate the format and checksum of a license key
 */
export function validateLicenseKeyFormat(licenseKey: string): {
  isValid: boolean;
  tier?: LicenseTier;
  error?: string;
} {
  // Remove any whitespace and convert to uppercase
  const key = licenseKey.trim().toUpperCase();

  // Check format: XXXX-XXXX-XXXX-XXXX-XXXX
  const formatRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!formatRegex.test(key)) {
    return { isValid: false, error: 'Invalid license key format' };
  }

  // Extract tier from first character
  const tierPrefix = key[0];
  const tier = Object.entries(TIER_PREFIXES).find(([, prefix]) => prefix === tierPrefix)?.[0] as LicenseTier | undefined;

  if (!tier) {
    return { isValid: false, error: 'Invalid license tier prefix' };
  }

  // Validate checksum
  const keyBase = key.substring(0, 19); // First 4 groups
  const providedChecksum = key.substring(20); // Last group
  const expectedChecksum = calculateChecksum(keyBase);

  if (providedChecksum !== expectedChecksum) {
    return { isValid: false, error: 'Invalid license key checksum' };
  }

  return { isValid: true, tier };
}

/**
 * Generate multiple license keys at once
 */
export function generateBulkLicenseKeys(tier: LicenseTier, count: number): string[] {
  const keys: string[] = [];
  const usedKeys = new Set<string>();

  while (keys.length < count) {
    const key = generateLicenseKey(tier);
    if (!usedKeys.has(key)) {
      usedKeys.add(key);
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Mask a license key for display (show only first and last groups)
 */
export function maskLicenseKey(licenseKey: string): string {
  const parts = licenseKey.split('-');
  if (parts.length !== 5) return licenseKey;

  return `${parts[0]}-****-****-****-${parts[4]}`;
}

export default {
  generateLicenseKey,
  validateLicenseKeyFormat,
  generateBulkLicenseKeys,
  maskLicenseKey,
};
