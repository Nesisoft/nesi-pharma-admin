import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface License {
  id: string;
  licenseKey: string;
  tier: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  pharmacy: { id: string; name: string; email: string } | null;
  _count: { activations: number };
}

interface LicenseResponse {
  data: License[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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

export default function LicensesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const page = parseInt(searchParams.get('page') || '1');
  const tier = searchParams.get('tier') || '';
  const status = searchParams.get('status') || '';

  const { data, isLoading } = useQuery<LicenseResponse>({
    queryKey: ['licenses', page, search, tier, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '10');
      if (search) params.set('search', search);
      if (tier) params.set('tier', tier);
      if (status) params.set('status', status);

      const response = await api.get(`/licenses?${params}`);
      return { data: response.data.data, meta: response.data.meta };
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams((prev) => {
      prev.set('search', search);
      prev.set('page', '1');
      return prev;
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setSearchParams((prev) => {
      if (value) {
        prev.set(key, value);
      } else {
        prev.delete(key);
      }
      prev.set('page', '1');
      return prev;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      prev.set('page', newPage.toString());
      return prev;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('License key copied!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licenses</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and generate license keys for pharmacies
          </p>
        </div>
        <Link to="/licenses/generate" className="btn btn-primary">
          <PlusIcon className="h-5 w-5 mr-2" />
          Generate License
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by license key, pharmacy..."
                  className="input pl-10"
                />
              </div>
            </form>

            {/* Tier Filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={tier}
                onChange={(e) => handleFilterChange('tier', e.target.value)}
                className="input w-auto"
              >
                <option value="">All Tiers</option>
                <option value="STANDARD">Standard</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input w-auto"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>License Key</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th>Pharmacy</th>
                    <th>Activations</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {data?.data.map((license) => (
                    <tr key={license.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {license.licenseKey}
                          </code>
                          <button
                            onClick={() => copyToClipboard(license.licenseKey)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copy to clipboard"
                          >
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={clsx('badge', tierColors[license.tier])}>
                          {license.tier}
                        </span>
                      </td>
                      <td>
                        <span className={clsx('badge', statusColors[license.status])}>
                          {license.status}
                        </span>
                      </td>
                      <td>
                        {license.pharmacy ? (
                          <Link
                            to={`/pharmacies/${license.pharmacy.id}`}
                            className="text-primary-600 hover:text-primary-700"
                          >
                            {license.pharmacy.name}
                          </Link>
                        ) : (
                          <span className="text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <span className="text-gray-600">{license._count.activations}</span>
                      </td>
                      <td>
                        {license.expiresAt ? (
                          <span className="text-gray-600">
                            {format(new Date(license.expiresAt), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/licenses/${license.id}`}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {data?.data.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No licenses found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data?.meta && data.meta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(data.meta.page - 1) * data.meta.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(data.meta.page * data.meta.limit, data.meta.total)}
                  </span>{' '}
                  of <span className="font-medium">{data.meta.total}</span> results
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="btn btn-secondary"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= data.meta.totalPages}
                    className="btn btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
