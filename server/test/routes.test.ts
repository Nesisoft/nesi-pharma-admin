// The licence routes through the real Express app (wiring, roles, rate
// limits), against the in-memory Prisma stand-in. Import order matters: the fake first.
import { db } from './helpers/fakePrisma';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt';
import { generateLicenseKey } from '../src/utils/licenseKey';
import { daysFromNow, daysLeft, licenceRow, seedLicence, seedPlan } from './helpers/http';

let server: Server;
let base = '';

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

beforeEach(() => {
  db.reset();
  seedPlan('GOLD_TIER');
});

function tokenFor(role: 'ADMIN' | 'SUPPORT') {
  const user = db.insert('adminUser', {
    email: `${role.toLowerCase()}@example.com`,
    password: 'x',
    firstName: role,
    lastName: 'User',
    role,
  });
  return generateAccessToken({ userId: user.id, email: user.email, role });
}

async function post(path: string, body: unknown, token?: string) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('renew is wired and for admins only (support staff can only look)', async () => {
  const licence = seedLicence({ status: 'ACTIVE', activatedAt: daysFromNow(-300), expiresAt: daysFromNow(65) });

  const bySupport = await post(`/api/licenses/${licence.id}/renew`, { extendDays: 365 }, tokenFor('SUPPORT'));
  assert.equal(bySupport.status, 403);
  assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 65);

  const byAdmin = await post(`/api/licenses/${licence.id}/renew`, { extendDays: 365 }, tokenFor('ADMIN'));
  assert.equal(byAdmin.status, 200);
  assert.equal(daysLeft(licenceRow(licence.id).expiresAt), 430);
});

test('suspend, lift suspension and PC deactivation are wired for admins', async () => {
  const licence = seedLicence({ status: 'ACTIVE', activatedAt: daysFromNow(-1), expiresAt: daysFromNow(364) });
  const activation = db.insert('licenseActivation', { licenseId: licence.id, deviceId: 'pc-1' });
  const token = tokenFor('ADMIN');

  assert.equal((await post(`/api/licenses/${licence.id}/suspend`, {}, token)).status, 200);
  assert.equal((await post(`/api/licenses/${licence.id}/unsuspend`, {}, token)).status, 200);
  const freed = await post(`/api/licenses/${licence.id}/activations/${activation.id}/deactivate`, {}, token);
  assert.equal(freed.status, 200);
  assert.equal(freed.body.data.currentActivations, 0);
});

test('a public refusal carries its code through the app', async () => {
  const answer = await post('/api/public/license/verify', { licenseKey: generateLicenseKey('STANDARD'), deviceId: 'c4e7ba' });
  assert.equal(answer.status, 404);
  assert.deepEqual(answer.body, { success: false, error: 'License key not found', code: 'LICENSE_NOT_FOUND' });
});

// Last: it uses up this address's public quota for the minute
test('the public rate limit answers 429 with code RATE_LIMITED and the same text', async () => {
  let last = { status: 0, body: {} as Record<string, unknown> };
  for (let i = 0; i < 31; i++) {
    last = await post('/api/public/license/verify', { licenseKey: '' });
  }
  assert.equal(last.status, 429);
  assert.deepEqual(last.body, {
    success: false,
    error: 'Too many verification requests, please try again later.',
    code: 'RATE_LIMITED',
  });
});
