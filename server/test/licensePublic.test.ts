// The public licence API (verify, activate, deactivate) against the
// in-memory Prisma stand-in. Import order matters: the fake first.
import { db } from './helpers/fakePrisma';
import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  call,
  daysFromNow,
  daysLeft,
  seedActivation,
  seedLicence,
  seedPlan,
  licenceRow,
  activeSeats,
} from './helpers/http';
import pub from '../src/controllers/licensePublic.controller';
import { generateLicenseKey } from '../src/utils/licenseKey';

const activate = (licenseKey: string, deviceId?: string, extra: Record<string, unknown> = {}) =>
  call(pub.activateLicense, {
    body: { licenseKey, deviceId, deviceName: deviceId, deviceFingerprint: `fp-${deviceId}`, ...extra },
  });
const verify = (licenseKey: string, extra: Record<string, unknown> = {}) =>
  call(pub.verifyLicense, { body: { licenseKey, deviceId: 'c4e7ba', ...extra } });
const deactivate = (licenseKey: string, body: Record<string, unknown>) =>
  call(pub.deactivateLicense, { body: { licenseKey, ...body } });

beforeEach(() => {
  db.reset();
  seedPlan('GOLD_TIER');
});

describe('activation keeps the first expiry (no free renewal)', () => {
  test('the first activation starts the term: expiresAt = now + durationDays, as answered', async () => {
    const licence = seedLicence({ durationDays: 365 });
    const answer = await activate(licence.licenseKey, 'pc-1');
    assert.equal(answer.status, 200);
    assert.equal(answer.body.message, 'License activated successfully');
    const row = licenceRow(licence.id);
    assert.equal(row.status, 'ACTIVE');
    assert.equal(daysLeft(row.expiresAt), 365);
    assert.equal(answer.body.data.license.expiresAt, row.expiresAt.toISOString());
    assert.equal(row.validUntil.getTime(), row.expiresAt.getTime());
    assert.equal(row.currentActivations, 1);
  });

  test('deactivate then activate again keeps the expiry', async () => {
    const licence = seedLicence({ durationDays: 365 });
    await activate(licence.licenseKey, 'pc-1');
    // 335 days later: 30 days left
    licenceRow(licence.id).expiresAt = daysFromNow(30);
    licenceRow(licence.id).validUntil = daysFromNow(30);

    assert.equal((await deactivate(licence.licenseKey, { deviceId: 'pc-1' })).status, 200);
    const again = await activate(licence.licenseKey, 'pc-1');
    assert.equal(again.status, 200);
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 30);
    assert.equal(daysLeft(again.body.data.license.expiresAt), 30);
  });

  test('a second PC on a multi-seat licence keeps the expiry', async () => {
    const licence = seedLicence({ maxActivations: 2 });
    await activate(licence.licenseKey, 'pc-1');
    licenceRow(licence.id).expiresAt = daysFromNow(10);
    const second = await activate(licence.licenseKey, 'pc-2');
    assert.equal(second.status, 200);
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 10);
    assert.equal(licenceRow(licence.id).currentActivations, 2);
  });

  test('an expiry already pushed out by an older server is honoured, not shortened', async () => {
    const licence = seedLicence({
      status: 'ACTIVE',
      maxActivations: 2,
      durationDays: 365,
      activatedAt: daysFromNow(-400),
      validFrom: daysFromNow(-400),
      expiresAt: daysFromNow(300),
      validUntil: daysFromNow(300),
    });
    seedActivation(licence, { deviceId: 'pc-1' });
    const answer = await activate(licence.licenseKey, 'pc-2');
    assert.equal(answer.status, 200);
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 300);
    // validFrom is the licence's, not the time of this activation
    assert.equal(answer.body.data.license.validFrom, licence.validFrom.toISOString());
  });
});

