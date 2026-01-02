import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getErrorMessage } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  UsersIcon,
  CubeIcon,
  ClockIcon,
  BuildingStorefrontIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';

interface TierConfig {
  id: string;
  tier: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  durationDays: number;
  features: Record<string, boolean | number>;
  maxUsers: number | null;
  maxProducts: number | null;
  maxTransactions: number | null;
  maxBranches: number | null;
  maxActivations: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const tierColors: Record<string, string> = {
  BASIC: 'border-gray-300 bg-gray-50',
  STANDARD: 'border-blue-300 bg-blue-50',
  PROFESSIONAL: 'border-green-300 bg-green-50',
  ENTERPRISE: 'border-purple-300 bg-purple-50',
};

const tierBadgeColors: Record<string, string> = {
  BASIC: 'bg-gray-100 text-gray-800',
  STANDARD: 'bg-blue-100 text-blue-800',
  PROFESSIONAL: 'bg-green-100 text-green-800',
  ENTERPRISE: 'bg-purple-100 text-purple-800',
};

export default function TierConfigsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TierConfig>>({});

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: tiers, isLoading } = useQuery<TierConfig[]>({
    queryKey: ['tier-configs'],
    queryFn: async () => {
      const response = await api.get('/tier-configs');
      return response.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ tier, data }: { tier: string; data: Partial<TierConfig> }) => {
      const response = await api.put(`/tier-configs/${tier}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tier configuration updated!');
      queryClient.invalidateQueries({ queryKey: ['tier-configs'] });
      setEditingTier(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/tier-configs/reset');
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tier configurations reset to defaults!');
      queryClient.invalidateQueries({ queryKey: ['tier-configs'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const startEditing = (tier: TierConfig) => {
    setEditingTier(tier.tier);
    setEditForm({
      name: tier.name,
      description: tier.description,
      price: tier.price,
      currency: tier.currency,
      durationDays: tier.durationDays,
      maxUsers: tier.maxUsers,
      maxProducts: tier.maxProducts,
      maxBranches: tier.maxBranches,
      maxActivations: tier.maxActivations,
      isActive: tier.isActive,
    });
  };

  const cancelEditing = () => {
    setEditingTier(null);
    setEditForm({});
  };

  const saveEditing = (tier: string) => {
    updateMutation.mutate({ tier, data: editForm });
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all tier configurations to defaults? This cannot be undone.')) {
      resetMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">License Tiers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure pricing, features, and limits for each license tier
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="btn btn-secondary"
          >
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            Reset to Defaults
          </button>
        )}
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {tiers?.map((tier) => (
          <div
            key={tier.tier}
            className={clsx(
              'card border-2 transition-all',
              tierColors[tier.tier],
              !tier.isActive && 'opacity-60'
            )}
          >
            {/* Header */}
            <div className="card-header flex items-center justify-between">
              <div>
                <span className={clsx('badge', tierBadgeColors[tier.tier])}>
                  {tier.tier}
                </span>
                {!tier.isActive && (
                  <span className="badge badge-gray ml-2">Inactive</span>
                )}
              </div>
              {isSuperAdmin && editingTier !== tier.tier && (
                <button
                  onClick={() => startEditing(tier)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              )}
              {editingTier === tier.tier && (
                <div className="flex gap-1">
                  <button
                    onClick={() => saveEditing(tier.tier)}
                    disabled={updateMutation.isPending}
                    className="p-1 text-green-600 hover:text-green-700 rounded"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="p-1 text-red-600 hover:text-red-700 rounded"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="card-body space-y-4">
              {/* Name & Description */}
              {editingTier === tier.tier ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Name</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="input text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Description</label>
                    <textarea
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="input text-sm mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{tier.description}</p>
                </div>
              )}

              {/* Price */}
              <div className="flex items-center gap-2">
                <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                {editingTier === tier.tier ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editForm.price || 0}
                      onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
                      className="input text-sm w-24"
                      min={0}
                    />
                    <select
                      value={editForm.currency || 'GHS'}
                      onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                      className="input text-sm w-20"
                    >
                      <option value="GHS">GHS</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="NGN">NGN</option>
                    </select>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-gray-900">
                    {tier.currency} {tier.price.toLocaleString()}
                    {tier.price > 0 && <span className="text-sm font-normal text-gray-500">/year</span>}
                    {tier.price === 0 && <span className="text-sm font-normal text-gray-500"> (Free)</span>}
                  </span>
                )}
              </div>

              {/* Duration */}
              <div className="flex items-center gap-2 text-sm">
                <ClockIcon className="h-4 w-4 text-gray-400" />
                {editingTier === tier.tier ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editForm.durationDays || 0}
                      onChange={(e) => setEditForm({ ...editForm, durationDays: parseInt(e.target.value) })}
                      className="input text-sm w-20"
                      min={0}
                    />
                    <span className="text-gray-500">days</span>
                  </div>
                ) : (
                  <span className="text-gray-600">
                    {tier.durationDays === 0 ? 'Unlimited' : `${tier.durationDays} days`}
                  </span>
                )}
              </div>

              {/* Limits */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <BuildingStorefrontIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Max Branches</span>
                  </div>
                  {editingTier === tier.tier ? (
                    <input
                      type="number"
                      value={editForm.maxBranches ?? -1}
                      onChange={(e) => setEditForm({ ...editForm, maxBranches: parseInt(e.target.value) })}
                      className="input text-sm w-20"
                      min={-1}
                      placeholder="-1 for unlimited"
                    />
                  ) : (
                    <span className="font-medium">
                      {tier.maxBranches === null || tier.maxBranches === -1 ? 'Unlimited' : tier.maxBranches}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Max Users</span>
                  </div>
                  {editingTier === tier.tier ? (
                    <input
                      type="number"
                      value={editForm.maxUsers ?? -1}
                      onChange={(e) => setEditForm({ ...editForm, maxUsers: parseInt(e.target.value) })}
                      className="input text-sm w-20"
                      min={-1}
                      placeholder="-1 for unlimited"
                    />
                  ) : (
                    <span className="font-medium">
                      {tier.maxUsers === null || tier.maxUsers === -1 ? 'Unlimited' : tier.maxUsers}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <ComputerDesktopIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Max Activations</span>
                  </div>
                  {editingTier === tier.tier ? (
                    <input
                      type="number"
                      value={editForm.maxActivations ?? -1}
                      onChange={(e) => setEditForm({ ...editForm, maxActivations: parseInt(e.target.value) })}
                      className="input text-sm w-20"
                      min={-1}
                      placeholder="-1 for unlimited"
                    />
                  ) : (
                    <span className="font-medium">
                      {tier.maxActivations === null || tier.maxActivations === -1 ? 'Unlimited' : tier.maxActivations}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <CubeIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Max Products</span>
                  </div>
                  {editingTier === tier.tier ? (
                    <input
                      type="number"
                      value={editForm.maxProducts ?? -1}
                      onChange={(e) => setEditForm({ ...editForm, maxProducts: parseInt(e.target.value) })}
                      className="input text-sm w-20"
                      min={-1}
                    />
                  ) : (
                    <span className="font-medium">
                      {tier.maxProducts === null || tier.maxProducts === -1 ? 'Unlimited' : tier.maxProducts?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              {editingTier === tier.tier && tier.tier !== 'BASIC' && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Active</span>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                    className={clsx(
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      editForm.isActive ? 'bg-primary-600' : 'bg-gray-200'
                    )}
                  >
                    <span
                      className={clsx(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                        editForm.isActive ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              )}

              {/* Features Summary */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-2">Features</p>
                <ul className="space-y-1 text-xs text-gray-600">
                  {Object.entries(tier.features || {}).slice(0, 6).map(([key, value]) => (
                    <li key={key} className="flex items-center gap-2">
                      <span className={value === true || (typeof value === 'number' && value !== 0) ? 'text-green-500' : 'text-gray-300'}>
                        {value === true || (typeof value === 'number' && value !== 0) ? '✓' : '✗'}
                      </span>
                      <span className="capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </li>
                  ))}
                  {Object.keys(tier.features || {}).length > 6 && (
                    <li className="text-gray-400">
                      +{Object.keys(tier.features).length - 6} more features
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Features Comparison Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">Features Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Feature</th>
                {tiers?.map((tier) => (
                  <th key={tier.tier} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    {tier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tiers && tiers[0]?.features && Object.keys(tiers[0].features).map((feature) => (
                <tr key={feature} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                    {feature.replace(/([A-Z])/g, ' $1').trim()}
                  </td>
                  {tiers.map((tier) => {
                    const value = tier.features[feature];
                    return (
                      <td key={tier.tier} className="px-4 py-3 text-center">
                        {typeof value === 'boolean' ? (
                          value ? (
                            <span className="text-green-500 font-bold">✓</span>
                          ) : (
                            <span className="text-gray-300">✗</span>
                          )
                        ) : (
                          <span className="text-sm text-gray-900">
                            {value === -1 ? 'Unlimited' : value}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
