import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getErrorMessage } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import {
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface License {
  id: string;
  licenseKey: string;
  tier: string;
  status: string;
  durationDays: number;
  maxActivations: number;
  currentActivations: number;
  notes: string | null;
  features: Record<string, unknown>;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  pharmacy: {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
  } | null;
  generatedBy: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  activations: {
    id: string;
    deviceName: string;
    deviceId: string;
    ipAddress: string;
    isActive: boolean;
    activatedAt: string;
    deactivatedAt: string | null;
  }[];
  verifications: {
    id: string;
    isValid: boolean;
    message: string;
    ipAddress: string;
    verifiedAt: string;
  }[];
}

const tierColors: Record<string, string> = {
  BASIC: 'badge-gray',
  STANDARD: 'badge-info',
  PROFESSIONAL: 'badge-success',
  ENTERPRISE: 'badge bg-purple-100 text-purple-800',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'badge-success',
  INACTIVE: 'badge-gray',
  EXPIRED: 'badge-warning',
  REVOKED: 'badge-danger',
  SUSPENDED: 'badge-warning',
};

export default function LicenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const { data: license, isLoading } = useQuery<License>({
    queryKey: ['license', id],
    queryFn: async () => {
      const response = await api.get(`/licenses/${id}`);
      return response.data.data;
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/licenses/${id}/revoke`, { reason: revokeReason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('License revoked successfully');
      queryClient.invalidateQueries({ queryKey: ['license', id] });
      setShowRevokeModal(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">License not found</p>
        <Link to="/licenses" className="btn btn-primary mt-4">
          Back to Licenses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">License Details</h1>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                {license.licenseKey}
              </code>
              <button
                onClick={() => copyToClipboard(license.licenseKey)}
                className="text-gray-400 hover:text-gray-600"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {license.status !== 'REVOKED' && (
          <button
            onClick={() => setShowRevokeModal(true)}
            className="btn btn-danger"
          >
            Revoke License
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* License Info Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">License Information</h2>
            </div>
            <div className="card-body">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Tier</dt>
                  <dd className="mt-1">
                    <span className={clsx('badge', tierColors[license.tier])}>
                      {license.tier}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={clsx('badge', statusColors[license.status])}>
                      {license.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Duration</dt>
                  <dd className="mt-1 text-sm text-gray-900">{license.durationDays} days</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Max Activations</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {license.currentActivations} / {license.maxActivations}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {format(new Date(license.createdAt), 'MMM d, yyyy HH:mm')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Activated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {license.activatedAt
                      ? format(new Date(license.activatedAt), 'MMM d, yyyy HH:mm')
                      : 'Not activated'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Expires</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {license.expiresAt
                      ? format(new Date(license.expiresAt), 'MMM d, yyyy')
                      : 'Not set'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Generated By</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {license.generatedBy
                      ? `${license.generatedBy.firstName} ${license.generatedBy.lastName}`
                      : 'Unknown'}
                  </dd>
                </div>
              </dl>
              {license.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <dt className="text-sm font-medium text-gray-500">Notes</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                    {license.notes}
                  </dd>
                </div>
              )}
            </div>
          </div>

          {/* Activations */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">
                Activations ({license.activations.length})
              </h2>
            </div>
            <div className="overflow-hidden">
              {license.activations.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>IP Address</th>
                      <th>Status</th>
                      <th>Activated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {license.activations.map((activation) => (
                      <tr key={activation.id}>
                        <td>
                          <div>
                            <p className="font-medium">{activation.deviceName || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{activation.deviceId}</p>
                          </div>
                        </td>
                        <td className="text-gray-500">{activation.ipAddress || '-'}</td>
                        <td>
                          <span
                            className={clsx(
                              'badge',
                              activation.isActive ? 'badge-success' : 'badge-gray'
                            )}
                          >
                            {activation.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="text-gray-500">
                          {format(new Date(activation.activatedAt), 'MMM d, yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No activations yet
                </div>
              )}
            </div>
          </div>

          {/* Recent Verifications */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Recent Verifications</h2>
            </div>
            <div className="overflow-hidden">
              {license.verifications.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Result</th>
                      <th>Message</th>
                      <th>IP Address</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {license.verifications.map((verification) => (
                      <tr key={verification.id}>
                        <td>
                          <span
                            className={clsx(
                              'badge',
                              verification.isValid ? 'badge-success' : 'badge-danger'
                            )}
                          >
                            {verification.isValid ? 'Valid' : 'Invalid'}
                          </span>
                        </td>
                        <td className="text-gray-600">{verification.message}</td>
                        <td className="text-gray-500">{verification.ipAddress || '-'}</td>
                        <td className="text-gray-500">
                          {format(new Date(verification.verifiedAt), 'MMM d, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No verifications yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pharmacy Info */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Pharmacy</h2>
            </div>
            <div className="card-body">
              {license.pharmacy ? (
                <div>
                  <p className="font-medium text-gray-900">{license.pharmacy.name}</p>
                  <p className="text-sm text-gray-500">{license.pharmacy.email}</p>
                  {license.pharmacy.phone && (
                    <p className="text-sm text-gray-500">{license.pharmacy.phone}</p>
                  )}
                  <Link
                    to={`/pharmacies/${license.pharmacy.id}`}
                    className="btn btn-secondary w-full mt-4"
                  >
                    View Pharmacy
                  </Link>
                </div>
              ) : (
                <p className="text-gray-500">Not assigned to a pharmacy</p>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Features</h2>
            </div>
            <div className="card-body">
              <ul className="space-y-2 text-sm">
                {Object.entries(license.features || {}).map(([key, value]) => (
                  <li key={key} className="flex items-center justify-between">
                    <span className="text-gray-600">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                    </span>
                    <span className="font-medium">
                      {typeof value === 'boolean' ? (
                        value ? '✓' : '✗'
                      ) : value === -1 ? (
                        'Unlimited'
                      ) : (
                        String(value)
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Revoke Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowRevokeModal(false)} />
            <div className="relative bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-red-100">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Revoke License</h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <label className="label">Reason (optional)</label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="Reason for revocation..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRevokeModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => revokeMutation.mutate()}
                  disabled={revokeMutation.isPending}
                  className="btn btn-danger flex-1"
                >
                  {revokeMutation.isPending ? 'Revoking...' : 'Revoke License'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