describe('activation refuses licences that are not usable', () => {
  test('ACTIVE but past its expiry date: 403 LICENSE_EXPIRED, marked EXPIRED, no seat used', async () => {
    const licence = seedLicence({
      status: 'ACTIVE',
      maxActivations: 2,
      activatedAt: daysFromNow(-400),
      expiresAt: daysFromNow(-35),
    });
    seedActivation(licence, { deviceId: 'pc-1' });
    const answer = await activate(licence.licenseKey, 'pc-9');
    assert.equal(answer.status, 403);
    assert.deepEqual(answer.body, { success: false, error: 'License has expired', code: 'LICENSE_EXPIRED' });
    assert.equal(licenceRow(licence.id).status, 'EXPIRED');
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), -35);
    assert.equal(activeSeats(licence.id).length, 1);
  });

  test('SUSPENDED with a free seat: 403 LICENSE_SUSPENDED and the suspension stays', async () => {
    const licence = seedLicence({ status: 'SUSPENDED' });
    const answer = await activate(licence.licenseKey, 'pc-1');
    assert.equal(answer.status, 403);
    assert.deepEqual(answer.body, { success: false, error: 'License has been suspended', code: 'LICENSE_SUSPENDED' });
    assert.equal(licenceRow(licence.id).status, 'SUSPENDED');
    assert.equal(db.table('licenseActivation').length, 0);
  });

  test('SUSPENDED, same PC, seats full: refused too (no "already activated")', async () => {
    const licence = seedLicence({ status: 'SUSPENDED', activatedAt: new Date(), expiresAt: daysFromNow(100) });
    seedActivation(licence, { deviceId: 'pc-1', deviceFingerprint: 'fp-pc-1' });
    const answer = await activate(licence.licenseKey, 'pc-1');
    assert.equal(answer.status, 403);
    assert.equal(answer.body.code, 'LICENSE_SUSPENDED');
  });

  test('REVOKED: 403 LICENSE_REVOKED', async () => {
    const licence = seedLicence({ status: 'REVOKED' });
    const answer = await activate(licence.licenseKey, 'pc-1');
    assert.equal(answer.status, 403);
    assert.deepEqual(answer.body, { success: false, error: 'License has been revoked', code: 'LICENSE_REVOKED' });
  });

  test('a pharmacy that is not active: the 1.1.0 text, with a code', async () => {
    const pharmacy = db.insert('pharmacy', { name: 'P', email: 'p@example.com', status: 'PENDING' });
    const licence = seedLicence({ pharmacyId: pharmacy.id });
    const answer = await activate(licence.licenseKey, 'pc-1');
    assert.equal(answer.status, 403);
    assert.deepEqual(answer.body, {
      success: false,
      error: 'Pharmacy account is pending. Contact support to reactivate.',
      code: 'PHARMACY_PENDING',
    });
  });
});

