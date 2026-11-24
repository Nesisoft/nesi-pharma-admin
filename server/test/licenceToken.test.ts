// Signed licences (utils/licenceToken.ts): activation and verify answer a
// licence signed for the PC, verify refuses another PC (desktop 1.4.0+ only),
// and GET /plans signs the free plan. Import order matters: the fake first.
import { db } from './helpers/fakePrisma';
import { test, beforeEach, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey } from 'crypto';
import { call, seedActivation, seedLicence, seedPlan, daysFromNow } from './helpers/http';
import pub from '../src/controllers/licensePublic.controller';
import {
  LEASE_DAYS,
  keyId,
  licenceKeyHash,
  publicKeyText,
  readToken,
  signingKey,
  signLicenceToken,
} from '../src/utils/licenceToken';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const KID = keyId(publicKey);
const DAY = 24 * 60 * 60 * 1000;

const activate = (licenseKey: string, deviceId?: string) =>
  call(pub.activateLicense, { body: { licenseKey, deviceId, deviceName: deviceId } });
const verify = (licenseKey: string, body: Record<string, unknown>) =>
  call(pub.verifyLicense, { body: { licenseKey, ...body } });
const claimsOf = (token: string) => {
  const claims = readToken(token, publicKey);
  assert.ok(claims, 'the token is signed by the test key');
  return claims as any;
};

let savedKey: string | undefined;
beforeEach(() => {
  db.reset();
  seedPlan('GOLD_TIER', { customers: true, backupRestore: true }, { maxUsers: 5, maxBranches: 1, maxProducts: null });
  savedKey = process.env.LICENSE_SIGNING_KEY;
  process.env.LICENSE_SIGNING_KEY = PEM;
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.LICENSE_SIGNING_KEY;
  else process.env.LICENSE_SIGNING_KEY = savedKey;
});

describe('the signing key', () => {
  test('is read from LICENSE_SIGNING_KEY, also written on one line with \\n', () => {
    assert.equal(signingKey(PEM)?.kid, KID);
    assert.equal(signingKey(PEM.trim().replace(/\n/g, '\\n'))?.kid, KID);
    assert.equal(signingKey(''), null);
    assert.equal(signingKey('  '), null);
  });

  test('must be an Ed25519 key', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    assert.throws(() => signingKey(rsa), /Ed25519/);
    assert.throws(() => signingKey('not a key'));
  });

  test('the public key text is base64 SPKI DER, as the desktop app reads it', () => {
    const text = publicKeyText(publicKey);
    const back = createPublicKey({ key: Buffer.from(text, 'base64'), format: 'der', type: 'spki' });
    assert.equal(keyId(back), KID);
  });
});

