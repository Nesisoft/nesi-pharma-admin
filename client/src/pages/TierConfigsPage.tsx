import { useState, useEffect } from 'react';
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
  PuzzlePieceIcon,
  PlusIcon,
  TrashIcon,
  ArchiveBoxIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline';

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  isEnabled: boolean;
  isAssigned: boolean;
}

interface TierConfig {
  id: string;
  code: string;
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
  isDefault: boolean;
  displayOrder: number;
  color: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TierFeaturesResponse {
  tier: TierConfig;
  features: Feature[];
}

interface CreateTierForm {
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  durationDays: number;
  maxUsers: number | null;
  maxProducts: number | null;
  maxBranches: number | null;
  maxActivations: number | null;
  color: string;
}

const defaultColors = [
  { name: 'Gray', value: '#6B7280' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Indigo', value: '#6366F1' },
];

const categoryColors: Record<string, string> = {
  core: 'bg-blue-50 border-blue-200',
  sales: 'bg-green-50 border-green-200',
  inventory: 'bg-yellow-50 border-yellow-200',
  reports: 'bg-purple-50 border-purple-200',
  reporting: 'bg-purple-50 border-purple-200',
  customers: 'bg-pink-50 border-pink-200',
  suppliers: 'bg-orange-50 border-orange-200',
  pharmacy: 'bg-teal-50 border-teal-200',
  system: 'bg-slate-50 border-slate-200',
  enterprise: 'bg-indigo-50 border-indigo-200',
  support: 'bg-rose-50 border-rose-200',
  general: 'bg-gray-50 border-gray-200',
};

const initialCreateForm: CreateTierForm = {
  code: '',
  name: '',
  description: '',
  price: 0,
  currency: 'GHS',
  durationDays: 365,
  maxUsers: null,
  maxProducts: null,
  maxBranches: null,
  maxActivations: null,
  color: '#3B82F6',
};

export default function TierConfigsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TierConfig>>({});
  const [featureModalTier, setFeatureModalTier] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTierForm>(initialCreateForm);
  const [deleteConfirmTier, setDeleteConfirmTier] = useState<TierConfig | null>(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: tiers, isLoading } = useQuery<TierConfig[]>({
    queryKey: ['tier-configs'],
    queryFn: async () => {
      const response = await api.get('/tier-configs');
      return response.data.data;
    },
  });

  // Fetch features for a specific tier
  const { data: tierFeatures, isLoading: featuresLoading } = useQuery<TierFeaturesResponse>({
    queryKey: ['tier-features', featureModalTier],
    queryFn: async () => {
      const response = await api.get(`/tier-configs/${featureModalTier}/features`);
      return response.data.data;
    },
    enabled: !!featureModalTier,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateTierForm) => {
      const response = await api.post('/tier-configs', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tier created successfully!');
      queryClient.invalidateQueries({ queryKey: ['tier-configs'] });
      setShowCreateModal(false);
      setCreateForm(initialCreateForm);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ code, data }: { code: string; data: Partial<TierConfig> }) => {
      const response = await api.put(`/tier-configs/${code}`, data);
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

  const deleteMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await api.delete(`/tier-configs/${code}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tier deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['tier-configs'] });
      setDeleteConfirmTier(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await api.post(`/tier-configs/${code}/archive`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tier archived successfully!');
      queryClient.invalidateQueries({ queryKey: ['tier-configs'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await api.post(`/tier-configs/${code}/restore`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tier restored successfully!');
      queryClient.invalidateQueries({ queryKey: ['tier-configs'] });
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

  const syncFeaturesMutation = useMutation({
    mutationFn: async ({ code, featureIds }: { code: string; featureIds: string[] }) => {
      const response = await api.post(`/tier-configs/${code}/features/sync`, { featureIds });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tier features updated!');
      queryClient.invalidateQueries({ queryKey: ['tier-configs'] });
      queryClient.invalidateQueries({ queryKey: ['tier-features'] });
      setFeatureModalTier(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const startEditing = (tier: TierConfig) => {
    setEditingTier(tier.code);
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
      color: tier.color,
      isActive: tier.isActive,
    });
  };

  const cancelEditing = () => {
    setEditingTier(null);
    setEditForm({});
  };

  const saveEditing = (code: string) => {
    updateMutation.mutate({ code, data: editForm });
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all tier configurations to defaults? This cannot be undone.')) {
      resetMutation.mutate();
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(createForm);
  };

  const openFeatureModal = (code: string) => {
    setFeatureModalTier(code);
    setSelectedFeatures([]);
  };

  const closeFeatureModal = () => {
    setFeatureModalTier(null);
    setSelectedFeatures([]);
  };

  // Initialize selected features when tier features data loads
  useEffect(() => {
    if (tierFeatures?.features) {
      const enabledIds = tierFeatures.features
        .filter((f) => f.isEnabled)
        .map((f) => f.id);
      setSelectedFeatures(enabledIds);
    }
  }, [tierFeatures]);

  // Toggle feature selection
  const toggleFeature = (featureId: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(featureId)
        ? prev.filter((id) => id !== featureId)
        : [...prev, featureId]
    );
  };

  const saveFeatures = () => {
    if (featureModalTier) {
      syncFeaturesMutation.mutate({ code: featureModalTier, featureIds: selectedFeatures });
    }
  };

  // Group features by category
  const groupedFeatures = tierFeatures?.features?.reduce((acc, feature) => {
    const category = feature.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);

  const getTierBorderColor = (tier: TierConfig) => {
    if (tier.color) {
      return { borderColor: tier.color, backgroundColor: `${tier.color}10` };
    }
    return {};
  };

  const getTierBadgeStyle = (tier: TierConfig) => {
    if (tier.color) {
      return { backgroundColor: `${tier.color}20`, color: tier.color };
    }
    return {};
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
        <div className="flex gap-2">
          {isSuperAdmin && (
            <>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Tier
              </button>
              <button
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="btn btn-secondary"
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Reset Defaults
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {tiers?.map((tier) => (
          <div
            key={tier.code}
            className={clsx(
              'card border-2 transition-all',
              !tier.isActive && 'opacity-60'
            )}
            style={getTierBorderColor(tier)}
          >
            {/* Header */}
            <div className="card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="badge"
                  style={getTierBadgeStyle(tier)}
                >
                  {tier.code}
                </span>
                {tier.isDefault && (
                  <span className="badge badge-gray text-xs">Default</span>
                )}
                {!tier.isActive && (
                  <span className="badge badge-gray">Inactive</span>
                )}
              </div>
              {isSuperAdmin && editingTier !== tier.code && (
                <div className="flex gap-1">
                  <button
                    onClick={() => openFeatureModal(tier.code)}
                    className="p-1 text-gray-400 hover:text-primary-600 rounded"
                    title="Manage Features"
                  >
                    <PuzzlePieceIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => startEditing(tier)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Edit Tier"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  {!tier.isDefault && (
                    <>
                      {tier.archivedAt ? (
                        <button
                          onClick={() => restoreMutation.mutate(tier.code)}
                          className="p-1 text-gray-400 hover:text-green-600 rounded"
                          title="Restore Tier"
                        >
                          <ArchiveBoxArrowDownIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => archiveMutation.mutate(tier.code)}
                          className="p-1 text-gray-400 hover:text-yellow-600 rounded"
                          title="Archive Tier"
                        >
                          <ArchiveBoxIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteConfirmTier(tier)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Delete Tier"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
              {editingTier === tier.code && (
                <div className="flex gap-1">
                  <button
                    onClick={() => saveEditing(tier.code)}
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
              {editingTier === tier.code ? (
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
                  <div>
                    <label className="text-xs font-medium text-gray-500">Color</label>
                    <div className="flex gap-2 mt-1">
                      {defaultColors.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, color: color.value })}
                          className={clsx(
                            'w-6 h-6 rounded-full border-2',
                            editForm.color === color.value ? 'border-gray-900' : 'border-transparent'
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
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
                {editingTier === tier.code ? (
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
                {editingTier === tier.code ? (
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
                  {editingTier === tier.code ? (
                    <input
                      type="number"
                      value={editForm.maxBranches ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, maxBranches: e.target.value ? parseInt(e.target.value) : null })}
                      className="input text-sm w-20"
                      min={-1}
                      placeholder="Unlimited"
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
                  {editingTier === tier.code ? (
                    <input
                      type="number"
                      value={editForm.maxUsers ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, maxUsers: e.target.value ? parseInt(e.target.value) : null })}
                      className="input text-sm w-20"
                      min={-1}
                      placeholder="Unlimited"
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
                  {editingTier === tier.code ? (
                    <input
                      type="number"
                      value={editForm.maxActivations ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, maxActivations: e.target.value ? parseInt(e.target.value) : null })}
                      className="input text-sm w-20"
                      min={-1}
                      placeholder="Unlimited"
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
                  {editingTier === tier.code ? (
                    <input
                      type="number"
                      value={editForm.maxProducts ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, maxProducts: e.target.value ? parseInt(e.target.value) : null })}
                      className="input text-sm w-20"
                      min={-1}
                      placeholder="Unlimited"
                    />
                  ) : (
                    <span className="font-medium">
                      {tier.maxProducts === null || tier.maxProducts === -1 ? 'Unlimited' : tier.maxProducts?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              {editingTier === tier.code && (
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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500">Features</p>
                  {isSuperAdmin && (
                    <button
                      onClick={() => openFeatureModal(tier.code)}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Manage
                    </button>
                  )}
                </div>
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
                  {Object.keys(tier.features || {}).length === 0 && (
                    <li className="text-gray-400 italic">No features configured</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Features Comparison Table */}
      {tiers && tiers.length > 0 && Object.keys(tiers[0]?.features || {}).length > 0 && (
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
                    <th key={tier.code} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
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
                        <td key={tier.code} className="px-4 py-3 text-center">
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
      )}

      {/* Create Tier Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-30"
              onClick={() => setShowCreateModal(false)}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
              <form onSubmit={handleCreate}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">Create New Tier</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Code *</label>
                      <input
                        type="text"
                        value={createForm.code}
                        onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                        className="input mt-1"
                        placeholder="GOLD_TIER"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Uppercase letters, numbers, underscores</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name *</label>
                      <input
                        type="text"
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        className="input mt-1"
                        placeholder="Gold Tier"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      className="input mt-1"
                      rows={2}
                      placeholder="Description of this tier..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Price</label>
                      <input
                        type="number"
                        value={createForm.price}
                        onChange={(e) => setCreateForm({ ...createForm, price: parseFloat(e.target.value) || 0 })}
                        className="input mt-1"
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Currency</label>
                      <select
                        value={createForm.currency}
                        onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                        className="input mt-1"
                      >
                        <option value="GHS">GHS</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="NGN">NGN</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration (days)</label>
                    <input
                      type="number"
                      value={createForm.durationDays}
                      onChange={(e) => setCreateForm({ ...createForm, durationDays: parseInt(e.target.value) || 0 })}
                      className="input mt-1"
                      min={0}
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = unlimited duration</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Max Users</label>
                      <input
                        type="number"
                        value={createForm.maxUsers ?? ''}
                        onChange={(e) => setCreateForm({ ...createForm, maxUsers: e.target.value ? parseInt(e.target.value) : null })}
                        className="input mt-1"
                        min={1}
                        placeholder="Unlimited"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Max Branches</label>
                      <input
                        type="number"
                        value={createForm.maxBranches ?? ''}
                        onChange={(e) => setCreateForm({ ...createForm, maxBranches: e.target.value ? parseInt(e.target.value) : null })}
                        className="input mt-1"
                        min={1}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Max Products</label>
                      <input
                        type="number"
                        value={createForm.maxProducts ?? ''}
                        onChange={(e) => setCreateForm({ ...createForm, maxProducts: e.target.value ? parseInt(e.target.value) : null })}
                        className="input mt-1"
                        min={1}
                        placeholder="Unlimited"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Max Activations</label>
                      <input
                        type="number"
                        value={createForm.maxActivations ?? ''}
                        onChange={(e) => setCreateForm({ ...createForm, maxActivations: e.target.value ? parseInt(e.target.value) : null })}
                        className="input mt-1"
                        min={1}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Color</label>
                    <div className="flex gap-2 mt-2">
                      {defaultColors.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setCreateForm({ ...createForm, color: color.value })}
                          className={clsx(
                            'w-8 h-8 rounded-full border-2',
                            createForm.color === color.value ? 'border-gray-900' : 'border-transparent'
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn btn-primary"
                  >
                    {createMutation.isPending ? <LoadingSpinner size="sm" /> : 'Create Tier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTier && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-30"
              onClick={() => setDeleteConfirmTier(null)}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Tier</h3>
              <p className="text-sm text-gray-500 mb-4">
                Are you sure you want to permanently delete the <strong>{deleteConfirmTier.name}</strong> tier?
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmTier(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirmTier.code)}
                  disabled={deleteMutation.isPending}
                  className="btn bg-red-600 text-white hover:bg-red-700"
                >
                  {deleteMutation.isPending ? <LoadingSpinner size="sm" /> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Management Modal */}
      {featureModalTier && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-30"
              onClick={closeFeatureModal}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Manage Features - {featureModalTier}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Select which features to enable for this tier
                  </p>
                </div>
                <button
                  onClick={closeFeatureModal}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {featuresLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : tierFeatures?.features?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <PuzzlePieceIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No features available.</p>
                    <p className="text-sm">Create features in the Features page first.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Features grouped by category */}
                    {groupedFeatures && Object.entries(groupedFeatures).map(([category, features]) => (
                      <div key={category} className={clsx('rounded-lg border p-4', categoryColors[category] || categoryColors.general)}>
                        <h4 className="text-sm font-medium text-gray-900 capitalize mb-3">
                          {category} Features
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {features.map((feature) => (
                            <label
                              key={feature.id}
                              className={clsx(
                                'flex items-start gap-3 p-3 rounded-lg bg-white border cursor-pointer transition-colors',
                                selectedFeatures.includes(feature.id)
                                  ? 'border-primary-500 ring-1 ring-primary-500'
                                  : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectedFeatures.includes(feature.id)}
                                onChange={() => toggleFeature(feature.id)}
                                className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900">
                                  {feature.name}
                                </div>
                                <code className="text-xs text-gray-500">{feature.key}</code>
                                {feature.description && (
                                  <p className="text-xs text-gray-500 mt-1 truncate">
                                    {feature.description}
                                  </p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <div className="text-sm text-gray-500">
                  {selectedFeatures.length} feature(s) selected
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeFeatureModal}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveFeatures}
                    disabled={syncFeaturesMutation.isPending}
                    className="btn btn-primary"
                  >
                    {syncFeaturesMutation.isPending ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      'Save Features'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