describe('seats', () => {
  test('the same PC activating twice keeps one seat and the expiry; a second PC still fits', async () => {
    const licence = seedLicence({ maxActivations: 2 });
    const first = await activate(licence.licenseKey, 'pc-1');
    licenceRow(licence.id).expiresAt = daysFromNow(50);
    const again = await activate(licence.licenseKey, 'pc-1');
    assert.equal(again.status, 200);
    assert.equal(again.body.message, 'Device already activated');
    assert.equal(again.body.data.alreadyActivated, true);
    assert.equal(again.body.data.activation.id, first.body.data.activation.id);
    assert.equal(activeSeats(licence.id).length, 1);
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 50);

    const second = await activate(licence.licenseKey, 'pc-2');
    assert.equal(second.status, 200);
    assert.equal(activeSeats(licence.id).length, 2);
  });

  test('another PC with the same hardware fingerprint does not share a seat', async () => {
    const licence = seedLicence({ maxActivations: 1 });
    await activate(licence.licenseKey, 'pc-1', { deviceFingerprint: 'same-laptop-model' });
    const other = await activate(licence.licenseKey, 'pc-2', { deviceFingerprint: 'same-laptop-model' });
    assert.equal(other.status, 403);
    assert.deepEqual(other.body, {
      success: false,
      error: 'Maximum activations reached for this license',
      code: 'ACTIVATION_LIMIT_REACHED',
    });
  });

  test('two PCs activating at the same time on a 1-seat licence: only one gets it', async () => {
    const licence = seedLicence({ maxActivations: 1 });
    const answers = await Promise.all([activate(licence.licenseKey, 'pc-1'), activate(licence.licenseKey, 'pc-2')]);
    assert.deepEqual(answers.map((a) => a.status).sort(), [200, 403]);
    assert.equal(answers.find((a) => a.status === 403)!.body.code, 'ACTIVATION_LIMIT_REACHED');
    assert.equal(activeSeats(licence.id).length, 1);
    assert.equal(licenceRow(licence.id).currentActivations, 1);
  });

  test('the same PC activating twice at the same time (a double click) gets one seat', async () => {
    const licence = seedLicence({ maxActivations: 2 });
    const answers = await Promise.all([activate(licence.licenseKey, 'pc-1'), activate(licence.licenseKey, 'pc-1')]);
    assert.deepEqual(answers.map((a) => a.status), [200, 200]);
    assert.deepEqual(answers.map((a) => a.body.message).sort(), ['Device already activated', 'License activated successfully']);
    assert.equal(activeSeats(licence.id).length, 1);
    assert.equal(answers[0].body.data.activation.id, answers[1].body.data.activation.id);
  });

  test('activation and its writes run in one transaction with the licence row locked', async () => {
    const licence = seedLicence();
    await activate(licence.licenseKey, 'pc-1');
    const [lockTx] = db.ops.filter((op) => op.model === '$queryRaw' && /FOR UPDATE/.test(op.action)).map((op) => op.txId);
    assert.ok(lockTx);
    assert.deepEqual(db.txIdsOf('licenseActivation', 'create'), [lockTx]);
    assert.deepEqual(db.txIdsOf('license', 'update'), [lockTx]);
    assert.deepEqual(db.txIdsOf('auditLog', 'create'), [lockTx]);
    const txOptions = db.ops.find((op) => op.model === '$transaction' && op.txId === lockTx)!.args.options;
    assert.deepEqual(txOptions, { maxWait: 10_000, timeout: 15_000 });
  });

  test('deactivating a PC recounts the seats (never below 0) and frees a duplicate seat too', async () => {
    const licence = seedLicence({ status: 'ACTIVE', maxActivations: 3, currentActivations: 0, activatedAt: new Date(), expiresAt: daysFromNow(100) });
    seedActivation(licence, { deviceId: 'pc-1' });
    seedActivation(licence, { deviceId: 'pc-1' }); // two seats for one PC (older servers)
    seedActivation(licence, { deviceId: 'pc-2' });
    const answer = await deactivate(licence.licenseKey, { deviceId: 'pc-1' });
    assert.equal(answer.status, 200);
    assert.equal(answer.body.message, 'License deactivated successfully');
    assert.equal(activeSeats(licence.id).length, 1);
    assert.equal(licenceRow(licence.id).currentActivations, 1);
  });
});

describe('deactivate stays open for every status (1.2.0 relies on it)', () => {
  for (const status of ['SUSPENDED', 'EXPIRED'] as const) {
    test(`${status}: 200`, async () => {
      const licence = seedLicence({ status, activatedAt: new Date(), expiresAt: daysFromNow(-1) });
      seedActivation(licence, { deviceId: 'pc-1' });
      const answer = await deactivate(licence.licenseKey, { deviceId: 'pc-1' });
      assert.equal(answer.status, 200);
    });
  }

  test('texts unchanged: no activation, unknown key, no device', async () => {
    const licence = seedLicence({ status: 'REVOKED' });
    assert.deepEqual((await deactivate(licence.licenseKey, { deviceId: 'pc-1' })).body, {
      success: false,
      error: 'Active activation not found',
      code: 'ACTIVE_ACTIVATION_NOT_FOUND',
    });
    const unknown = await deactivate(generateLicenseKey('STANDARD'), { deviceId: 'pc-1' });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error, 'License key not found');
    const noDevice = await deactivate(licence.licenseKey, {});
    assert.equal(noDevice.status, 400);
    assert.equal(noDevice.body.error, 'Device ID or activation ID is required');
  });
});

