// Admin licence actions (renew, suspend, revoke, PC deactivation, edits and
// lists) against the in-memory Prisma stand-in. Import order matters: the fake first.
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
import admin from '../src/controllers/license.controller';
import pub from '../src/controllers/licensePublic.controller';
import dashboard from '../src/controllers/dashboard.controller';
import pharmacies from '../src/controllers/pharmacy.controller';
import { validateLicenseKeyFormat } from '../src/utils/licenseKey';

const renew = (id: string, body: Record<string, unknown>) => call(admin.renewLicense, { params: { id }, body });
const verify = (licenseKey: string) => call(pub.verifyLicense, { body: { licenseKey } });
const activate = (licenseKey: string, deviceId: string) =>
  call(pub.activateLicense, { body: { licenseKey, deviceId, deviceName: deviceId } });

/** A licence as GET /licenses lists it */
type Listed = { id: string; status: string; effectiveStatus: string };

const started = (fields: Record<string, unknown> = {}) =>
  seedLicence({ status: 'ACTIVE', activatedAt: daysFromNow(-335), validFrom: daysFromNow(-335), ...fields });

beforeEach(() => {
  db.reset();
  seedPlan('GOLD_TIER');
});

describe('renew / extend', () => {
  test('an active licence with 30 days left, extended by 365: 395 days left', async () => {
    const licence = started({ expiresAt: daysFromNow(30), validUntil: daysFromNow(30) });
    const answer = await renew(licence.id, { extendDays: 365 });
    assert.equal(answer.status, 200);
    const row = licenceRow(licence.id);
    assert.equal(daysLeft(row.expiresAt), 395);
    assert.equal(row.validUntil.getTime(), row.expiresAt.getTime());
    assert.equal(row.status, 'ACTIVE');
    assert.equal(answer.body.data.effectiveStatus, 'ACTIVE');
  });

  test('a licence that expired 35 days ago: today + 365, ACTIVE, and verify answers valid with the new date', async () => {
    const licence = started({ status: 'EXPIRED', expiresAt: daysFromNow(-35) });
    const answer = await renew(licence.id, { extendDays: 365 });
    assert.equal(answer.status, 200);
    assert.equal(licenceRow(licence.id).status, 'ACTIVE');
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 365);

    const check = await verify(licence.licenseKey);
    assert.equal(check.status, 200);
    assert.equal(check.body.data.valid, true);
    assert.equal(check.body.data.license.expiresAt, licenceRow(licence.id).expiresAt.toISOString());
  });

  test('an ACTIVE licence past its date (never verified since) is extended from today', async () => {
    const licence = started({ expiresAt: daysFromNow(-10) });
    await renew(licence.id, { extendDays: 30 });
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 30);
  });

  test('set an expiry date', async () => {
    const licence = started({ expiresAt: daysFromNow(30) });
    const target = daysFromNow(400);
    const answer = await renew(licence.id, { expiresAt: target.toISOString() });
    assert.equal(answer.status, 200);
    assert.equal(licenceRow(licence.id).expiresAt.getTime(), target.getTime());
  });

  test('a date in the past is refused', async () => {
    const licence = started({ expiresAt: daysFromNow(30) });
    const answer = await renew(licence.id, { expiresAt: daysFromNow(-1).toISOString() });
    assert.equal(answer.status, 400);
    assert.equal(answer.body.error, 'The new expiry date must be in the future.');
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 30);
  });

  test('shortening needs allowShorten', async () => {
    const licence = started({ expiresAt: daysFromNow(300) });
    const refused = await renew(licence.id, { expiresAt: daysFromNow(100).toISOString() });
    assert.equal(refused.status, 400);
    assert.match(refused.body.error, /earlier than the current expiry date .*Allow shortening/);
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 300);

    const allowed = await renew(licence.id, { expiresAt: daysFromNow(100).toISOString(), allowShorten: true });
    assert.equal(allowed.status, 200);
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 100);
  });

  test('a revoked licence: 409 LICENSE_REVOKED, nothing changes', async () => {
    const licence = started({ status: 'REVOKED', expiresAt: daysFromNow(30) });
    const answer = await renew(licence.id, { extendDays: 365 });
    assert.equal(answer.status, 409);
    assert.equal(answer.body.code, 'LICENSE_REVOKED');
    assert.equal(licenceRow(licence.id).status, 'REVOKED');
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 30);
    assert.equal(db.table('auditLog').length, 0);
  });

  test('a suspended licence is extended but stays suspended', async () => {
    const licence = started({ status: 'SUSPENDED', expiresAt: daysFromNow(30) });
    const answer = await renew(licence.id, { extendDays: 365 });
    assert.equal(answer.status, 200);
    assert.equal(licenceRow(licence.id).status, 'SUSPENDED');
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 395);
  });

  test('a never-activated licence: its term grows, and the first activation uses it', async () => {
    const licence = seedLicence({ durationDays: 365 });
    const answer = await renew(licence.id, { extendDays: 30 });
    assert.equal(answer.status, 200);
    assert.equal(licenceRow(licence.id).durationDays, 395);
    assert.equal(licenceRow(licence.id).expiresAt, null);
    assert.equal(licenceRow(licence.id).status, 'INACTIVE');

    const dated = await renew(licence.id, { expiresAt: daysFromNow(100).toISOString() });
    assert.equal(dated.status, 400);

    await activate(licence.licenseKey, 'pc-1');
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 395);
  });

  test('the request is checked: one of extendDays or expiresAt, in range', async () => {
    const licence = started({ expiresAt: daysFromNow(30) });
    for (const body of [
      {},
      { extendDays: 10, expiresAt: daysFromNow(60).toISOString() },
      { extendDays: 0 },
      { extendDays: 3651 },
      { extendDays: 1.5 },
      { expiresAt: 'next year' },
      { expiresAt: daysFromNow(365 * 25).toISOString() },
    ]) {
      const answer = await renew(licence.id, body);
      assert.equal(answer.status, 400, JSON.stringify(body));
    }
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 30);
    assert.equal((await renew('no-such-licence', { extendDays: 1 })).status, 404);
  });

  test('audited as UPDATE with newValue.kind renew, in the same transaction as the change', async () => {
    const licence = started({ expiresAt: daysFromNow(30) });
    await renew(licence.id, { extendDays: 365, note: 'Paid invoice 1042' });
    const [audit] = db.table('auditLog');
    assert.equal(audit.action, 'UPDATE');
    assert.equal(audit.entityId, licence.id);
    assert.equal(audit.adminUserId, 'admin-1');
    assert.equal(audit.newValue.kind, 'renew');
    assert.equal(audit.newValue.extendDays, 365);
    assert.equal(audit.newValue.note, 'Paid invoice 1042');
    assert.equal(audit.previousValue.status, 'ACTIVE');
    assert.match(audit.description, /^Renewed licence \w{4}-\*{4}-\*{4}-\*{4}-\w{4}: expiry \d{4}-\d\d-\d\d -> \d{4}-\d\d-\d\d$/);
    assert.ok(!JSON.stringify(audit).includes(licence.licenseKey), 'the key is masked');

    const [updateTx] = db.txIdsOf('license', 'update');
    assert.ok(updateTx);
    assert.deepEqual(db.txIdsOf('auditLog', 'create'), [updateTx]);
  });
});

