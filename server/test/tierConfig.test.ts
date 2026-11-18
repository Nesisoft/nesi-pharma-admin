// Tier Configs: rewriting a plan's features must never be seen half done.
// Import order matters: the fake first.
import { db } from './helpers/fakePrisma';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { call, seedPlan } from './helpers/http';
import tierConfig from '../src/controllers/tierConfig.controller';

beforeEach(() => {
  db.reset();
});

test('sync replaces the plan\'s features in one transaction', async () => {
  const tier = seedPlan('GOLD_TIER', { customers: true, backupRestore: true });
  const extra = db.insert('feature', { key: 'prescriptions', name: 'Prescriptions' });
  const customers = db.table('feature').find((f) => f.key === 'customers')!;

  const answer = await call(tierConfig.syncTierFeatures, {
    params: { code: 'GOLD_TIER' },
    body: { featureIds: [customers.id, extra.id] },
  });
  assert.equal(answer.status, 200);

  const [deleteTx] = db.txIdsOf('tierFeature', 'deleteMany');
  assert.ok(deleteTx, 'the delete runs inside a transaction');
  assert.deepEqual(db.txIdsOf('tierFeature', 'createMany'), [deleteTx]);

  const enabled = Object.fromEntries(
    db.table('tierFeature')
      .filter((tf) => tf.tierId === tier.id)
      .map((tf) => [db.table('feature').find((f) => f.id === tf.featureId)!.key, tf.isEnabled])
  );
  assert.deepEqual(enabled, { customers: true, backupRestore: false, prescriptions: true });
});

test('switching single features updates them in one transaction', async () => {
  seedPlan('GOLD_TIER', { customers: true, backupRestore: true });
  const [customers, backups] = ['customers', 'backupRestore'].map((key) => db.table('feature').find((f) => f.key === key)!);

  const answer = await call(tierConfig.updateTierFeatures, {
    params: { code: 'GOLD_TIER' },
    body: { features: [{ featureId: customers.id, isEnabled: false }, { featureId: backups.id, isEnabled: false }] },
  });
  assert.equal(answer.status, 200);
  const txIds = db.txIdsOf('tierFeature', 'upsert');
  assert.equal(txIds.length, 2);
  assert.ok(txIds[0] && txIds.every((id) => id === txIds[0]));
  assert.ok(db.table('tierFeature').every((tf) => tf.isEnabled === false));
});