describe('the plan must be readable: never "valid" without one', () => {
  const planCases: [string, () => void][] = [
    ['the plan does not exist', () => { db.table('licenseTierConfig').length = 0; }],
    ['the plan has no feature rows', () => { db.table('tierFeature').length = 0; }],
    ['the plan read fails', () => {
      db.failWhen = (model) => (model === 'licenseTierConfig' ? new Error("Can't reach database server") : undefined);
    }],
  ];

  for (const [name, breakPlan] of planCases) {
    test(`verify when ${name}: 500 PLAN_UNAVAILABLE, logged as not valid`, async () => {
      const licence = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(100) });
      breakPlan();
      const answer = await verify(licence.licenseKey);
      assert.equal(answer.status, 500);
      assert.deepEqual(answer.body, {
        success: false,
        error: "The licence server could not read this licence's plan. Try again later.",
        code: 'PLAN_UNAVAILABLE',
      });
      const logged = db.table('licenseVerification');
      assert.equal(logged.length, 1);
      assert.equal(logged[0].isValid, false);
      assert.equal(logged[0].message, 'Plan unavailable');
    });

    test(`activation when ${name}: 500 PLAN_UNAVAILABLE, no seat used`, async () => {
      const licence = seedLicence();
      breakPlan();
      const answer = await activate(licence.licenseKey, 'pc-1');
      assert.equal(answer.status, 500);
      assert.equal(answer.body.code, 'PLAN_UNAVAILABLE');
      assert.equal(db.table('licenseActivation').length, 0);
      assert.equal(licenceRow(licence.id).status, 'INACTIVE');
      assert.equal(licenceRow(licence.id).expiresAt, null);
    });
  }

  test('a custom-plan licence that lost its plan code is not handed the free plan', async () => {
    seedPlan('BASIC', { stockAdjustments: true }, { maxUsers: 1, maxBranches: 1, maxProducts: 500 });
    const licence = seedLicence({ tier: 'BASIC', tierCode: null, status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(100) });
    const answer = await verify(licence.licenseKey);
    assert.equal(answer.status, 500);
    assert.equal(answer.body.code, 'PLAN_UNAVAILABLE');
  });

  test('a licence from before plan codes still uses its enum tier', async () => {
    seedPlan('STANDARD', { customers: true }, { maxUsers: 3, maxBranches: 1, maxProducts: 5000 });
    const licence = seedLicence({ tier: 'STANDARD', tierCode: null, status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(100) });
    const answer = await verify(licence.licenseKey);
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.body.data.license.features, { maxUsers: 3, maxBranches: 1, maxProducts: 5000, customers: true });
  });
});

