/* eslint-disable @typescript-eslint/no-explicit-any -- a stand-in for the dynamic Prisma client and Express objects */
import { db } from './fakePrisma';
import { generateLicenseKey } from '../../src/utils/licenseKey';

export const DAY = 24 * 60 * 60 * 1000;
export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);
/** Days from now to a date, to one decimal */
export const daysLeft = (date: Date | string | null) =>
  date === null ? null : Math.round(((new Date(date).getTime() - Date.now()) / DAY) * 10) / 10;

export interface Answer {
  status: number;
  body: any;
}

type Handler = (req: any, res: any) => Promise<void> | void;

/** Call an Express handler with a fake request; resolves with the status and JSON body */
export async function call(
  handler: Handler,
  { body = {}, params = {}, query = {}, user = { id: 'admin-1', role: 'ADMIN' } }: {
    body?: any;
    params?: Record<string, string>;
    query?: Record<string, string>;
    user?: any;
  } = {}
): Promise<Answer> {
  const answer: Answer = { status: 200, body: undefined };
  const res: any = {
    status(code: number) {
      answer.status = code;
      return res;
    },
    json(payload: any) {
      answer.body = JSON.parse(JSON.stringify(payload));
      return res;
    },
  };
  const req: any = { body, params, query, user, ip: '127.0.0.1', headers: { 'user-agent': 'node-test' } };
  await handler(req, res);
  return answer;
}

/** A plan with limits and feature switches: { customers: true, backupRestore: false } */
export function seedPlan(code: string, features: Record<string, boolean> = { customers: true, backupRestore: true }, limits: Record<string, number | null> = { maxUsers: 5, maxBranches: 1, maxProducts: null }) {
  const tier = db.insert('licenseTierConfig', { code, name: code, ...limits });
  for (const [key, isEnabled] of Object.entries(features)) {
    const feature =
      db.table('feature').find((f) => f.key === key) ?? db.insert('feature', { key, name: key });
    db.insert('tierFeature', { tierId: tier.id, featureId: feature.id, isEnabled });
  }
  return tier;
}

export function seedLicence(fields: Record<string, any> = {}) {
  return db.insert('license', {
    licenseKey: generateLicenseKey('STANDARD'),
    tier: 'BASIC',
    tierCode: 'GOLD_TIER',
    ...fields,
  });
}

export function seedActivation(license: Record<string, any>, fields: Record<string, any> = {}) {
  return db.insert('licenseActivation', { licenseId: license.id, ...fields });
}

/** The stored row (not a copy) */
export const licenceRow = (id: string) => db.table('license').find((l) => l.id === id)!;
export const activeSeats = (licenseId: string) =>
  db.table('licenseActivation').filter((a) => a.licenseId === licenseId && a.isActive);
