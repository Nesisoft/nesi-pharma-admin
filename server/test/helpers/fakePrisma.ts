/* eslint-disable @typescript-eslint/no-explicit-any -- a stand-in for the dynamic Prisma client and Express objects */
/**
 * An in-memory stand-in for the Prisma client, for tests. Import this module
 * FIRST in a test file (before any server module): server/src/lib/prisma.ts
 * reuses globalThis.prisma outside production, so the controllers then talk to
 * this fake and no database is ever contacted. Anything the fake does not
 * implement throws, so a test can't silently reach a real database.
 *
 * What it models, because the licence code depends on it:
 * - every query yields to the event loop first, so concurrent requests
 *   interleave the way they do against a real database;
 * - $transaction(fn) and $transaction([...]) record a transaction id on every
 *   query made inside them (see `db.ops`), so a test can check that writes
 *   happen together;
 * - SELECT ... FOR UPDATE through $queryRaw locks that row until the
 *   transaction ends: a second transaction locking the same row waits.
 * It does not roll back: code under test makes its checks before writing.
 */
import { randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
// Unreachable on purpose: a real client must never be created by the tests
process.env.DATABASE_URL = 'postgresql://nobody:none@127.0.0.1:9/none';
process.env.LICENSE_SECRET_KEY = 'test-licence-secret';

type Row = Record<string, any>;
type Args = Record<string, any>;

interface Relation {
  kind: 'one' | 'many';
  table: string;
  local: string;
  foreign: string;
}

// Prisma model name -> store table, and each model's relations
const TABLES: Record<string, string> = {
  license: 'licenses',
  licenseActivation: 'licenseActivations',
  licenseVerification: 'licenseVerifications',
  licenseTierConfig: 'tierConfigs',
  tierFeature: 'tierFeatures',
  feature: 'features',
  pharmacy: 'pharmacies',
  auditLog: 'auditLogs',
  adminUser: 'adminUsers',
};
const MODEL_OF_TABLE: Record<string, string> = Object.fromEntries(
  Object.entries(TABLES).map(([model, table]) => [table, model])
);

const RELATIONS: Record<string, Record<string, Relation>> = {
  license: {
    pharmacy: { kind: 'one', table: 'pharmacies', local: 'pharmacyId', foreign: 'id' },
    activations: { kind: 'many', table: 'licenseActivations', local: 'id', foreign: 'licenseId' },
    verifications: { kind: 'many', table: 'licenseVerifications', local: 'id', foreign: 'licenseId' },
    generatedBy: { kind: 'one', table: 'adminUsers', local: 'generatedById', foreign: 'id' },
    tierConfig: { kind: 'one', table: 'tierConfigs', local: 'tierCode', foreign: 'code' },
  },
  licenseActivation: {
    license: { kind: 'one', table: 'licenses', local: 'licenseId', foreign: 'id' },
    pharmacy: { kind: 'one', table: 'pharmacies', local: 'pharmacyId', foreign: 'id' },
  },
  licenseVerification: {
    license: { kind: 'one', table: 'licenses', local: 'licenseId', foreign: 'id' },
  },
  licenseTierConfig: {
    tierFeatures: { kind: 'many', table: 'tierFeatures', local: 'id', foreign: 'tierId' },
    licenses: { kind: 'many', table: 'licenses', local: 'code', foreign: 'tierCode' },
  },
  tierFeature: {
    tier: { kind: 'one', table: 'tierConfigs', local: 'tierId', foreign: 'id' },
    feature: { kind: 'one', table: 'features', local: 'featureId', foreign: 'id' },
  },
  feature: {
    tierFeatures: { kind: 'many', table: 'tierFeatures', local: 'id', foreign: 'featureId' },
  },
  pharmacy: {
    licenses: { kind: 'many', table: 'licenses', local: 'id', foreign: 'pharmacyId' },
    activations: { kind: 'many', table: 'licenseActivations', local: 'id', foreign: 'pharmacyId' },
  },
  auditLog: {
    adminUser: { kind: 'one', table: 'adminUsers', local: 'adminUserId', foreign: 'id' },
  },
  adminUser: {},
};

// Column defaults, as in prisma/schema.prisma
const DEFAULTS: Record<string, () => Row> = {
  license: () => ({
    tier: 'BASIC', tierCode: null, status: 'INACTIVE', validFrom: null, validUntil: null,
    durationDays: 365, maxActivations: 1, currentActivations: 0, pharmacyId: null, features: null,
    notes: null, generatedById: null, activatedAt: null, expiresAt: null,
  }),
  licenseActivation: () => ({
    pharmacyId: null, deviceId: null, deviceName: null, deviceFingerprint: null, ipAddress: null,
    userAgent: null, isActive: true, activatedAt: new Date(), deactivatedAt: null,
  }),
  licenseVerification: () => ({ ipAddress: null, userAgent: null, deviceId: null, message: null, verifiedAt: new Date() }),
  licenseTierConfig: () => ({
    description: null, price: 0, currency: 'GHS', durationDays: 365, maxUsers: null, maxProducts: null,
    maxTransactions: null, maxBranches: null, maxActivations: null, isDefault: false, displayOrder: 0,
    color: null, isActive: true, archivedAt: null,
  }),
  tierFeature: () => ({ isEnabled: true }),
  feature: () => ({ description: null, category: 'general', isActive: true, archivedAt: null }),
  pharmacy: () => ({
    phone: null, address: null, city: null, region: null, country: 'Ghana', registrationNumber: null,
    status: 'PENDING',
  }),
  auditLog: () => ({ entityId: null, adminUserId: null, previousValue: null, newValue: null, description: null, ipAddress: null, userAgent: null }),
  adminUser: () => ({ role: 'ADMIN', isActive: true, lastLogin: null }),
};
const TIMESTAMPED = new Set(['license', 'licenseTierConfig', 'tierFeature', 'feature', 'pharmacy', 'adminUser']);

export interface Op {
  model: string;
  action: string;
  txId: number | null;
  args: Args;
}

class Store {
  tables: Record<string, Row[]> = {};
  ops: Op[] = [];
  /** Throw from a query: (model, action, args) => an Error to throw, or undefined */
  failWhen: ((model: string, action: string, args: Args) => Error | undefined) | null = null;
  private nextTx = 1;
  private locks = new Map<string, { txId: number; done: Promise<void>; release: () => void }>();
  private held = new Map<number, string[]>();

  constructor() {
    this.reset();
  }

  reset() {
    this.tables = Object.fromEntries(Object.values(TABLES).map((t) => [t, []]));
    this.ops = [];
    this.failWhen = null;
    this.locks.clear();
    this.held.clear();
  }

  table(model: string): Row[] {
    const name = TABLES[model];
    if (!name) throw new Error(`fakePrisma: unknown model ${model}`);
    return this.tables[name];
  }

  /** Insert a row directly (test setup), with the schema's defaults */
  insert(model: string, data: Row): Row {
    const row = withDefaults(model, data);
    this.table(model).push(row);
    return row;
  }

  newTxId() {
    return this.nextTx++;
  }

  async lock(key: string, txId: number | null) {
    if (txId === null) throw new Error('fakePrisma: SELECT ... FOR UPDATE outside a transaction');
    for (;;) {
      const current = this.locks.get(key);
      if (!current) {
        let release = () => {};
        const done = new Promise<void>((resolve) => { release = resolve; });
        this.locks.set(key, { txId, done, release });
        this.held.set(txId, [...(this.held.get(txId) || []), key]);
        return;
      }
      if (current.txId === txId) return;
      await current.done;
    }
  }

  unlockAll(txId: number) {
    for (const key of this.held.get(txId) || []) {
      const current = this.locks.get(key);
      this.locks.delete(key);
      current?.release();
    }
    this.held.delete(txId);
  }

  /** Transaction ids used by the recorded queries matching model/action */
  txIdsOf(model: string, action: string): (number | null)[] {
    return this.ops.filter((op) => op.model === model && op.action === action).map((op) => op.txId);
  }
}

export const db = new Store();

// ---------------------------------------------------------------------------
// Rows

const clone = (value: any): any => {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  }
  return value;
};