describe('suspend and lift the suspension', () => {
  test('suspend: verify and activation refuse it; lifting it restores ACTIVE and the PCs', async () => {
    const licence = started({ expiresAt: daysFromNow(100), maxActivations: 2 });
    seedActivation(licence, { deviceId: 'pc-1' });

    const suspended = await call(admin.suspendLicense, { params: { id: licence.id }, body: { reason: 'Unpaid invoice' } });
    assert.equal(suspended.status, 200);
    assert.equal(licenceRow(licence.id).status, 'SUSPENDED');
    assert.equal((await verify(licence.licenseKey)).body.code, 'LICENSE_SUSPENDED');
    assert.equal((await activate(licence.licenseKey, 'pc-2')).body.code, 'LICENSE_SUSPENDED');
    assert.equal(activeSeats(licence.id).length, 1, 'activations are kept');

    const lifted = await call(admin.unsuspendLicense, { params: { id: licence.id } });
    assert.equal(lifted.status, 200);
    assert.equal(licenceRow(licence.id).status, 'ACTIVE');
    assert.equal((await verify(licence.licenseKey)).status, 200);

    const audits = db.table('auditLog').map((a) => [a.action, a.newValue?.kind]);
    assert.deepEqual(audits, [['DEACTIVATE', 'suspend'], ['ACTIVATE', 'unsuspend']]);
  });

  test('lifting a suspension after the expiry date passed gives EXPIRED; never activated gives INACTIVE', async () => {
    const lapsed = started({ status: 'SUSPENDED', expiresAt: daysFromNow(-5) });
    await call(admin.unsuspendLicense, { params: { id: lapsed.id } });
    assert.equal(licenceRow(lapsed.id).status, 'EXPIRED');

    const fresh = seedLicence({ status: 'SUSPENDED' });
    await call(admin.unsuspendLicense, { params: { id: fresh.id } });
    assert.equal(licenceRow(fresh.id).status, 'INACTIVE');
  });

  test('revoked licences cannot be suspended; only suspended ones can be lifted', async () => {
    const revoked = started({ status: 'REVOKED', expiresAt: daysFromNow(5) });
    assert.equal((await call(admin.suspendLicense, { params: { id: revoked.id } })).status, 409);
    assert.equal((await call(admin.unsuspendLicense, { params: { id: revoked.id } })).status, 400);
    assert.equal(licenceRow(revoked.id).status, 'REVOKED');
  });
});

