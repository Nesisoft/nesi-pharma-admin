import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { MagnifyingGlassIcon, EyeIcon, PlusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { format } from 'date-fns';

interface Pharmacy {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  status: string;
  createdAt: string;
  licenses: { tier: string; status: string }[];
  _count: { licenses: number };
}

const statusColors: Record<string, string> = {
  ACTIVE: 'badge-success',
  PENDING: 'badge-warning',
  SUSPENDED: 'badge-danger',
  DEACTIVATED: 'badge-gray',
};

export default function PharmaciesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const page = parseInt(searchParams.get('page') || '1');
  const status = searchParams.get('status') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacies', page, search, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '10');
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const response = await api.get(`/pharmacies?${params}`);
      return { data: response.data.data as Pharmacy[], meta: response.data.meta };
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams((prev) => { prev.set('search', search); prev.set('page', '1'); return prev; });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacies</h1>
          <p className="mt-1 text-sm text-gray-500">Manage registered pharmacies</p>
        </div>
        <Link to="/pharmacies/new" className="btn btn-primary">
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Pharmacy
        </Link>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pharmacies..." className="input pl-10" />
              </div>
            </form>
            <select value={status} onChange={(e) => setSearchParams((prev) => {
              if (e.target.value) prev.set('status', e.target.value); else prev.delete('status');
              prev.set('page', '1'); return prev;
            })} className="input w-auto">
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Pharmacy</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Licenses</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data.map((pharmacy) => (
                  <tr key={pharmacy.id}>
                    <td>
                      <div>
                        <p className="font-medium text-gray-900">{pharmacy.name}</p>
                        <p className="text-sm text-gray-500">{pharmacy.email}</p>
                      </div>
                    </td>
                    <td className="text-gray-600">{pharmacy.city || pharmacy.region || '-'}</td>
                    <td><span className={clsx('badge', statusColors[pharmacy.status])}>{pharmacy.status}</span></td>
                    <td>{pharmacy._count.licenses}</td>
                    <td className="text-gray-500">{format(new Date(pharmacy.createdAt), 'MMM d, yyyy')}</td>
                    <td>
                      <Link to={`/pharmacies/${pharmacy.id}`} className="text-primary-600 hover:text-primary-700">
                        <EyeIcon className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">No pharmacies found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