function withDefaults(model: string, data: Row): Row {
  const now = new Date();
  return {
    id: randomUUID(),
    ...(DEFAULTS[model]?.() ?? {}),
    ...(TIMESTAMPED.has(model) ? { createdAt: now, updatedAt: now } : {}),
    ...(model === 'auditLog' ? { createdAt: now } : {}),
    ...clone(data),
  };
}

const sameValue = (a: any, b: any) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

const comparable = (v: any) => (v instanceof Date ? v.getTime() : v);

function matchScalar(value: any, filter: any): boolean {
  if (filter === null) return value === null || value === undefined;
  if (filter instanceof Date || typeof filter !== 'object') return sameValue(value, filter);
  return Object.entries(filter).every(([op, arg]: [string, any]) => {
    switch (op) {
      case 'equals': return matchScalar(value, arg);
      case 'not': return !matchScalar(value, arg);
      case 'in': return arg.some((x: any) => sameValue(value, x));
      case 'notIn': return !arg.some((x: any) => sameValue(value, x));
      case 'lt': return value !== null && value !== undefined && comparable(value) < comparable(arg);
      case 'lte': return value !== null && value !== undefined && comparable(value) <= comparable(arg);
      case 'gt': return value !== null && value !== undefined && comparable(value) > comparable(arg);
      case 'gte': return value !== null && value !== undefined && comparable(value) >= comparable(arg);
      case 'contains':
        return typeof value === 'string' && (filter.mode === 'insensitive'
          ? value.toLowerCase().includes(String(arg).toLowerCase())
          : value.includes(arg));
      case 'mode': return true;
      default: throw new Error(`fakePrisma: unsupported filter ${op}`);
    }
  });
}

