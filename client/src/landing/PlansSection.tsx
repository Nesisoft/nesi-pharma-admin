import { useCallback, useEffect, useState } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { API_BASE_URL } from '@/lib/config';
import { APP_FEATURE_KEYS, CONTACT } from './site';

// GET /api/public/license/plans: the plans set on the Tier Configs page
interface Plan {
  code: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  durationDays: number;
  color: string | null;
  limits: { maxUsers: number; maxBranches: number; maxProducts: number };
  features: Record<string, boolean>;
}

interface CatalogueFeature {
  key: string;
  name: string;
  category: string;
}

type PlansState =
  | { status: 'loading' }
  | { status: 'ready'; plans: Plan[]; catalogue: CatalogueFeature[] }
  | { status: 'error' };

// The server sleeps when idle (Render free tier) and takes about a minute to wake
const SLOW_AFTER_MS = 6000;
const GIVE_UP_AFTER_MS = 100000;
const FEATURES_PER_CARD = 8;

function formatPrice(price: string, currency: string): string | null {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return null;
  if (amount === 0) return 'Free';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    // Not an ISO currency code
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function periodText(days: number): string {
  if (days >= 360 && days <= 366) return 'per year';
  if (days >= 28 && days <= 31) return 'per month';
  if (days > 0 && days % 30 === 0 && days < 360) return `per ${days / 30} months`;
  return `for ${days} days`;
}

function limitText(value: number, one: string, many: string): string {
  if (value === -1) return `Unlimited ${many}`;
  return `${value.toLocaleString()} ${value === 1 ? one : many}`;
}

// Only accept plain hex colours from the admin platform
function safeColor(color: string | null): string | undefined {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : undefined;
}

const contactHref = CONTACT.email ? `mailto:${CONTACT.email}?subject=Adurofie%20PMS%20licence` : CONTACT.website;

/**
 * The plans on offer, live from the admin platform, with what each adds over the
 * one before it
 */
export default function PlansSection() {
  const [state, setState] = useState<PlansState>({ status: 'loading' });
  const [slow, setSlow] = useState(false);

  // Returns a cancel function (used when the page unmounts)
  const load = useCallback(() => {
    let cancelled = false;
    const controller = new AbortController();
    setState({ status: 'loading' });
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    const giveUp = window.setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS);

    fetch(`${API_BASE_URL}/public/license/plans`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        const plans: Plan[] = Array.isArray(body?.data?.plans) ? body.data.plans : [];
        const catalogue: CatalogueFeature[] = Array.isArray(body?.data?.features) ? body.data.features : [];
        if (!cancelled) setState(plans.length ? { status: 'ready', plans, catalogue } : { status: 'error' });
      })
      .catch(() => {
        // Includes giving up after GIVE_UP_AFTER_MS
        if (!cancelled) setState({ status: 'error' });
      })
      .finally(() => {
        window.clearTimeout(slowTimer);
        window.clearTimeout(giveUp);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
      window.clearTimeout(giveUp);
      controller.abort();
    };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <section id="plans" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Plans for every pharmacy</h2>
          <p className="mt-4 text-lg text-slate-600">
            Start free, then add users, branches and features as you grow. Upgrade any time with a licence key.
          </p>
        </div>

        {state.status === 'loading' && (
          <div className="mt-14" role="status" aria-live="polite">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-slate-500">
              {slow ? 'Loading the plans: the server is waking up, which can take up to a minute.' : 'Loading the plans…'}
            </p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="mx-auto mt-14 max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-700">The plans couldn&apos;t be loaded right now.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={load} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Try again
              </button>
              <a href={contactHref} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Ask us about pricing
              </a>
            </div>
          </div>
        )}

        {state.status === 'ready' && <PlanCards plans={state.plans} catalogue={state.catalogue} />}
      </div>
    </section>
  );
}

function PlanCards({ plans, catalogue }: { plans: Plan[]; catalogue: CatalogueFeature[] }) {
  const shown = catalogue.filter((feature) => APP_FEATURE_KEYS.has(feature.key) || feature.category === 'support');
  const columns = plans.length >= 4 ? 'lg:grid-cols-4' : plans.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

  return (
    <div className={`mt-14 grid gap-6 md:grid-cols-2 ${columns}`}>
      {plans.map((plan, index) => {
        const previous = index > 0 ? plans[index - 1] : null;
        const included = shown.filter((feature) => plan.features[feature.key]);
        const listed = previous ? included.filter((feature) => !previous.features[feature.key]) : included;
        const price = formatPrice(plan.price, plan.currency);
        const isFree = price === 'Free';
        const accent = safeColor(plan.color);

        return (
          <article
            key={plan.code}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            style={accent ? { borderTopColor: accent, borderTopWidth: 4 } : undefined}
          >
            <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
            {plan.description && <p className="mt-2 text-sm text-slate-600">{plan.description}</p>}

            <p className="mt-5 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-900">{price ?? 'Contact us'}</span>
              {price && !isFree && <span className="text-sm text-slate-500">{periodText(plan.durationDays)}</span>}
            </p>

            <ul className="mt-5 space-y-1.5 border-y border-slate-100 py-4 text-sm text-slate-700">
              <li>{limitText(plan.limits.maxUsers, 'user', 'users')}</li>
              <li>{limitText(plan.limits.maxBranches, 'branch', 'branches')}</li>
              <li>{limitText(plan.limits.maxProducts, 'product', 'products')}</li>
            </ul>

            <div className="mt-4 flex-1">
              {previous && listed.length > 0 && (
                <p className="mb-2 text-sm font-medium text-slate-900">Everything in {previous.name}, plus:</p>
              )}
              {previous && listed.length === 0 && (
                <p className="text-sm font-medium text-slate-900">Everything in {previous.name}, with higher limits.</p>
              )}
              <ul className="space-y-2">
                {listed.slice(0, FEATURES_PER_CARD).map((feature) => (
                  <li key={feature.key} className="flex gap-2 text-sm text-slate-700">
                    <CheckIcon className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />
                    {feature.name}
                  </li>
                ))}
                {listed.length > FEATURES_PER_CARD && (
                  <li className="pl-6 text-sm text-slate-500">and {listed.length - FEATURES_PER_CARD} more</li>
                )}
              </ul>
            </div>

            <a
              href={isFree ? '#download' : contactHref}
              className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                isFree ? 'bg-amber-400 text-slate-900 hover:bg-amber-300' : 'bg-slate-900 text-white hover:bg-slate-700'
              }`}
            >
              {isFree ? 'Download free' : 'Get a licence key'}
            </a>
          </article>
        );
      })}
    </div>
  );
}
