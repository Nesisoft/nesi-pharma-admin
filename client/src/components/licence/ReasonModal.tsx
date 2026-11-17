import { useState, type ReactNode } from 'react';
import clsx from 'clsx';

interface ReasonModalProps {
  title: string;
  /** What the action does, in a sentence or two */
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  danger?: boolean;
  busy: boolean;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** A confirmation with an optional reason, for licence actions */
export default function ReasonModal({
  title,
  children,
  confirmLabel,
  busyLabel,
  danger = false,
  busy,
  reasonPlaceholder = 'Reason (optional, kept in the audit log)',
  onConfirm,
  onClose,
}: ReasonModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        <div className="relative bg-white rounded-lg max-w-md w-full p-6" role="dialog" aria-modal="true" aria-label={title}>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
          <div className="text-sm text-gray-600 space-y-2 mb-4">{children}</div>
          <div className="mb-4">
            <label className="label" htmlFor="licence-action-reason">Reason</label>
            <textarea
              id="licence-action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="input"
              placeholder={reasonPlaceholder}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-secondary flex-1" disabled={busy}>
              Cancel
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={busy}
              className={clsx('btn flex-1', danger ? 'btn-danger' : 'btn-primary')}
            >
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
