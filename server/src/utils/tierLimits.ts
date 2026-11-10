/**
 * A plan's limits as the pharmacy app expects them. An empty limit means
 * unlimited (the seed and the Tier Configs page treat it so), which the app
 * writes as -1.
 *
 * Used by licence generation, activation and the public plan list, so all
 * three agree. (Activation used to send 1 user, 1 branch and 500 products for
 * empty limits, e.g. for every Enterprise licence.)
 */
export function tierLimits(tierConfig: { maxUsers: number | null; maxBranches: number | null; maxProducts: number | null }) {
  const limit = (value: number | null) => (value === null ? -1 : value);
  return {
    maxUsers: limit(tierConfig.maxUsers),
    maxBranches: limit(tierConfig.maxBranches),
    maxProducts: limit(tierConfig.maxProducts),
  };
}
