/**
 * Signed licences (desktop 1.4.0 and later).
 *
 * The desktop app stores its licence in its own database, which anyone at the
 * PC can edit. From 1.4.0 it only trusts what this server signed:
 *
 * - a licence token, answered by activation and by every successful verify:
 *   the licence, the activation and the PC (device id) it was issued to, the
 *   plan's features and limits, and a lease: the PC must verify again before
 *   `until` (60 days), or its paid features switch off. A revoked licence gets
 *   no new token, so its last one runs out even if the PC's database is edited
 *   to forget the refusals.
 * - a free-plan token in GET /plans: the BASIC plan the app falls back to.
 *
 * Format: "v1.<payload>.<signature>", payload base64url JSON, signature
 * Ed25519 over "v1.<payload>" (base64url). The app checks it with the public
 * key built into it (nesi-pharma backend/src/constants/licencePublicKeys.js),
 * found by `kid`.
 *
 * The private key is LICENSE_SIGNING_KEY (PKCS#8 PEM; "\n" may be written as
 * the two characters \ and n, as Render's environment page needs). Without it
 * nothing is signed and installed 1.4.0 apps stay on the free plan, so set it
 * before releasing a 1.4.0 app. Make a pair with `npm run licence:keygen`.
 */
import { createHash, createPrivateKey, createPublicKey, KeyObject, sign, verify } from 'crypto';

export const TOKEN_PREFIX = 'v1';
export const LEASE_DAYS = 60;

export interface LicenceTokenClaims {
  typ: 'licence';
  kid: string;
  /** Licence id */
  lid: string;
  /** sha256 (hex) of the licence key, upper-cased and trimmed */
  khash: string;
  /** Activation id */
  aid: string;
  /** The device id of the PC the activation belongs to */
  dev: string;
  /** The plan (tierCode) and legacy tier */
  plan: string | null;
  tier: string;
  /** The plan's features, limits (maxUsers, maxBranches, maxProducts) included */
  features: Record<string, unknown>;
  /** The licence's expiry (ISO), null if none */
  exp: string | null;
  /** Issued at, and the end of the lease (ISO) */
  iat: string;
  until: string;
}

export interface FreePlanTokenClaims {
  typ: 'free_plan';
  kid: string;
  /** The plan as it appears in GET /plans: code, limits, features */
  plan: { code: string; limits: unknown; features: Record<string, unknown> };
  iat: string;
}

type Claims = LicenceTokenClaims | FreePlanTokenClaims;

const base64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

/** The key id of a public key: the first 16 hex digits of sha256(SPKI DER) */
export function keyId(publicKey: KeyObject): string {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(der).digest('hex').slice(0, 16);
}

/** A public key as the desktop app stores it: base64 SPKI DER */
export function publicKeyText(publicKey: KeyObject): string {
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}

/** The hash of a licence key that a token carries (never the key itself) */
export function licenceKeyHash(licenseKey: string): string {
  return createHash('sha256').update(licenseKey.trim().toUpperCase()).digest('hex');
}

interface SigningKey {
  privateKey: KeyObject;
  kid: string;
}

let loaded: { from: string | undefined; key: SigningKey | null } | null = null;

/** LICENSE_SIGNING_KEY as a key, or null when it isn't set (throws if it is set but unusable) */
export function signingKey(env: string | undefined = process.env.LICENSE_SIGNING_KEY): SigningKey | null {
  if (loaded && loaded.from === env) return loaded.key;
  let key: SigningKey | null = null;
  if (env && env.trim()) {
    const pem = env.includes('\\n') ? env.replace(/\\n/g, '\n') : env;
    const privateKey = createPrivateKey(pem);
    if (privateKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('LICENSE_SIGNING_KEY must be an Ed25519 private key');
    }
    key = { privateKey, kid: keyId(createPublicKey(privateKey)) };
  }
  loaded = { from: env, key };
  return key;
}

function signClaims(claims: Claims, key: SigningKey): string {
  const payload = base64url(JSON.stringify(claims));
  const signature = sign(null, Buffer.from(`${TOKEN_PREFIX}.${payload}`), key.privateKey);
  return `${TOKEN_PREFIX}.${payload}.${base64url(signature)}`;
}

export interface LicenceTokenInput {
  licence: { id: string; licenseKey: string; tier: string; tierCode: string | null; expiresAt: Date | null };
  activationId: string;
  deviceId: string;
  features: Record<string, unknown>;
  now?: Date;
}

/** A licence token, or null when no signing key is set */
export function signLicenceToken(input: LicenceTokenInput, key: SigningKey | null = signingKey()): string | null {
  if (!key) return null;
  const now = input.now ?? new Date();
  const until = new Date(now.getTime() + LEASE_DAYS * 24 * 60 * 60 * 1000);
  const claims: LicenceTokenClaims = {
    typ: 'licence',
    kid: key.kid,
    lid: input.licence.id,
    khash: licenceKeyHash(input.licence.licenseKey),
    aid: input.activationId,
    dev: input.deviceId,
    plan: input.licence.tierCode,
    tier: input.licence.tier,
    features: input.features,
    exp: input.licence.expiresAt ? input.licence.expiresAt.toISOString() : null,
    iat: now.toISOString(),
    until: until.toISOString(),
  };
  return signClaims(claims, key);
}

/** The free plan as a token, or null when no signing key is set */
export function signFreePlanToken(
  plan: FreePlanTokenClaims['plan'],
  { now = new Date(), key = signingKey() }: { now?: Date; key?: SigningKey | null } = {}
): string | null {
  if (!key) return null;
  return signClaims({ typ: 'free_plan', kid: key.kid, plan, iat: now.toISOString() }, key);
}

/**
 * A token's claims if its signature is good for this public key (for tests
 * and tools; the desktop app has its own check)
 */
export function readToken(token: string, publicKey: KeyObject): Claims | null {
  const [prefix, payload, signature] = String(token).split('.');
  if (prefix !== TOKEN_PREFIX || !payload || !signature) return null;
  const good = verify(null, Buffer.from(`${TOKEN_PREFIX}.${payload}`), publicKey, Buffer.from(signature, 'base64url'));
  if (!good) return null;
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Claims;
}