function related(model: string, row: Row, relation: Relation): Row | Row[] | null {
  const rows = db.tables[relation.table];
  if (relation.kind === 'one') {
    const key = row[relation.local];
    if (key === null || key === undefined) return null;
    return rows.find((r) => r[relation.foreign] === key) ?? null;
  }
  return rows.filter((r) => r[relation.foreign] === row[relation.local]);
}

export function matchWhere(model: string, row: Row, where: Args | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, filter]) => {
    if (filter === undefined) return true;
    if (key === 'AND') return (Array.isArray(filter) ? filter : [filter]).every((w) => matchWhere(model, row, w));
    if (key === 'OR') return filter.some((w: Args) => matchWhere(model, row, w));
    if (key === 'NOT') return !(Array.isArray(filter) ? filter : [filter]).some((w) => matchWhere(model, row, w));
    const relation = RELATIONS[model]?.[key];
    if (relation) {
      const target = related(model, row, relation);
      const relModel = MODEL_OF_TABLE[relation.table];
      if (relation.kind === 'one') return target !== null && matchWhere(relModel, target as Row, filter);
      const list = target as Row[];
      if (filter.some) return list.some((r) => matchWhere(relModel, r, filter.some));
      if (filter.none) return !list.some((r) => matchWhere(relModel, r, filter.none));
      if (filter.every) return list.every((r) => matchWhere(relModel, r, filter.every));
      throw new Error(`fakePrisma: unsupported relation filter on ${model}.${key}`);
    }
    // Compound unique, e.g. tierId_featureId: { tierId, featureId }
    if (!(key in row) && key.includes('_') && filter && typeof filter === 'object' && !(filter instanceof Date)) {
      return Object.entries(filter).every(([k, v]) => sameValue(row[k], v));
    }
    return matchScalar(row[key], filter);
  });
}