describe('a licence token', () => {
  test('carries the licence, the PC, the plan and a 60-day lease', () => {
    const now = new Date('2026-12-01T10:00:00.000Z');
    const token = signLicenceToken({
      licence: { id: 'lic-1', licenseKey: ' s-abcd-efgh ', tier: 'BASIC', tierCode: 'GOLD_TIER', expiresAt: new Date('2027-12-01T00:00:00.000Z') },
      activationId: 'act-1',
      deviceId: 'pc-1',
      features: { customers: true, maxUsers: 5 },
      now,
    }, signingKey(PEM))!;
    assert.match(token, /^v1\.[\w-]+\.[\w-]+$/);
    assert.deepEqual(claimsOf(token), {
      typ: 'licence',
      kid: KID,
      lid: 'lic-1',
      khash: licenceKeyHash('S-ABCD-EFGH'),
      aid: 'act-1',
      dev: 'pc-1',
      plan: 'GOLD_TIER',
      tier: 'BASIC',
      features: { customers: true, maxUsers: 5 },
      exp: '2027-12-01T00:00:00.000Z',
      iat: '2026-12-01T10:00:00.000Z',
      until: new Date(now.getTime() + LEASE_DAYS * DAY).toISOString(),
    });
  });

  test('a changed payload no longer matches its signature', () => {
    const token = signLicenceToken({
      licence: { id: 'lic-1', licenseKey: 'K', tier: 'BASIC', tierCode: null, expiresAt: null },
      activationId: 'act-1',
      deviceId: 'pc-1',
      features: { customers: true },
    }, signingKey(PEM))!;
    const [prefix, payload, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    claims.features.reports = true;
    const forged = `${prefix}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`;
    assert.equal(readToken(forged, publicKey), null);
  });

  test('is not made without a signing key', () => {
    assert.equal(signLicenceToken({
      licence: { id: 'lic-1', licenseKey: 'K', tier: 'BASIC', tierCode: null, expiresAt: null },
      activationId: 'a', deviceId: 'd', features: {},
    }, null), null);
  });
});

describe('activation answers a signed licence for the PC', () => {
  test('a new seat and the same PC again', async () => {
    const licence = seedLicence({ durationDays: 365 });
    const first = await activate(licence.licenseKey, 'pc-1');
    assert.equal(first.status, 200);
    const claims = claimsOf(first.body.data.token);
    assert.equal(claims.dev, 'pc-1');
    assert.equal(claims.aid, first.body.data.activation.id);
    assert.equal(claims.lid, licence.id);
    assert.equal(claims.khash, licenceKeyHash(licence.licenseKey));
    assert.deepEqual(claims.features, first.body.data.license.features);
    assert.equal(claims.exp, first.body.data.license.expiresAt);

    const again = await activate(licence.licenseKey, 'pc-1');
    assert.equal(again.body.data.alreadyActivated, true);
    assert.equal(claimsOf(again.body.data.token).aid, first.body.data.activation.id);
  });

  test('no token without a device id, or without a signing key', async () => {
    const licence = seedLicence({ maxActivations: 2 });
    const noDevice = await call(pub.activateLicense, { body: { licenseKey: licence.licenseKey, deviceFingerprint: 'fp' } });
    assert.equal(noDevice.status, 200);
    assert.equal(noDevice.body.data.token, null);

    delete process.env.LICENSE_SIGNING_KEY;
    const unsigned = await activate(licence.licenseKey, 'pc-2');
    assert.equal(unsigned.status, 200);
    assert.equal(unsigned.body.data.token, null);
  });
});

describe('verify answers a signed licence for the PC that holds the seat', () => {
  test('desktop 1.4.0 on its own PC: a fresh token with a new lease', async () => {
    const licence = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(300) });
    const seat = seedActivation(licence, { deviceId: 'pc-1' });
    const answer = await verify(licence.licenseKey, { activationId: seat.id, deviceId: 'pc-1', tokenVersion: 1 });
    assert.equal(answer.status, 200, JSON.stringify(answer.body));
    const claims = claimsOf(answer.body.data.token);
    assert.equal(claims.dev, 'pc-1');
    assert.equal(claims.aid, seat.id);
    assert.ok(Math.abs(new Date(claims.until).getTime() - Date.now() - LEASE_DAYS * DAY) < 60_000);
  });

  test('another PC with the same activation is refused (a copy of the data)', async () => {
    const licence = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(300) });
    const seat = seedActivation(licence, { deviceId: 'pc-1' });
    const answer = await verify(licence.licenseKey, { activationId: seat.id, deviceId: 'pc-2', tokenVersion: 1 });
    assert.equal(answer.status, 403);
    assert.deepEqual(answer.body, { success: false, error: 'This licence is activated on another PC', code: 'ACTIVATION_OTHER_DEVICE' });
  });

  test('an activation that never recorded its PC belongs to the first one that asks', async () => {
    const licence = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(300) });
    const seat = seedActivation(licence, { deviceId: null });
    const first = await verify(licence.licenseKey, { activationId: seat.id, deviceId: 'pc-1', tokenVersion: 1 });
    assert.equal(first.status, 200);
    assert.equal(claimsOf(first.body.data.token).dev, 'pc-1');
    const other = await verify(licence.licenseKey, { activationId: seat.id, deviceId: 'pc-2', tokenVersion: 1 });
    assert.equal(other.body.code, 'ACTIVATION_OTHER_DEVICE');
  });

  test('older apps (no tokenVersion) are answered as before, whatever their device id', async () => {
    const licence = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(300) });
    const seat = seedActivation(licence, { deviceId: 'pc-1' });
    const answer = await verify(licence.licenseKey, { activationId: seat.id, deviceId: 'somewhere-else' });
    assert.equal(answer.status, 200);
    assert.equal(answer.body.data.valid, true);
    assert.equal('token' in answer.body.data, false);
  });

  test('without its activation id a 1.4.0 app gets no token (it must activate)', async () => {
    const licence = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(300) });
    const answer = await verify(licence.licenseKey, { deviceId: 'pc-1', tokenVersion: 1 });
    assert.equal(answer.status, 200);
    assert.equal(answer.body.data.token, null);
  });

  test('a revoked licence gets no token', async () => {
    const licence = seedLicence({ status: 'REVOKED', activatedAt: new Date(), expiresAt: daysFromNow(300) });
    const seat = seedActivation(licence, { deviceId: 'pc-1' });
    const answer = await verify(licence.licenseKey, { activationId: seat.id, deviceId: 'pc-1', tokenVersion: 1 });
    assert.equal(answer.status, 403);
    assert.equal(answer.body.code, 'LICENSE_REVOKED');
    assert.equal(answer.body.data, undefined);
  });
});

describe('GET /plans signs the free plan', () => {
  test('the BASIC plan as listed, signed', async () => {
    seedPlan('BASIC', { customers: true, backupRestore: false }, { maxUsers: 1, maxBranches: 1, maxProducts: 50 });
    const answer = await call(pub.getPlans);
    assert.equal(answer.status, 200);
    const basic = answer.body.data.plans.find((plan: any) => plan.code === 'BASIC');
    const claims = claimsOf(answer.body.data.freePlanToken);
    assert.equal(claims.typ, 'free_plan');
    assert.deepEqual(claims.plan, { code: 'BASIC', limits: basic.limits, features: basic.features });
  });

  test('no BASIC plan, or no key: no token', async () => {
    assert.equal((await call(pub.getPlans)).body.data.freePlanToken, null);
    seedPlan('BASIC');
    delete process.env.LICENSE_SIGNING_KEY;
    assert.equal((await call(pub.getPlans)).body.data.freePlanToken, null);
  });
});
