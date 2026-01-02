import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import clsx from 'clsx';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

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

  const { data: pharmacy, isLoading } = useQuery({
    queryKey: ['pharmacy', id],
    queryFn: async () => {
      const response = await api.get(`/pharmacies/${id}`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>;
  }

  if (!pharmacy) {
    return <div className="text-center py-12"><p className="text-gray-500">Pharmacy not found</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pharmacy.name}</h1>
          <span className={clsx('badge mt-1', statusColors[pharmacy.status])}>{pharmacy.status}</span>
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
              <Link to={`/licenses/generate?pharmacyId=${pharmacy.id}`} className="btn btn-primary w-full">Generate License</Link>
              <button className="btn btn-secondary w-full">Edit Pharmacy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