describe('verify', () => {
  test('a valid licence: the same answer as before (plan from Tier Configs)', async () => {
    const licence = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(100) });
    const answer = await verify(licence.licenseKey);
    assert.equal(answer.status, 200);
    assert.equal(answer.body.success, true);
    assert.equal(answer.body.message, 'License is valid');
    assert.equal(answer.body.data.valid, true);
    assert.deepEqual(answer.body.data.license.features, { maxUsers: 5, maxBranches: 1, maxProducts: -1, customers: true, backupRestore: true });
    assert.equal(answer.body.data.license.tierCode, 'GOLD_TIER');
    assert.equal(answer.body.data.license.status, 'ACTIVE');
    assert.equal(answer.body.data.pharmacy, null);
    assert.equal(db.table('licenseVerification')[0].message, 'License valid');
    assert.equal(db.table('licenseVerification')[0].deviceId, 'c4e7ba');
  });

  test('every refusal keeps the exact text 1.1.0/1.2.0 desktops match, plus a code', async () => {
    const pending = db.insert('pharmacy', { name: 'P', email: 'p@example.com', status: 'PENDING' });
    const suspended = db.insert('pharmacy', { name: 'S', email: 's@example.com', status: 'SUSPENDED' });
    const deactivated = db.insert('pharmacy', { name: 'D', email: 'd@example.com', status: 'DEACTIVATED' });
    const live = { status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(100) };
    const cases: [string, number, string, string][] = [
      [seedLicence({ status: 'REVOKED' }).licenseKey, 403, 'LICENSE_REVOKED', 'License has been revoked'],
      [seedLicence({ status: 'SUSPENDED' }).licenseKey, 403, 'LICENSE_SUSPENDED', 'License has been suspended'],
      [seedLicence({ status: 'EXPIRED' }).licenseKey, 403, 'LICENSE_EXPIRED', 'License has expired'],
      [seedLicence({ ...live, expiresAt: daysFromNow(-1) }).licenseKey, 403, 'LICENSE_EXPIRED', 'License has expired'],
      [seedLicence({ ...live, pharmacyId: pending.id }).licenseKey, 403, 'PHARMACY_PENDING', 'Pharmacy account is not active'],
      [seedLicence({ ...live, pharmacyId: suspended.id }).licenseKey, 403, 'PHARMACY_SUSPENDED', 'Pharmacy account is not active'],
      [seedLicence({ ...live, pharmacyId: deactivated.id }).licenseKey, 403, 'PHARMACY_DEACTIVATED', 'Pharmacy account is not active'],
      [generateLicenseKey('STANDARD'), 404, 'LICENSE_NOT_FOUND', 'License key not found'],
      ['SAAA-AAAA-AAAA-AAAA-AAAA', 400, 'LICENSE_KEY_INVALID', 'Invalid license key checksum'],
      ['XAAA-AAAA-AAAA-AAAA-AAAA', 400, 'LICENSE_KEY_INVALID', 'Invalid license tier prefix'],
      ['not-a-key', 400, 'LICENSE_KEY_INVALID', 'Invalid license key format'],
      ['', 400, 'LICENSE_KEY_REQUIRED', 'License key is required'],
    ];
    for (const [key, status, code, error] of cases) {
      const answer = await verify(key);
      assert.equal(answer.status, status, `${code} status`);
      assert.deepEqual(answer.body, { success: false, error, code }, code);
    }
  });

  test('a licence past its date is marked EXPIRED', async () => {
    const licence = seedLicence({ status: 'ACTIVE', activatedAt: daysFromNow(-400), expiresAt: daysFromNow(-1) });
    await verify(licence.licenseKey);
    assert.equal(licenceRow(licence.id).status, 'EXPIRED');
  });

  test('without activationId (1.1.0/1.2.0) the activation is not checked', async () => {
    const licence = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(100) });
    seedActivation(licence, { deviceId: 'pc-1', isActive: false, deactivatedAt: new Date() });
    assert.equal((await verify(licence.licenseKey)).status, 200);
  });

  test('with activationId: unknown, another licence\'s or deactivated activations are refused', async () => {
    const licence = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(100) });
    const other = seedLicence({ status: 'ACTIVE', activatedAt: new Date(), expiresAt: daysFromNow(100) });
    const mine = seedActivation(licence, { deviceId: 'pc-1' });
    const theirs = seedActivation(other, { deviceId: 'pc-2' });
    const ended = seedActivation(licence, { deviceId: 'pc-3', isActive: false });

    assert.equal((await verify(licence.licenseKey, { activationId: mine.id })).status, 200);
    for (const activationId of ['no-such-activation', theirs.id]) {
      const answer = await verify(licence.licenseKey, { activationId });
      assert.equal(answer.status, 403);
      assert.deepEqual(answer.body, { success: false, error: 'This PC is not activated for this licence', code: 'ACTIVATION_NOT_FOUND' });
    }
    const inactive = await verify(licence.licenseKey, { activationId: ended.id });
    assert.equal(inactive.status, 403);
    assert.deepEqual(inactive.body, { success: false, error: "This PC's activation is no longer active", code: 'ACTIVATION_INACTIVE' });
  });

  test('revoked is answered before the activation check', async () => {
    const licence = seedLicence({ status: 'REVOKED' });
    const answer = await verify(licence.licenseKey, { activationId: 'no-such-activation' });
    assert.equal(answer.body.code, 'LICENSE_REVOKED');
  });
});