describe('edit (PUT) and revoke', () => {
  test('PUT no longer changes the status', async () => {
    const licence = started({ status: 'REVOKED', expiresAt: daysFromNow(5) });
    const answer = await call(admin.updateLicense, { params: { id: licence.id }, body: { status: 'ACTIVE' } });
    assert.equal(answer.status, 400);
    assert.equal(licenceRow(licence.id).status, 'REVOKED');
  });

  test('PUT audits only what changed, with the key masked', async () => {
    const licence = seedLicence({ notes: 'old' });
    const answer = await call(admin.updateLicense, { params: { id: licence.id }, body: { notes: 'new', maxActivations: 3 } });
    assert.equal(answer.status, 200);
    const [audit] = db.table('auditLog');
    assert.deepEqual(audit.previousValue, { notes: 'old', maxActivations: 1 });
    assert.deepEqual(audit.newValue, { notes: 'new', maxActivations: 3 });
    assert.ok(!JSON.stringify(audit).includes(licence.licenseKey));
  });

  test('PUT changes the term only before the first activation', async () => {
    const fresh = seedLicence();
    assert.equal((await call(admin.updateLicense, { params: { id: fresh.id }, body: { durationDays: 730 } })).status, 200);
    assert.equal(licenceRow(fresh.id).durationDays, 730);

    const used = started({ expiresAt: daysFromNow(30) });
    const answer = await call(admin.updateLicense, { params: { id: used.id }, body: { durationDays: 730 } });
    assert.equal(answer.status, 400);
    assert.match(answer.body.error, /Renew \/ extend/);
  });

  test('revoke ends every activation and the seat count drops to 0', async () => {
    const licence = started({ expiresAt: daysFromNow(30), maxActivations: 2, currentActivations: 2 });
    const pc1 = seedActivation(licence, { deviceId: 'pc-1' });
    const pc2 = seedActivation(licence, { deviceId: 'pc-2' });
    seedActivation(licence, { deviceId: 'pc-0', isActive: false, deactivatedAt: daysFromNow(-90) });
    const answer = await call(admin.revokeLicense, { params: { id: licence.id }, body: { reason: 'Refund' } });
    assert.equal(answer.status, 200);
    assert.equal(licenceRow(licence.id).status, 'REVOKED');
    assert.equal(licenceRow(licence.id).currentActivations, 0);
    assert.equal(activeSeats(licence.id).length, 0);

    // The audit row names the PCs it ended (not the one ended earlier), in the same transaction
    const [audit] = db.table('auditLog');
    assert.equal(audit.action, 'REVOKE');
    assert.deepEqual(audit.newValue.deactivatedActivationIds.sort(), [pc1.id, pc2.id].sort());
    assert.equal(audit.newValue.reason, 'Refund');
    const [updateTx] = db.txIdsOf('license', 'update');
    assert.ok(updateTx);
    assert.deepEqual(db.txIdsOf('licenseActivation', 'updateMany'), [updateTx]);
    assert.deepEqual(db.txIdsOf('auditLog', 'create'), [updateTx]);

    // A second revoke (a double click) changes nothing
    const again = await call(admin.revokeLicense, { params: { id: licence.id } });
    assert.equal(again.status, 400);
    assert.equal(db.table('auditLog').length, 1);
  });
});

describe('deactivate one PC (admin)', () => {
  test('frees the seat so another PC can be activated', async () => {
    const licence = started({ expiresAt: daysFromNow(100), maxActivations: 1, currentActivations: 1 });
    const old = seedActivation(licence, { deviceId: 'dead-pc', deviceName: 'Front desk' });
    assert.equal((await activate(licence.licenseKey, 'new-pc')).body.code, 'ACTIVATION_LIMIT_REACHED');

    const answer = await call(admin.deactivateActivation, { params: { id: licence.id, activationId: old.id } });
    assert.equal(answer.status, 200);
    assert.equal(licenceRow(licence.id).currentActivations, 0);
    const [audit] = db.table('auditLog');
    assert.equal(audit.action, 'DEACTIVATE');
    assert.equal(audit.newValue.kind, 'deactivate-activation');

    assert.equal((await activate(licence.licenseKey, 'new-pc')).status, 200);
    assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 100, 'the expiry is kept');
  });

  test('another licence\'s activation or an inactive one is refused', async () => {
    const licence = started({ expiresAt: daysFromNow(100) });
    const other = started({ expiresAt: daysFromNow(100) });
    const theirs = seedActivation(other, { deviceId: 'pc-2' });
    const ended = seedActivation(licence, { deviceId: 'pc-3', isActive: false });
    assert.equal((await call(admin.deactivateActivation, { params: { id: licence.id, activationId: theirs.id } })).status, 404);
    assert.equal((await call(admin.deactivateActivation, { params: { id: licence.id, activationId: ended.id } })).status, 400);
    assert.equal(activeSeats(other.id).length, 1);
  });
});