function sortRows(rows: Row[], orderBy: any): Row[] {
  if (!orderBy) return rows;
  const orders = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
  return [...rows].sort((a, b) => {
    for (const [field, dir] of orders) {
      const x = comparable(a[field]);
      const y = comparable(b[field]);
      if (x === y) continue;
      const less = x === null || x === undefined ? true : y === null || y === undefined ? false : x < y;
      return (less ? -1 : 1) * (dir === 'desc' ? -1 : 1);
    }
    return 0;
  });
}

/** A row as a query returns it: a copy, with include/select applied */
function shape(model: string, row: Row, args: Args = {}): Row {
  const relations = RELATIONS[model] || {};
  const out: Row = {};
  if (args.select) {
    for (const [key, spec] of Object.entries<any>(args.select)) {
      if (!spec) continue;
      if (key === '_count') out._count = counts(model, row, spec.select);
      else if (relations[key]) out[key] = resolveRelation(model, row, key, spec === true ? {} : spec);
      else out[key] = clone(row[key]);
    }
    return out;
  }
  Object.assign(out, clone(row));
  for (const [key, spec] of Object.entries<any>(args.include || {})) {
    if (!spec) continue;
    if (key === '_count') out._count = counts(model, row, spec.select);
    else if (relations[key]) out[key] = resolveRelation(model, row, key, spec === true ? {} : spec);
    else throw new Error(`fakePrisma: unknown relation ${model}.${key}`);
  }
  return out;
}

function counts(model: string, row: Row, select: Args): Row {
  return Object.fromEntries(
    Object.keys(select).map((key) => [key, (related(model, row, RELATIONS[model][key]) as Row[]).length])
  );
}

function resolveRelation(model: string, row: Row, key: string, spec: Args) {
  const relation = RELATIONS[model][key];
  const relModel = MODEL_OF_TABLE[relation.table];
  const target = related(model, row, relation);
  if (relation.kind === 'one') return target ? shape(relModel, target as Row, spec) : null;
  let list = (target as Row[]).filter((r) => matchWhere(relModel, r, spec.where));
  list = sortRows(list, spec.orderBy);
  if (spec.take !== undefined) list = list.slice(0, spec.take);
  return list.map((r) => shape(relModel, r, spec));
}

function applyData(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      if ('increment' in value) { row[key] += value.increment; continue; }
      if ('decrement' in value) { row[key] -= value.decrement; continue; }
      if ('set' in value) { row[key] = clone(value.set); continue; }
    }
    row[key] = clone(value);
  }
  if ('updatedAt' in row) row.updatedAt = new Date();
}

function findOne(model: string, where: Args): Row | undefined {
  return db.table(model).find((r) => matchWhere(model, r, where));
}

// ---------------------------------------------------------------------------
// The client

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

type Runner = (txId: number | null) => Promise<any>;

/**
 * Prisma queries are lazy: they run when awaited, or when $transaction([...])
 * runs them in its transaction
 */
function lazy(run: Runner) {
  let started: Promise<any> | null = null;
  return {
    _run: run,
    then(onFulfilled?: (v: any) => any, onRejected?: (e: any) => any) {
      started ??= run(null);
      return started.then(onFulfilled, onRejected);
    },
    catch(onRejected: (e: any) => any) {
      return this.then(undefined, onRejected);
    },
  };
}

