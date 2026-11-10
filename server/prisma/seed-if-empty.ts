/**
 * Seeds a brand-new database: the plans, the features and the first super
 * admin (prisma/seed.ts). The Render build runs it after `prisma db push`, so a
 * new database (e.g. a new Supabase project) is ready after the first deploy.
 *
 * A database that already has an admin user is left alone: the seed resets
 * which features each plan includes, which would undo changes made on the
 * Tier Configs page.
 */
import { spawnSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  let admins: number;
  try {
    admins = await prisma.adminUser.count();
  } finally {
    await prisma.$disconnect();
  }

  if (admins > 0) {
    console.log(`Database already set up (${admins} admin user(s)): not seeding.`);
    return;
  }

  console.log('New database: running the seed.');
  const result = spawnSync('npx', ['prisma', 'db', 'seed'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main().catch((error) => {
  console.error('Could not check or seed the database:', error);
  process.exit(1);
});
