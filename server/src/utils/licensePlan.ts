import { LicenseTier, Prisma } from '@prisma/client';
import { tierLimits } from './tierLimits';

/**
 * Which plan (tier config code) a licence is on. Licences made before plans
 * had codes only have the enum tier, which names the plan for STANDARD,
 * PROFESSIONAL and ENTERPRISE. The enum tier BASIC is also what custom plans
 * are stored with, so a BASIC licence without a plan code has no known plan
 * (handing it the free plan would switch its paid features off).
 */
export function licencePlanCode(license: { tier: LicenseTier; tierCode: string | null }): string | null {
  if (license.tierCode) return license.tierCode;
  if (license.tier === LicenseTier.BASIC) return null;
  return license.tier;
}

/**
 * The licence's plan as the desktop app applies it: the plan's limits plus a
 * switch for each of its active features, read fresh from Tier Configs.
 *
 * Returns null when there is no usable plan: no plan code, an unknown plan, a
 * plan with no feature rows at all (never set up, or being rewritten), or a
 * failed read. Callers must then refuse (PLAN_UNAVAILABLE) rather than answer
 * "valid" with an incomplete plan.
 */
export async function readPlanFeatures(
  client: Prisma.TransactionClient,
  license: { tier: LicenseTier; tierCode: string | null }
): Promise<Record<string, unknown> | null> {
  const code = licencePlanCode(license);
  if (!code) return null;
  try {
    const tierConfig = await client.licenseTierConfig.findUnique({
      where: { code },
      include: {
        tierFeatures: {
          include: {
            feature: { select: { key: true, isActive: true } },
          },
        },
      },
    });
    if (!tierConfig || tierConfig.tierFeatures.length === 0) return null;

    const features: Record<string, unknown> = { ...tierLimits(tierConfig) };
    // Only features that are active in the feature catalogue
    for (const tf of tierConfig.tierFeatures) {
      if (tf.feature.isActive) features[tf.feature.key] = tf.isEnabled;
    }
    return features;
  } catch (error) {
    console.error('Error reading a licence plan:', error);
    return null;
  }
}