describe('lists and the dashboard use the effective status', () => {
  const seedMix = () => {
    const live = started({ expiresAt: daysFromNow(100) });
    const soon = started({ expiresAt: daysFromNow(10) });
    const lapsed = started({ expiresAt: daysFromNow(-3) }); // ACTIVE in the database, but past its date
    const expired = started({ status: 'EXPIRED', expiresAt: daysFromNow(-40) });
    const unused = seedLicence();
    return { live, soon, lapsed, expired, unused };
  };

  test('status=EXPIRED includes licences past their date; ACTIVE excludes them; counts agree', async () => {
    const { live, soon, lapsed, expired } = seedMix();
    const expiredList = await call(admin.getLicenses, { query: { status: 'EXPIRED' } });
    assert.deepEqual(expiredList.body.data.map((l: Listed) => l.id).sort(), [lapsed.id, expired.id].sort());
    assert.equal(expiredList.body.meta.total, 2);
    assert.ok(expiredList.body.data.every((l: Listed) => l.effectiveStatus === 'EXPIRED'));

    const activeList = await call(admin.getLicenses, { query: { status: 'ACTIVE' } });
    assert.deepEqual(activeList.body.data.map((l: Listed) => l.id).sort(), [live.id, soon.id].sort());
    assert.equal(activeList.body.meta.total, 2);

    const all = await call(admin.getLicenses, {});
    assert.equal(all.body.meta.total, 5);
    assert.equal(all.body.data.find((l: Listed) => l.id === lapsed.id).status, 'ACTIVE');
    assert.equal(all.body.data.find((l: Listed) => l.id === lapsed.id).effectiveStatus, 'EXPIRED');
  });

  test('expiringWithinDays lists active licences that expire soon', async () => {
    const { soon } = seedMix();
    const answer = await call(admin.getLicenses, { query: { expiringWithinDays: '30' } });
    assert.deepEqual(answer.body.data.map((l: Listed) => l.id), [soon.id]);
  });

  test('the licence page carries the effective status', async () => {
    const { lapsed } = seedMix();
    const answer = await call(admin.getLicense, { params: { id: lapsed.id } });
    assert.equal(answer.body.data.status, 'ACTIVE');
    assert.equal(answer.body.data.effectiveStatus, 'EXPIRED');
  });

  test('the pharmacy page carries each licence\'s effective status', async () => {
    const pharmacy = db.insert('pharmacy', { name: 'P', email: 'p@example.com', status: 'ACTIVE' });
    const lapsed = started({ expiresAt: daysFromNow(-3), pharmacyId: pharmacy.id });
    const answer = await call(pharmacies.getPharmacy, { params: { id: pharmacy.id } });
    assert.equal(answer.status, 200);
    const [row] = answer.body.data.licenses;
    assert.equal(row.id, lapsed.id);
    assert.equal(row.status, 'ACTIVE');
    assert.equal(row.effectiveStatus, 'EXPIRED');
  });

  test('the dashboard counts active licences that have not passed their date', async () => {
    seedMix();
    const answer = await call(dashboard.getDashboardStats, {});
    assert.equal(answer.status, 200);
    assert.equal(answer.body.data.licenses.active, 2);
    assert.equal(answer.body.data.licenses.expiringSoon, 1);
  });
});

describe('licence keys', () => {
  test('a custom plan gets keys that validate (and so can be activated)', async () => {
    seedPlan('PLATINUM_PLUS');
    const one = await call(admin.generateLicense, { body: { tierCode: 'PLATINUM_PLUS' } });
    assert.equal(one.status, 201);
    assert.equal(validateLicenseKeyFormat(one.body.data.licenseKey).isValid, true);
    assert.equal(one.body.data.tierCode, 'PLATINUM_PLUS');
    assert.equal((await activate(one.body.data.licenseKey, 'pc-1')).status, 200);

    const bulk = await call(admin.generateBulkLicenses, { body: { tierCode: 'PLATINUM_PLUS', count: 3 } });
    assert.equal(bulk.status, 201);
    for (const { licenseKey } of bulk.body.data.licenses) {
      assert.equal(validateLicenseKeyFormat(licenseKey).isValid, true, licenseKey);
    }
  });

  test('standard plans keep their prefix', async () => {
    seedPlan('PROFESSIONAL');
    const answer = await call(admin.generateLicense, { body: { tierCode: 'PROFESSIONAL' } });
    assert.equal(answer.body.data.licenseKey[0], 'P');
  });
});