const ACTIONS: Record<string, (model: string, args: Args) => any> = {
  findUnique: (model, args) => {
    const row = findOne(model, args.where);
    return row ? shape(model, row, args) : null;
  },
  findFirst: (model, args) => {
    const rows = sortRows(db.table(model).filter((r) => matchWhere(model, r, args.where)), args.orderBy);
    return rows[0] ? shape(model, rows[0], args) : null;
  },
  findMany: (model, args) => {
    let rows = sortRows(db.table(model).filter((r) => matchWhere(model, r, args.where)), args.orderBy);
    if (args.skip) rows = rows.slice(args.skip);
    if (args.take !== undefined) rows = rows.slice(0, args.take);
    return rows.map((r) => shape(model, r, args));
  },
  count: (model, args) => db.table(model).filter((r) => matchWhere(model, r, args.where)).length,
  groupBy: (model, args) => {
    const groups = new Map<string, Row[]>();
    for (const row of db.table(model).filter((r) => matchWhere(model, r, args.where))) {
      const key = JSON.stringify(args.by.map((field: string) => row[field]));
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    return [...groups.values()].map((rows) => ({
      ...Object.fromEntries(args.by.map((field: string) => [field, rows[0][field]])),
      ...(args._count ? { _count: Object.fromEntries(Object.keys(args._count).map((k) => [k, rows.length])) } : {}),
    }));
  },
  create: (model, args) => shape(model, db.insert(model, args.data), args),
  createMany: (model, args) => {
    for (const data of args.data) db.insert(model, data);
    return { count: args.data.length };
  },
  update: (model, args) => {
    const row = findOne(model, args.where);
    if (!row) throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
    applyData(row, args.data);
    return shape(model, row, args);
  },
  updateMany: (model, args) => {
    const rows = db.table(model).filter((r) => matchWhere(model, r, args.where));
    for (const row of rows) applyData(row, args.data);
    return { count: rows.length };
  },
  upsert: (model, args) => {
    const row = findOne(model, args.where);
    if (row) {
      applyData(row, args.update);
      return shape(model, row, args);
    }
    return shape(model, db.insert(model, args.create), args);
  },
  delete: (model, args) => {
    const rows = db.table(model);
    const index = rows.findIndex((r) => matchWhere(model, r, args.where));
    if (index < 0) throw Object.assign(new Error('Record to delete does not exist.'), { code: 'P2025' });
    return rows.splice(index, 1)[0];
  },
  deleteMany: (model, args) => {
    const rows = db.table(model);
    const keep = rows.filter((r) => !matchWhere(model, r, args?.where));
    const count = rows.length - keep.length;
    rows.splice(0, rows.length, ...keep);
    return { count };
  },
};

function delegate(model: string, txId: number | null) {
  return Object.fromEntries(
    Object.keys(ACTIONS).map((action) => [
      action,
      (args: Args = {}) => {
        const run: Runner = async (runTx) => {
          await tick();
          const tx = txId ?? runTx;
          db.ops.push({ model, action, txId: tx, args });
          const failure = db.failWhen?.(model, action, args);
          if (failure) throw failure;
          return ACTIONS[action](model, args);
        };
        return lazy(run);
      },
    ])
  );
}

function client(txId: number | null): any {
  const c: any = Object.fromEntries(Object.keys(TABLES).map((model) => [model, delegate(model, txId)]));
  c.$queryRaw = async (strings: TemplateStringsArray, ...values: any[]) => {
    await tick();
    const sql = strings.join('?');
    db.ops.push({ model: '$queryRaw', action: sql, txId, args: { values } });
    if (/FOR UPDATE/i.test(sql)) {
      await db.lock(String(values[0]), txId);
      return [{ id: values[0] }];
    }
    throw new Error(`fakePrisma: unsupported raw query ${sql}`);
  };
  if (txId === null) {
    c.$transaction = async (arg: any, options?: Args) => {
      const id = db.newTxId();
      db.ops.push({ model: '$transaction', action: Array.isArray(arg) ? 'batch' : 'interactive', txId: id, args: { options } });
      try {
        if (Array.isArray(arg)) {
          const results = [];
          for (const query of arg) results.push(await query._run(id));
          return results;
        }
        return await arg(client(id));
      } finally {
        db.unlockAll(id);
      }
    };
    c.$connect = async () => {};
    c.$disconnect = async () => {};
  }
  return c;
}

export const fakePrisma = client(null);

// Install before any server module creates a real client
(globalThis as any).prisma = fakePrisma;
