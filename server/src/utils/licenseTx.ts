import { Prisma } from '@prisma/client';

/**
 * Options for the interactive transactions that change a licence's seats or
 * dates. Prisma's defaults (2 s to start, 5 s to finish) are too short for
 * Render's free plan talking to the Supabase pooler, especially after a cold
 * start.
 */
export const LICENCE_TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

/**
 * Lock the licence row until the transaction ends (SELECT ... FOR UPDATE), so
 * activations, deactivations and admin actions on one licence run one after
 * the other: two PCs activating at once can't both take the last seat.
 */
export async function lockLicence(tx: Prisma.TransactionClient, licenseId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "licenses" WHERE "id" = ${licenseId} FOR UPDATE`;
}

/** The licence's seats in use: its active activations, counted (not a counter that drifts) */
export function countActiveActivations(tx: Prisma.TransactionClient, licenseId: string): Promise<number> {
  return tx.licenseActivation.count({ where: { licenseId, isActive: true } });
}
