import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getErrorMessage } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  PauseIcon,
  PlayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const statusColors: Record<string, string> = {
  ACTIVE: 'badge-success',
  PENDING: 'badge-warning',
  SUSPENDED: 'badge-danger',
  DEACTIVATED: 'badge-gray',
};

const tierColors: Record<string, string> = {
  STANDARD: 'badge-info',
  PROFESSIONAL: 'badge-success',
  ENTERPRISE: 'badge bg-purple-100 text-purple-800',
};

export default function PharmacyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const { data: pharmacy, isLoading } = useQuery({
    queryKey: ['pharmacy', id],
    queryFn: async () => {
      const response = await api.get(`/pharmacies/${id}`);
      return response.data.data;
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/pharmacies/${id}/suspend`, { reason: suspendReason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Pharmacy suspended successfully');
      queryClient.invalidateQueries({ queryKey: ['pharmacy', id] });
      queryClient.invalidateQueries({ queryKey: ['pharmacies'] });
      setShowSuspendModal(false);
      setSuspendReason('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/pharmacies/${id}/activate`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Pharmacy activated successfully');
      queryClient.invalidateQueries({ queryKey: ['pharmacy', id] });
      queryClient.invalidateQueries({ queryKey: ['pharmacies'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/pharmacies/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Pharmacy deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['pharmacies'] });
      navigate('/pharmacies');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>;
  }

  if (!pharmacy) {
    return <div className="text-center py-12"><p className="text-gray-500">Pharmacy not found</p></div>;
  }

  const canDelete = !pharmacy.licenses || pharmacy.licenses.length === 0;
  const isSuspended = pharmacy.status === 'SUSPENDED';
  const isActive = pharmacy.status === 'ACTIVE';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pharmacy.name}</h1>
            <span className={clsx('badge mt-1', statusColors[pharmacy.status])}>{pharmacy.status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header"><h2 className="text-lg font-medium">Pharmacy Information</h2></div>
            <div className="card-body">
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="text-sm text-gray-500">Email</dt><dd className="mt-1">{pharmacy.email}</dd></div>
                <div><dt className="text-sm text-gray-500">Phone</dt><dd className="mt-1">{pharmacy.phone || '-'}</dd></div>
                <div><dt className="text-sm text-gray-500">Address</dt><dd className="mt-1">{pharmacy.address || '-'}</dd></div>
                <div><dt className="text-sm text-gray-500">City</dt><dd className="mt-1">{pharmacy.city || '-'}</dd></div>
                <div><dt className="text-sm text-gray-500">Region</dt><dd className="mt-1">{pharmacy.region || '-'}</dd></div>
                <div><dt className="text-sm text-gray-500">Country</dt><dd className="mt-1">{pharmacy.country}</dd></div>
                <div><dt className="text-sm text-gray-500">Registration #</dt><dd className="mt-1">{pharmacy.registrationNumber || '-'}</dd></div>
                <div><dt className="text-sm text-gray-500">Created</dt><dd className="mt-1">{format(new Date(pharmacy.createdAt), 'MMM d, yyyy')}</dd></div>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="text-lg font-medium">Licenses ({pharmacy.licenses?.length || 0})</h2></div>
            <div className="overflow-hidden">
              {pharmacy.licenses?.length > 0 ? (
                <table className="table">
                  <thead><tr><th>License Key</th><th>Tier</th><th>Status</th><th>Expires</th></tr></thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {pharmacy.licenses.map((license: { id: string; licenseKey: string; tier: string; status: string; expiresAt: string | null }) => (
                      <tr key={license.id}>
                        <td><Link to={`/licenses/${license.id}`} className="text-primary-600 font-mono text-sm">{license.licenseKey}</Link></td>
                        <td><span className={clsx('badge', tierColors[license.tier])}>{license.tier}</span></td>
                        <td><span className={clsx('badge', statusColors[license.status])}>{license.status}</span></td>
                        <td className="text-gray-500">{license.expiresAt ? format(new Date(license.expiresAt), 'MMM d, yyyy') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">No licenses assigned</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header"><h2 className="text-lg font-medium">Quick Actions</h2></div>
            <div className="card-body space-y-3">
              <Link to={`/licenses/generate?pharmacyId=${pharmacy.id}`} className="btn btn-primary w-full">
                Generate License
              </Link>
              <Link to={`/pharmacies/${pharmacy.id}/edit`} className="btn btn-secondary w-full flex items-center justify-center">
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit Pharmacy
              </Link>

              {isSuspended || !isActive ? (
                <button
                  onClick={() => activateMutation.mutate()}
                  disabled={activateMutation.isPending}
                  className="btn btn-success w-full flex items-center justify-center"
                >
                  {activateMutation.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <PlayIcon className="h-4 w-4 mr-2" />
                  )}
                  Activate Pharmacy
                </button>
              ) : (
                <button
                  onClick={() => setShowSuspendModal(true)}
                  className="btn btn-warning w-full flex items-center justify-center"
                >
                  <PauseIcon className="h-4 w-4 mr-2" />
                  Suspend Pharmacy
                </button>
              )}
            </div>
          </div>

          <div className="card border-red-200">
            <div className="card-header bg-red-50">
              <h2 className="text-lg font-medium text-red-800">Danger Zone</h2>
            </div>
            <div className="card-body">
              <p className="text-sm text-gray-600 mb-4">
                {canDelete
                  ? 'Permanently delete this pharmacy and all associated data.'
                  : 'This pharmacy has licenses assigned and cannot be deleted. Remove or reassign all licenses first.'}
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={!canDelete}
                className={clsx(
                  'btn w-full flex items-center justify-center',
                  canDelete ? 'btn-danger' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete Pharmacy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Suspend Pharmacy</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Suspending this pharmacy will prevent their licenses from working until reactivated.
            </p>
            <div className="mb-4">
              <label className="label">Reason (optional)</label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="input"
                rows={3}
                placeholder="Enter reason for suspension..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSuspendModal(false);
                  setSuspendReason('');
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => suspendMutation.mutate()}
                disabled={suspendMutation.isPending}
                className="btn btn-warning flex-1"
              >
                {suspendMutation.isPending ? <LoadingSpinner size="sm" /> : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Delete Pharmacy</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{pharmacy.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="btn btn-danger flex-1"
              >
                {deleteMutation.isPending ? <LoadingSpinner size="sm" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
