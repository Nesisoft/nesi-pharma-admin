import { useState } from 'react';
import clsx from 'clsx';
import {
  type ExtendUnit,
  endOfPickedDay,
  expiryHint,
  extendDaysFor,
  extendedExpiry,
  formatDate,
} from '@/lib/licence';

export interface RenewBody {
  extendDays?: number;
  expiresAt?: string;
  allowShorten?: boolean;
  note?: string;
}

interface RenewLicenceModalProps {
  license: {
    effectiveStatus: string;
    expiresAt: string | null;
    durationDays: number;
  };
  busy: boolean;
  onSubmit: (body: RenewBody) => void;
  onClose: () => void;
}

const MAX_EXTEND_DAYS = 3650;

/**
 * Renew / extend a licence: by a number of days, months or years (from the
 * current expiry, or from today once it has passed), or to a chosen date.
 * Shows the new expiry before anything is sent; the server applies the same
 * rules and has the last word.
 */
export default function RenewLicenceModal({ license, busy, onSubmit, onClose }: RenewLicenceModalProps) {
  const started = license.expiresAt !== null;
  const [mode, setMode] = useState<'extend' | 'date'>('extend');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<ExtendUnit>('years');
  const [date, setDate] = useState('');
  const [allowShorten, setAllowShorten] = useState(false);
  const [note, setNote] = useState('');

  const now = new Date();
  const amountNumber = Number(amount);
  const amountValid = Number.isInteger(amountNumber) && amountNumber >= 1;
  const extendDays = amountValid ? extendDaysFor(amountNumber, unit, license.expiresAt, now) : 0;
  const extendTooLong = extendDays > MAX_EXTEND_DAYS;

  const picked = mode === 'date' ? endOfPickedDay(date) : null;
  const pickedInPast = picked !== null && picked.getTime() <= now.getTime();
  const shortens =
    picked !== null && license.expiresAt !== null && picked.getTime() < new Date(license.expiresAt).getTime();

  let problem: string | null = null;
  let newExpiry: Date | null = null;
  if (mode === 'extend') {
    if (!amountValid) problem = 'Enter a whole number of 1 or more.';
    else if (extendTooLong) problem = 'Extend by at most 10 years at a time.';
    else newExpiry = extendedExpiry(license.expiresAt, extendDays, now);
  } else if (!picked) {
    problem = 'Pick the new expiry date.';
  } else if (pickedInPast) {
    problem = 'Pick a date in the future.';
  } else if (shortens && !allowShorten) {
    problem = 'This date is earlier than the current expiry. Tick "Allow shortening" to shorten the licence.';
    newExpiry = picked;
  } else {
    newExpiry = picked;
  }

  const submit = () => {
    if (problem) return;
    const trimmed = note.trim() || undefined;
    if (mode === 'extend') onSubmit({ extendDays, note: trimmed });
    else if (picked) onSubmit({ expiresAt: picked.toISOString(), allowShorten: shortens && allowShorten, note: trimmed });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        <div className="relative bg-white rounded-lg max-w-lg w-full p-6" role="dialog" aria-modal="true" aria-label="Renew or extend licence">
          <h3 className="text-lg font-medium text-gray-900">Renew / extend licence</h3>

          <div className="mt-3 text-sm text-gray-600 space-y-2">
            {started ? (
              <p>
                Current expiry: <span className="font-medium text-gray-900">{formatDate(license.expiresAt!)}</span>{' '}
                ({expiryHint(license.expiresAt)})
              </p>
            ) : (
              <p>
                This licence hasn't been activated yet. Its term of {license.durationDays} days starts when it is
                first activated, so extending it adds days to the term.
              </p>
            )}
            {license.effectiveStatus === 'EXPIRED' && started && (
              <p>The licence has expired. Renewing makes it active again, counting from today.</p>
            )}
            {license.effectiveStatus === 'SUSPENDED' && (
              <p className="text-yellow-800 bg-yellow-50 rounded p-2">
                This licence is suspended. Renewing only changes its expiry date: lift the suspension separately.
              </p>
            )}
          </div>

          {started && (
            <div className="mt-4 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === 'extend'} onChange={() => setMode('extend')} />
                Extend by
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === 'date'} onChange={() => setMode('date')} />
                Set the expiry date
              </label>
            </div>
          )}

          <div className="mt-3">
            {mode === 'extend' ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input w-28"
                  aria-label="Extend by"
                />
                <select value={unit} onChange={(e) => setUnit(e.target.value as ExtendUnit)} className="input w-auto" aria-label="Unit">
                  <option value="days">days</option>
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input w-auto"
                  aria-label="New expiry date"
                />
                {shortens && !pickedInPast && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={allowShorten} onChange={(e) => setAllowShorten(e.target.checked)} />
                    Allow shortening (the licence will end earlier than it does now)
                  </label>
                )}
              </div>
            )}
          </div>

          <div className={clsx('mt-4 rounded-lg p-3 text-sm', problem ? 'bg-gray-50 text-gray-600' : 'bg-green-50 text-green-900')}>
            {problem ? (
              problem
            ) : started && newExpiry ? (
              <>
                New expiry: <span className="font-semibold">{formatDate(newExpiry)}</span> ({expiryHint(newExpiry.toISOString())})
              </>
            ) : (
              <>
                New term: <span className="font-semibold">{license.durationDays + extendDays} days</span> from the first
                activation
              </>
            )}
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="renew-note">Note (optional)</label>
            <input
              id="renew-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="input"
              placeholder="Invoice or payment reference, kept in the audit log"
            />
          </div>

          <p className="mt-3 text-xs text-gray-500">
            The pharmacy's PCs pick up the new expiry date at their next licence check.
          </p>

          <div className="mt-5 flex gap-3">
            <button onClick={onClose} className="btn btn-secondary flex-1" disabled={busy}>
              Cancel
            </button>
            <button onClick={submit} disabled={busy || problem !== null} className="btn btn-primary flex-1">
              {busy ? 'Saving...' : started ? 'Renew licence' : 'Extend term'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
