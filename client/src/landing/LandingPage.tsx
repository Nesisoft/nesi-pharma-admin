import { useEffect } from 'react';
import {
  ArchiveBoxArrowDownIcon,
  ArrowDownTrayIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ComputerDesktopIcon,
  CubeIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SignalSlashIcon,
  TruckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { ADMIN_BASE } from '@/lib/config';
import AppPreview from './AppPreview';
import PlansSection from './PlansSection';
import { COMPANY, PRODUCT_NAME } from './site';
import { RELEASES_PAGE, useLatestRelease, type LatestRelease } from './useLatestRelease';

const features = [
  {
    icon: ShoppingCartIcon,
    title: 'Fast point of sale',
    text: 'Barcode scanning, held carts and refunds. Take Cash, Card, Mobile Money or Bank Transfer, and print to 80 mm or 58 mm receipt printers.',
  },
  {
    icon: CalendarDaysIcon,
    title: 'Batches and expiry dates',
    text: 'Every batch keeps its own expiry date. The till suggests the batch to sell first, and alerts warn you before stock expires.',
  },
  {
    icon: CubeIcon,
    title: 'Stock you can trust',
    text: 'Low-stock alerts, stock adjustments with reasons, and inventory reports, across every batch you hold.',
  },
  {
    icon: TruckIcon,
    title: 'Purchasing',
    text: 'Raise purchase orders, receive goods against them, and track supplier invoices and payments.',
  },
  {
    icon: UserGroupIcon,
    title: 'Customers and prescriptions',
    text: 'Customer records with their purchase history, and prescriptions kept with each customer.',
  },
  {
    icon: ChartBarIcon,
    title: 'Reports and analytics',
    text: 'A dashboard for the day, sales analytics and period comparisons, so you see what sells and when.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Staff, roles and audit trail',
    text: 'Roles for pharmacists, cashiers, accountants and inventory managers, per-user permissions, and a record of who did what.',
  },
  {
    icon: BanknotesIcon,
    title: 'Cash reconciliation',
    text: 'Open and close cash sessions and reconcile the drawer at the end of every shift.',
  },
  {
    icon: ArchiveBoxArrowDownIcon,
    title: 'Backups and restore',
    text: 'Automatic daily backups, checked after every copy, plus an extra copy to a folder or USB drive. Restore in a few clicks, with undo.',
  },
];

const steps = [
  { title: 'Download and install', text: 'Run the installer on the pharmacy PC.' },
  { title: 'Set up your pharmacy', text: 'Enter your pharmacy details and create the owner account.' },
  { title: 'Start selling', text: 'Use the free plan right away. To upgrade, enter a licence key in Settings > License.' },
];

const faqs = [
  {
    q: 'Do I need the internet?',
    a: 'Not for daily work: sales, stock and reports run on your PC. You need a connection to activate a licence key and to get updates.',
  },
  {
    q: 'Where is my data kept?',
    a: 'In a database on your own computer. Backups go to a folder on the PC and, if you choose, a second folder such as a USB drive.',
  },
  {
    q: 'How do I upgrade my plan?',
    a: 'Get a licence key for the plan you want and enter it in Settings > License. Your data stays as it is.',
  },
  {
    q: 'Can I move to a new computer?',
    a: 'Yes. Install the app on the new PC and restore your latest backup during setup.',
  },
];

function formatSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function DownloadButton({ release, className = '' }: { release: LatestRelease; className?: string }) {
  const base = `inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-semibold shadow-sm ${className}`;
  if (release.status === 'none') {
    return (
      <span className={`${base} cursor-not-allowed bg-white/70 text-slate-500`} aria-disabled="true">
        <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
        Download coming soon
      </span>
    );
  }
  const href = release.status === 'ready' ? release.url : RELEASES_PAGE;
  return (
    <a href={href} className={`${base} bg-amber-400 text-slate-900 hover:bg-amber-300`}>
      <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
      Download for Windows
    </a>
  );
}

/**
 * pharma.nesisoft.com: what Adurofie PMS does, the plans, and the download
 */
export default function LandingPage() {
  const release = useLatestRelease();

  useEffect(() => {
    document.title = `${PRODUCT_NAME}: pharmacy management software`;
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <img src="/adurofie-icon-192.png" alt="" className="h-9 w-9" width="36" height="36" />
            <span className="text-lg font-bold tracking-tight">{PRODUCT_NAME}</span>
          </a>
          <nav className="flex items-center gap-1 text-sm font-medium text-slate-600 sm:gap-2" aria-label="Main">
            <a href="#features" className="hidden rounded-md px-3 py-2 hover:bg-slate-100 sm:block">Features</a>
            <a href="#plans" className="hidden rounded-md px-3 py-2 hover:bg-slate-100 sm:block">Plans</a>
            <a href="#faq" className="hidden rounded-md px-3 py-2 hover:bg-slate-100 sm:block">FAQ</a>
            <a href="#download" className="ml-1 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700">
              Download
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-900 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-sky-200">Pharmacy management software for Windows</p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Your whole pharmacy, in one app</h1>
              <p className="mt-6 text-lg leading-relaxed text-sky-100">
                {PRODUCT_NAME} handles sales, stock, expiry dates, suppliers and reports on your own PC, and keeps working when
                the internet doesn&apos;t.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <DownloadButton release={release} />
                <a
                  href="#plans"
                  className="inline-flex items-center rounded-lg border border-white/40 px-5 py-3 text-base font-semibold text-white hover:bg-white/10"
                >
                  Compare plans
                </a>
              </div>
              <p className="mt-4 text-sm text-sky-200">Start on the free plan, no licence key needed. Windows 10 or 11, 64-bit.</p>
            </div>
            <AppPreview />
          </div>
        </section>

        {/* Quick facts */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
            <div className="flex items-center gap-3">
              <SignalSlashIcon className="h-6 w-6 flex-none text-sky-600" aria-hidden="true" />
              <span><strong className="font-semibold">Works offline.</strong> Your data lives on your PC.</span>
            </div>
            <div className="flex items-center gap-3">
              <CalendarDaysIcon className="h-6 w-6 flex-none text-sky-600" aria-hidden="true" />
              <span><strong className="font-semibold">Expiry-aware.</strong> Sell the right batch first.</span>
            </div>
            <div className="flex items-center gap-3">
              <ArchiveBoxArrowDownIcon className="h-6 w-6 flex-none text-sky-600" aria-hidden="true" />
              <span><strong className="font-semibold">Backed up daily.</strong> Restore with undo.</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for the way pharmacies work</h2>
              <p className="mt-4 text-lg text-slate-600">From the till to the stock room to the monthly report.</p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-slate-200 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50">
                    <feature.icon className="h-6 w-6 text-sky-700" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">Some features depend on your plan.</p>
          </div>
        </section>

        <PlansSection />

        {/* Download */}
        <section id="download" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-start gap-12 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Download {PRODUCT_NAME}</h2>
                <p className="mt-4 text-lg text-slate-600">
                  One installer for Windows 10 and 11 (64-bit). The app keeps itself up to date.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <DownloadButton release={release} className="ring-1 ring-amber-500/30" />
                  <ReleaseDetails release={release} />
                </div>
              </div>
              <ol className="space-y-5">
                {steps.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold">{step.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-slate-200 bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
            <dl className="mt-12 space-y-4">
              {faqs.map((faq) => (
                <div key={faq.q} className="rounded-xl border border-slate-200 bg-white p-6">
                  <dt className="font-semibold">{faq.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-slate-600">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/adurofie-icon-192.png" alt="" className="h-6 w-6" width="24" height="24" />
            <span>
              {PRODUCT_NAME} by{' '}
              <a href={COMPANY.website} className="font-medium text-slate-700 hover:text-slate-900">
                {COMPANY.name}
              </a>{' '}
              © {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <ComputerDesktopIcon className="h-4 w-4" aria-hidden="true" />
              Windows 10 and 11
            </span>
            <a href={`${ADMIN_BASE}/login`} className="hover:text-slate-900">
              Admin sign-in
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ReleaseDetails({ release }: { release: LatestRelease }) {
  if (release.status === 'ready') {
    const date = new Date(release.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    return (
      <p className="text-sm text-slate-500">
        Version {release.version} · {formatSize(release.size)} · {date}
      </p>
    );
  }
  if (release.status === 'none') {
    return <p className="text-sm text-slate-500">The first public release is on its way.</p>;
  }
  if (release.status === 'error') {
    return <p className="text-sm text-slate-500">Opens the download page on GitHub.</p>;
  }
  return null;
}
